// Seeded (synthetic) adapter for platforms we don't have a funded data
// source for yet — Instagram and TikTok at MVP (see the build plan: Modash
// or Phyllo is the funded upgrade path, phase 2). Implements the exact same
// PlatformAdapter contract as the real YouTube adapter, so the UI, the
// orchestrator, and the ROI scorer can't tell the difference, and swapping
// in a paid aggregator later means writing one new file, not touching
// anything downstream.
//
// Every value is a deterministic function of (externalId, platform, day) —
// no randomness that isn't reproducible — so a demo creator's numbers
// evolve smoothly day over day instead of jumping around on every refresh.

import type { PlatformSlug } from "@/lib/types";
import type { AccountSnapshot, ContentItem, ExternalAccount, PlatformAdapter } from "./types";

const EPOCH = new Date("2024-01-01T00:00:00Z").getTime();
const DAY_MS = 86_400_000;

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic pseudo-random in [0, 1) from an integer seed. */
function rand(seed: number): number {
  const x = Math.sin(seed) * 43758.5453123;
  return x - Math.floor(x);
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

interface SeededProfile {
  baseFollowers: number;
  dailyGrowthRate: number;
  engagementRate: number;
  commentShare: number;
  createdYear: number;
}

function deriveProfile(externalId: string): SeededProfile {
  const seed = hashSeed(externalId);
  return {
    baseFollowers: 5_000 + Math.floor(rand(seed) * 400_000),
    dailyGrowthRate: 0.0015 + rand(seed + 1) * 0.004,
    engagementRate: 0.02 + rand(seed + 2) * 0.06,
    commentShare: 0.05 + rand(seed + 3) * 0.08,
    createdYear: 2015 + Math.floor(rand(seed + 4) * 9),
  };
}

function dayIndex(): number {
  return Math.floor((Date.now() - EPOCH) / DAY_MS);
}

export class SeededAdapter implements PlatformAdapter {
  constructor(readonly platform: Extract<PlatformSlug, "instagram" | "tiktok">) {}

  async resolveHandle(handle: string): Promise<ExternalAccount | null> {
    const trimmed = handle.trim().replace(/^@/, "");
    const slug = slugify(trimmed);
    const externalId = `seed-${this.platform}-${slug}`;
    const profile = deriveProfile(externalId);
    return {
      externalId,
      handle: trimmed,
      url: `https://${this.platform === "instagram" ? "instagram.com" : "tiktok.com"}/@${slug}`,
      createdYear: profile.createdYear,
      // Seeded platforms have no real public-profile text to parse; business
      // emails only ever come from a real integration or the creator
      // themselves at claim time.
      publicBusinessEmail: null,
    };
  }

  async fetchAccount(externalId: string): Promise<AccountSnapshot> {
    const profile = deriveProfile(externalId);
    const t = dayIndex();
    const seed = hashSeed(externalId) + t;

    const followers = Math.round(
      profile.baseFollowers * (1 + profile.dailyGrowthRate) ** t * (0.98 + rand(seed) * 0.04),
    );
    const totalViews = Math.round(followers * (8 + rand(seed + 10) * 12));
    const avgViews = Math.round(followers * (0.15 + rand(seed + 20) * 0.25));
    const likes = Math.round(avgViews * profile.engagementRate * (1 - profile.commentShare));
    const comments = Math.round(avgViews * profile.engagementRate * profile.commentShare);
    const uploadCount = 20 + Math.floor(t / 4);

    return {
      followers,
      totalViews,
      avgViews,
      likes,
      comments,
      watchHours: Math.round((totalViews * 0.5) / 60),
      uploadCount,
    };
  }

  async fetchRecentContent(externalId: string, limit: number): Promise<ContentItem[]> {
    const profile = deriveProfile(externalId);
    const t = dayIndex();
    const items: ContentItem[] = [];
    for (let i = 0; i < limit; i++) {
      const seed = hashSeed(externalId) + t - i * 3;
      const views = Math.round(profile.baseFollowers * (0.15 + rand(seed) * 0.3));
      items.push({
        externalId: `${externalId}-post-${t - i * 3}`,
        title: `Post ${t - i * 3}`,
        publishedAt: new Date(EPOCH + (t - i * 3) * DAY_MS).toISOString(),
        views,
        likes: Math.round(views * profile.engagementRate * (1 - profile.commentShare)),
        comments: Math.round(views * profile.engagementRate * profile.commentShare),
      });
    }
    return items;
  }
}
