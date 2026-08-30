// The adapter contract every platform integration implements. This is what
// lets Phase 2 ship with one real integration (YouTube) and one seeded one
// (Instagram/TikTok) behind an identical interface — swapping in a paid
// aggregator (Modash, Phyllo) later is a new file that implements this same
// contract, not a rewrite of the ingestion pipeline or the UI.

import type { PlatformSlug } from "@/lib/types";

export interface ExternalAccount {
  externalId: string;
  handle: string;
  url: string;
  /** Calendar year the account/channel was created, when available — feeds
   * years_active_since on the creator record. */
  createdYear: number | null;
  /** A business/contact email the creator has published themselves, when
   * the platform surfaces it in public profile text. Never scraped from
   * anything requiring auth or bypassing a CAPTCHA. */
  publicBusinessEmail: string | null;
}

/** One account-level snapshot, in the same shape as an account_metrics row
 * (minus ids/dates, which the orchestrator fills in). See the field-meaning
 * note in src/lib/roi/score.ts: followers/totalViews/uploadCount are
 * cumulative; avgViews/likes/comments are per-recent-video averages. */
export interface AccountSnapshot {
  followers: number;
  totalViews: number;
  avgViews: number;
  likes: number;
  comments: number;
  watchHours: number;
  uploadCount: number;
}

export interface ContentItem {
  externalId: string;
  title: string;
  publishedAt: string; // ISO date
  views: number;
  likes: number;
  comments: number;
}

export interface PlatformAdapter {
  platform: PlatformSlug;
  /** Resolve a human-entered handle/URL to the platform's canonical account. */
  resolveHandle(handle: string): Promise<ExternalAccount | null>;
  /** Fetch the current cumulative stats + a per-recent-video average. */
  fetchAccount(externalId: string): Promise<AccountSnapshot>;
  /** Fetch the account's N most recent posts, for engagement sampling and
   * upload-cadence tracking. */
  fetchRecentContent(externalId: string, limit: number): Promise<ContentItem[]>;
}

/** Roughly how many quota units (YouTube) or requests (others) one full
 * refresh of a single account costs — used by the orchestrator to size a
 * cron batch against a daily quota. */
export interface AdapterCostEstimate {
  unitsPerRefresh: number;
}
