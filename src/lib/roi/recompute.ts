// Bridges the pure computeRoiScore() function to the database: pulls each
// creator's aggregated metric history, builds per-(category, size-tier)
// peer benchmarks, and upserts roi_scores. Used by the seed script (Phase 1)
// and the nightly ingestion recompute step (Phase 2) — see
// src/lib/ingest/run.ts.
//
// Uses the admin (service-role) client because it needs to read every
// creator's metrics regardless of RLS and write to roi_scores.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeCategoryBenchmark,
  computeRoiScore,
  DEFAULT_BENCHMARK,
  relativeSlope,
  sizeTierFor,
  toStoredComponents,
  withCohortSeries,
  type CreatorMetricPoint,
} from "@/lib/roi/score";

interface CreatorRow {
  id: string;
  years_active_since: number | null;
  creator_categories: { confidence: number; category_id: string }[];
  creator_accounts: {
    id: string;
    account_metrics: {
      snapshot_date: string;
      followers: number;
      total_views: number;
      avg_views: number;
      likes: number;
      comments: number;
      watch_hours: number;
      upload_count: number;
    }[];
  }[];
}

/** Merge every connected platform account's daily snapshots into one series.
 * Extensive metrics (followers, total_views, upload_count, watch_hours) are
 * summed; per-video averages (avg_views, likes, comments) are arithmetically
 * averaged across whichever accounts reported on that date — a defensible
 * MVP simplification documented here rather than hidden. */
function aggregateAccountSeries(
  accounts: CreatorRow["creator_accounts"],
): CreatorMetricPoint[] {
  const byDate = new Map<
    string,
    {
      followers: number;
      totalViews: number;
      uploadCount: number;
      watchHours: number;
      avgViewsSum: number;
      likesSum: number;
      commentsSum: number;
      n: number;
    }
  >();

  for (const account of accounts) {
    for (const m of account.account_metrics) {
      const bucket = byDate.get(m.snapshot_date) ?? {
        followers: 0,
        totalViews: 0,
        uploadCount: 0,
        watchHours: 0,
        avgViewsSum: 0,
        likesSum: 0,
        commentsSum: 0,
        n: 0,
      };
      bucket.followers += m.followers;
      bucket.totalViews += m.total_views;
      bucket.uploadCount += m.upload_count;
      bucket.watchHours += m.watch_hours;
      bucket.avgViewsSum += m.avg_views;
      bucket.likesSum += m.likes;
      bucket.commentsSum += m.comments;
      bucket.n += 1;
      byDate.set(m.snapshot_date, bucket);
    }
  }

  return Array.from(byDate.entries())
    .map(([date, b]) => ({
      date,
      followers: b.followers,
      totalViews: b.totalViews,
      avgViews: b.n > 0 ? Math.round(b.avgViewsSum / b.n) : 0,
      likes: b.n > 0 ? Math.round(b.likesSum / b.n) : 0,
      comments: b.n > 0 ? Math.round(b.commentsSum / b.n) : 0,
      uploadCount: b.uploadCount,
      watchHours: b.watchHours,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function primaryCategoryId(row: CreatorRow): string | null {
  if (row.creator_categories.length === 0) return null;
  return [...row.creator_categories].sort((a, b) => b.confidence - a.confidence)[0]
    .category_id;
}

/** Real calendar-day gaps between upload events in a full series — used to
 * seed a peer cohort's cadence-target distribution (see score.ts's
 * targetOptimal). Mirrors the gap logic inside computeRoiScore itself. */
function uploadGapDays(series: CreatorMetricPoint[]): number[] {
  const dates: number[] = [];
  for (let i = 1; i < series.length; i++) {
    if (series[i].uploadCount > series[i - 1].uploadCount) {
      dates.push(new Date(series[i].date).getTime());
    }
  }
  const gaps: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    gaps.push((dates[i] - dates[i - 1]) / 86_400_000);
  }
  return gaps;
}

export interface RecomputeOptions {
  /** Restrict to specific creator ids (e.g. just-ingested creators). Omit to
   * recompute every creator — the nightly full-catalog pass. */
  creatorIds?: string[];
}

export interface RecomputeSummary {
  scored: number;
  skipped: number;
}

export async function recomputeRoiScores(
  supabase: SupabaseClient,
  options: RecomputeOptions = {},
): Promise<RecomputeSummary> {
  let query = supabase.from("creators").select(
    `
      id,
      years_active_since,
      creator_categories(confidence, category_id),
      creator_accounts(id, account_metrics(snapshot_date, followers, total_views, avg_views, likes, comments, watch_hours, upload_count))
    `,
  );
  if (options.creatorIds && options.creatorIds.length > 0) {
    query = query.in("id", options.creatorIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(`recomputeRoiScores: failed to load creators: ${error.message}`);

  const rows = (data as unknown as CreatorRow[]) ?? [];

  // Relevance pillar input (ROI v2 Phase B). Computed and stored separately
  // by recomputeContentSignals() in content-signals.ts — this is a read
  // only, keeping computeRoiScore() itself free of any Claude call.
  const topicalAuthorityByCreator = new Map<string, number>();
  if (rows.length > 0) {
    const { data: signals } = await supabase
      .from("creator_content_signals")
      .select("creator_id, topical_authority")
      .in("creator_id", rows.map((r) => r.id));
    for (const s of signals ?? []) {
      if (s.topical_authority != null) topicalAuthorityByCreator.set(s.creator_id, s.topical_authority);
    }
  }

  const seriesByCreator = new Map<string, CreatorMetricPoint[]>();
  const categoryByCreator = new Map<string, string | null>();
  const activePlatformCountByCreator = new Map<string, number>();
  // Every bucket below is keyed (category[/tier]) -> entries tagged with the
  // contributing creator's id, so each creator's OWN benchmark can exclude
  // itself at lookup time. Without this, a thin cohort (or, worst case, a
  // creator who is the only member of their size tier in their category)
  // would be benchmarked against a "peer" distribution that is partly or
  // wholly their own data — silently landing them at the median regardless
  // of how extreme their actual metrics are.
  const latestByCategory = new Map<string, { creatorId: string; point: CreatorMetricPoint }[]>();
  const latestByCategoryTier = new Map<string, { creatorId: string; point: CreatorMetricPoint }[]>();
  const growthByCategoryTier = new Map<string, { creatorId: string; value: number }[]>();
  const cadenceByCategoryTier = new Map<string, { creatorId: string; value: number }[]>();

  for (const row of rows) {
    const series = aggregateAccountSeries(row.creator_accounts);
    seriesByCreator.set(row.id, series);
    const categoryId = primaryCategoryId(row);
    categoryByCreator.set(row.id, categoryId);
    activePlatformCountByCreator.set(
      row.id,
      row.creator_accounts.filter((a) => a.account_metrics.length > 0).length,
    );
    if (series.length === 0) continue;

    const latest = series[series.length - 1];
    const categoryKey = categoryId ?? "__uncategorized__";
    const tierKey = `${categoryKey}::${sizeTierFor(latest.followers)}`;

    const categoryBucket = latestByCategory.get(categoryKey) ?? [];
    categoryBucket.push({ creatorId: row.id, point: latest });
    latestByCategory.set(categoryKey, categoryBucket);

    const tierBucket = latestByCategoryTier.get(tierKey) ?? [];
    tierBucket.push({ creatorId: row.id, point: latest });
    latestByCategoryTier.set(tierKey, tierBucket);

    const growthBucket = growthByCategoryTier.get(tierKey) ?? [];
    growthBucket.push({ creatorId: row.id, value: relativeSlope(series.map((p) => p.followers)) });
    growthByCategoryTier.set(tierKey, growthBucket);

    const cadenceBucket = cadenceByCategoryTier.get(tierKey) ?? [];
    for (const gap of uploadGapDays(series)) {
      cadenceBucket.push({ creatorId: row.id, value: gap });
    }
    cadenceByCategoryTier.set(tierKey, cadenceBucket);
  }

  let scored = 0;
  let skipped = 0;
  const upserts: {
    creator_id: string;
    score: number | null;
    grade: string | null;
    components: unknown;
    confidence: number | null;
    reasons: unknown;
    cohort_key: string | null;
    algo_version: string;
    computed_at: string;
  }[] = [];

  for (const row of rows) {
    const series = seriesByCreator.get(row.id) ?? [];
    const categoryId = categoryByCreator.get(row.id) ?? null;
    const categoryKey = categoryId ?? "__uncategorized__";

    let cohortKey: string | null = null;
    let benchmark = DEFAULT_BENCHMARK;
    if (series.length > 0) {
      const latest = series[series.length - 1];
      const tier = sizeTierFor(latest.followers);
      const tierKey = `${categoryKey}::${tier}`;
      cohortKey = tierKey;
      const excludingSelf = <T extends { creatorId: string }>(entries: T[]) =>
        entries.filter((e) => e.creatorId !== row.id);
      const categoryPeers = excludingSelf(latestByCategory.get(categoryKey) ?? []).map((e) => e.point);
      const tierPeers = excludingSelf(latestByCategoryTier.get(tierKey) ?? []).map((e) => e.point);
      const growthSamples = excludingSelf(growthByCategoryTier.get(tierKey) ?? []).map((e) => e.value);
      const cadenceSamples = excludingSelf(cadenceByCategoryTier.get(tierKey) ?? []).map((e) => e.value);
      benchmark = withCohortSeries(
        computeCategoryBenchmark(categoryPeers, tierPeers),
        growthSamples,
        cadenceSamples,
      );
    }

    const result = computeRoiScore(series, row.years_active_since, benchmark, new Date(), {
      activePlatformCount: activePlatformCountByCreator.get(row.id),
      topicalAuthority: topicalAuthorityByCreator.get(row.id) ?? null,
    });

    if (result.score === null) {
      skipped += 1;
    } else {
      scored += 1;
    }

    upserts.push({
      creator_id: row.id,
      score: result.score,
      grade: result.grade,
      components: toStoredComponents(result),
      confidence: result.confidence,
      reasons: result.reasons,
      cohort_key: result.score === null ? null : cohortKey,
      algo_version: result.algoVersion,
      computed_at: new Date().toISOString(),
    });
  }

  if (upserts.length > 0) {
    const { error: upsertError } = await supabase
      .from("roi_scores")
      .upsert(upserts, { onConflict: "creator_id" });
    if (upsertError) {
      throw new Error(`recomputeRoiScores: failed to upsert scores: ${upsertError.message}`);
    }
  }

  return { scored, skipped };
}
