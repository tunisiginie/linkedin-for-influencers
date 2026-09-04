// Ingestion orchestrator: refreshes the stalest N creator_accounts, routing
// each to the right PlatformAdapter (real YouTube, seeded Instagram/TikTok),
// writes a new account_metrics snapshot and recent content-item titles,
// recomputes relevance signals (ROI v2 Phase B), then recomputes ROI for
// every touched creator. Used by the cron route (src/app/api/cron/refresh)
// and runnable standalone via `npm run ingest`.

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformAdapter } from "./types";
import { YouTubeAdapter } from "./youtube";
import { SeededAdapter } from "./seeded";
import { recomputeContentSignals } from "@/lib/roi/content-signals";
import { recomputeRoiScores } from "@/lib/roi/recompute";

/** How many recent post/video titles to pull per account per run — enough
 * to ground topical-authority scoring without meaningfully adding to
 * per-account API cost. */
const RECENT_CONTENT_LIMIT = 10;

export interface RefreshOptions {
  /** Caps how many accounts one run touches. 200 YouTube accounts x ~3
   * quota units each = ~600/10,000 daily units — leaves ample headroom for
   * repeated runs and manual lookups the same day. */
  maxAccounts?: number;
}

export interface RefreshSummary {
  refreshed: number;
  failed: number;
  skipped: number;
  creatorIds: string[];
}

interface StaleAccountRow {
  id: string;
  creator_id: string;
  external_id: string | null;
  platforms: { slug: string } | null;
}

export async function refreshStaleAccounts(
  supabase: SupabaseClient,
  options: RefreshOptions = {},
): Promise<RefreshSummary> {
  const maxAccounts = options.maxAccounts ?? 200;

  const { data, error } = await supabase
    .from("creator_accounts")
    .select("id, creator_id, external_id, platforms(slug)")
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(maxAccounts);

  if (error) {
    throw new Error(`refreshStaleAccounts: failed to load accounts: ${error.message}`);
  }

  const accounts = (data as unknown as StaleAccountRow[]) ?? [];

  // Instantiate lazily so a missing YOUTUBE_API_KEY only skips YouTube
  // accounts instead of crashing the whole run (graceful degradation).
  let youtubeAdapter: YouTubeAdapter | null = null;
  try {
    youtubeAdapter = new YouTubeAdapter();
  } catch {
    console.warn("ingest: YOUTUBE_API_KEY not set — skipping YouTube accounts this run.");
  }
  const instagramAdapter = new SeededAdapter("instagram");
  const tiktokAdapter = new SeededAdapter("tiktok");

  function adapterFor(slug: string | undefined): PlatformAdapter | null {
    switch (slug) {
      case "youtube":
        return youtubeAdapter;
      case "instagram":
        return instagramAdapter;
      case "tiktok":
        return tiktokAdapter;
      default:
        return null;
    }
  }

  const touchedCreatorIds = new Set<string>();
  let refreshed = 0;
  let failed = 0;
  let skipped = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const account of accounts) {
    const adapter = adapterFor(account.platforms?.slug);
    if (!adapter || !account.external_id) {
      skipped += 1;
      continue;
    }

    try {
      const snapshot = await adapter.fetchAccount(account.external_id);

      const { error: metricError } = await supabase.from("account_metrics").upsert(
        {
          creator_account_id: account.id,
          snapshot_date: today,
          followers: snapshot.followers,
          total_views: snapshot.totalViews,
          avg_views: snapshot.avgViews,
          likes: snapshot.likes,
          comments: snapshot.comments,
          watch_hours: snapshot.watchHours,
          upload_count: snapshot.uploadCount,
        },
        { onConflict: "creator_account_id,snapshot_date" },
      );
      if (metricError) throw new Error(metricError.message);

      await supabase
        .from("creator_accounts")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", account.id);

      touchedCreatorIds.add(account.creator_id);
      refreshed += 1;
    } catch (err) {
      console.error(`ingest: failed to refresh account ${account.id}:`, err);
      failed += 1;
      continue;
    }

    // Best-effort: recent content titles ground topical-authority scoring
    // (ROI v2 Phase B). A failure here shouldn't undo the metrics write
    // above, so it's a separate try/catch and never bumps `failed`.
    try {
      const recent = await adapter.fetchRecentContent(account.external_id, RECENT_CONTENT_LIMIT);
      if (recent.length > 0) {
        const { error: contentError } = await supabase.from("creator_content_items").upsert(
          recent.map((item) => ({
            creator_account_id: account.id,
            external_id: item.externalId,
            title: item.title,
            published_at: item.publishedAt,
          })),
          { onConflict: "creator_account_id,external_id" },
        );
        if (contentError) throw new Error(contentError.message);
      }
    } catch (err) {
      console.warn(`ingest: failed to fetch recent content for account ${account.id}:`, err);
    }
  }

  if (touchedCreatorIds.size > 0) {
    // Relevance signals first, so this pass's ROI recompute sees them.
    try {
      await recomputeContentSignals(supabase, Array.from(touchedCreatorIds));
    } catch (err) {
      console.error("ingest: recomputeContentSignals failed (continuing to ROI recompute):", err);
    }
  }

  if (touchedCreatorIds.size > 0) {
    await recomputeRoiScores(supabase, { creatorIds: Array.from(touchedCreatorIds) });
  }

  return {
    refreshed,
    failed,
    skipped,
    creatorIds: Array.from(touchedCreatorIds),
  };
}

// Standalone entry point: `npm run ingest`. Wrapped in an async IIFE (rather
// than top-level await) so this file still transforms under tsx's default
// CommonJS mode for plain `.ts` files in a package.json with no "type" field.
//
// Comparing via fileURLToPath + realpathSync (not a raw `file://${argv[1]}`
// string) matters here: a plain string comparison breaks on any path
// containing spaces (URL-encoded in import.meta.url, not in argv[1]) or a
// symlinked temp dir (e.g. macOS /tmp -> /private/tmp).
function isMainModule(): boolean {
  if (!process.argv[1]) return false;
  try {
    return fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  (async () => {
    const { config } = await import("dotenv");
    config({ path: ".env.local", override: true });
    const { createClient } = await import("@supabase/supabase-js");

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
      process.exit(1);
    }

    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const summary = await refreshStaleAccounts(supabase);
    console.log(
      `Ingestion complete: ${summary.refreshed} refreshed, ${summary.failed} failed, ${summary.skipped} skipped (${summary.creatorIds.length} creators rescored).`,
    );
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
