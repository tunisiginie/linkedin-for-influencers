// Bridges the pure computeRoiScore() function to the database: pulls each
// creator's aggregated metric history, builds per-category peer benchmarks,
// and upserts roi_scores. Used by the seed script (Phase 1) and the nightly
// ingestion recompute step (Phase 2) — see src/lib/ingest/run.ts.
//
// Uses the admin (service-role) client because it needs to read every
// creator's metrics regardless of RLS and write to roi_scores.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeCategoryBenchmark,
  computeRoiScore,
  toStoredComponents,
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
      upload_count: number;
    }[];
  }[];
}

/** Merge every connected platform account's daily snapshots into one series.
 * Extensive metrics (followers, total_views, upload_count) are summed;
 * per-video averages (avg_views, likes, comments) are arithmetically
 * averaged across whichever accounts reported on that date — a defensible
 * MVP simplification documented here rather than hidden. */
function aggregateAccountSeries(
  accounts: CreatorRow["creator_accounts"],
): CreatorMetricPoint[] {
  const byDate = new Map<
    string,
    { followers: number; totalViews: number; uploadCount: number; avgViewsSum: number; likesSum: number; commentsSum: number; n: number }
  >();

  for (const account of accounts) {
    for (const m of account.account_metrics) {
      const bucket = byDate.get(m.snapshot_date) ?? {
        followers: 0,
        totalViews: 0,
        uploadCount: 0,
        avgViewsSum: 0,
        likesSum: 0,
        commentsSum: 0,
        n: 0,
      };
      bucket.followers += m.followers;
      bucket.totalViews += m.total_views;
      bucket.uploadCount += m.upload_count;
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
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function primaryCategoryId(row: CreatorRow): string | null {
  if (row.creator_categories.length === 0) return null;
  return [...row.creator_categories].sort((a, b) => b.confidence - a.confidence)[0]
    .category_id;
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
      creator_accounts(id, account_metrics(snapshot_date, followers, total_views, avg_views, likes, comments, upload_count))
    `,
  );
  if (options.creatorIds && options.creatorIds.length > 0) {
    query = query.in("id", options.creatorIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(`recomputeRoiScores: failed to load creators: ${error.message}`);

  const rows = (data as unknown as CreatorRow[]) ?? [];

  // Build one benchmark per category from every creator's latest snapshot.
  const seriesByCreator = new Map<string, CreatorMetricPoint[]>();
  const categoryByCreator = new Map<string, string | null>();
  const latestByCategory = new Map<string, CreatorMetricPoint[]>();

  for (const row of rows) {
    const series = aggregateAccountSeries(row.creator_accounts);
    seriesByCreator.set(row.id, series);
    const categoryId = primaryCategoryId(row);
    categoryByCreator.set(row.id, categoryId);
    if (series.length === 0) continue;
    const latest = series[series.length - 1];
    const key = categoryId ?? "__uncategorized__";
    const bucket = latestByCategory.get(key) ?? [];
    bucket.push(latest);
    latestByCategory.set(key, bucket);
  }

  const benchmarkByCategory = new Map(
    Array.from(latestByCategory.entries()).map(([key, peers]) => [
      key,
      computeCategoryBenchmark(peers),
    ]),
  );

  let scored = 0;
  let skipped = 0;
  const upserts: {
    creator_id: string;
    score: number | null;
    grade: string | null;
    components: unknown;
    algo_version: string;
    computed_at: string;
  }[] = [];

  for (const row of rows) {
    const series = seriesByCreator.get(row.id) ?? [];
    const categoryId = categoryByCreator.get(row.id) ?? null;
    const benchmark = benchmarkByCategory.get(categoryId ?? "__uncategorized__");
    const result = computeRoiScore(series, row.years_active_since, benchmark);

    if (result.score === null) {
      skipped += 1;
    } else {
      scored += 1;
    }

    upserts.push({
      creator_id: row.id,
      score: result.score,
      grade: result.grade,
      components: toStoredComponents(result.components),
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
