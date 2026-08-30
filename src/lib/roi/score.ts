// Transparent ROI score: a 0-1000 composite over six components, each
// normalized 0-100 against a peer benchmark for the creator's category/tier,
// then weighted into the final score. See the build plan (Phase 3) for the
// rationale behind each component. Pure functions only — no I/O — so this
// can be unit-tested against fixtures and reused by the nightly recompute
// job, the ingestion pipeline, and the seed script.

import type { RoiComponents, RoiGrade } from "@/lib/types";

/** One daily (or otherwise regularly-spaced) snapshot for a creator, already
 * aggregated across all of their connected platform accounts.
 *
 * `followers`, `totalViews`, and `uploadCount` are cumulative channel totals
 * (what platform APIs expose directly — e.g. YouTube's `subscriberCount` /
 * `viewCount` / `videoCount`). `avgViews`, `likes`, and `comments` are
 * *per-recent-video averages* (derived by sampling the creator's last N
 * posts) — platforms don't expose lifetime cumulative likes/comments, so
 * this is the honestly-computable engagement signal. */
export interface CreatorMetricPoint {
  /** ISO date string, e.g. "2026-04-01". */
  date: string;
  followers: number;
  totalViews: number;
  avgViews: number;
  likes: number;
  comments: number;
  /** Cumulative lifetime upload/post count as of this snapshot. */
  uploadCount: number;
}

export interface CategoryBenchmark {
  /** [p10, p90] of log10(followers) across the category's creators. */
  followerLogRange: [number, number];
  /** [p10, p90] of log10(avg views per post) across the category. */
  avgViewsLogRange: [number, number];
  /** [p10, median, p90] of (likes+comments)/views across the category. */
  engagementRate: [number, number, number];
  /** Typical comments:likes ratio — used as an authenticity anchor. */
  commentLikeRatioMedian: number;
  /** Typical views:followers ratio per post — used as an authenticity anchor. */
  viewFollowerRatioMedian: number;
}

/** Reasonable cross-category defaults, used when a category doesn't yet have
 * enough peers (< MIN_PEERS_FOR_BENCHMARK) to compute its own distribution. */
export const DEFAULT_BENCHMARK: CategoryBenchmark = {
  followerLogRange: [3.5, 6.7], // ~3k to ~5M followers
  avgViewsLogRange: [3, 6], // ~1k to ~1M avg views
  engagementRate: [0.01, 0.035, 0.09],
  commentLikeRatioMedian: 0.06,
  viewFollowerRatioMedian: 0.35,
};

export const MIN_PEERS_FOR_BENCHMARK = 5;
export const MIN_HISTORY_DAYS = 30;
export const ALGO_VERSION = "v1";

const WEIGHTS = {
  reach: 0.2,
  engagement: 0.25,
  consistency: 0.15,
  trajectory: 0.2,
  tenure: 0.1,
  authenticity: 0.1,
} as const;

type ComponentKey = keyof typeof WEIGHTS;

export interface RoiComponentDetail {
  /** Raw 0-100 sub-score for this component. */
  raw: number;
  weight: number;
  /** raw * weight — these six numbers sum to the overall 0-100 composite. */
  weighted: number;
}

export type RoiComponentBreakdown = Record<ComponentKey, RoiComponentDetail>;

export interface RoiResult {
  /** 0-1000, or null when there isn't enough history to score yet. */
  score: number | null;
  grade: RoiGrade | null;
  components: RoiComponentBreakdown | Record<string, never>;
  algoVersion: string;
  reason?: string;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = clamp(Math.round((p / 100) * (sorted.length - 1)), 0, sorted.length - 1);
  return sorted[idx];
}

/** Min-max normalize a value that's already on a log scale, into 0-100. */
function normalizeLogRange(value: number, [lo, hi]: [number, number]): number {
  if (value <= 0) return 0;
  const logVal = Math.log10(value);
  if (hi <= lo) return 50;
  return clamp(((logVal - lo) / (hi - lo)) * 100, 0, 100);
}

/** How close `value` is to `[p10, p90]`, scaled 0-100 (below p10 -> 0,
 * above p90 -> 100, linear between). */
function normalizeRange(value: number, lo: number, hi: number): number {
  if (hi <= lo) return 50;
  return clamp(((value - lo) / (hi - lo)) * 100, 0, 100);
}

/** Ordinary least squares slope of y over an evenly-spaced index 0..n-1,
 * expressed as a fraction of the series' mean (so it's comparable across
 * creators of very different scale). */
function relativeSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const xs = values.map((_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  if (meanY === 0) return 0;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (values[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  // Slope per-day as a fraction of the mean value, then annualized-ish over
  // the window length so a fast-growing small creator isn't penalized for
  // having a small absolute slope.
  return (slope * n) / meanY;
}

function coefficientOfVariation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

function gradeFromScore(score: number): RoiGrade {
  if (score >= 850) return "A";
  if (score >= 700) return "B";
  if (score >= 550) return "C";
  if (score >= 400) return "D";
  return "F";
}

/** Sort ascending by date, guard against duplicate/out-of-order snapshots. */
function sortByDate(series: CreatorMetricPoint[]): CreatorMetricPoint[] {
  return [...series].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Compute a creator's ROI score.
 *
 * @param series Daily (or near-daily) snapshots, already aggregated across
 *   the creator's connected platform accounts, ideally covering the last
 *   ~180 days.
 * @param yearsActiveSince Calendar year of the creator's first upload/post.
 * @param benchmark Category peer benchmark (see computeCategoryBenchmark).
 * @param now Injectable clock for deterministic tests.
 */
export function computeRoiScore(
  series: CreatorMetricPoint[],
  yearsActiveSince: number | null,
  benchmark: CategoryBenchmark = DEFAULT_BENCHMARK,
  now: Date = new Date(),
): RoiResult {
  const sorted = sortByDate(series).filter(
    (p) => p.followers >= 0 && p.totalViews >= 0,
  );

  if (sorted.length === 0) {
    return {
      score: null,
      grade: null,
      components: {},
      algoVersion: ALGO_VERSION,
      reason: "No metrics history yet.",
    };
  }

  const first = new Date(sorted[0].date);
  const last = new Date(sorted[sorted.length - 1].date);
  const spanDays = (last.getTime() - first.getTime()) / 86_400_000;

  if (spanDays < MIN_HISTORY_DAYS) {
    return {
      score: null,
      grade: null,
      components: {},
      algoVersion: ALGO_VERSION,
      reason: `Needs ${MIN_HISTORY_DAYS} days of history (has ${Math.round(spanDays)}).`,
    };
  }

  // Look at the trailing 90-day window for the "current state" components
  // (reach, engagement, consistency) and the full available series for
  // trajectory, so a brand-new upload burst can't fake a long-term trend.
  const windowDays = 90;
  const windowStart = new Date(last.getTime() - windowDays * 86_400_000);
  const window = sorted.filter((p) => new Date(p.date) >= windowStart);
  const recent = window.length > 0 ? window : sorted;

  const latest = recent[recent.length - 1];

  // --- Reach: log-scaled followers + average views vs. category range ---
  const reachFollowers = normalizeLogRange(latest.followers, benchmark.followerLogRange);
  const reachViews = normalizeLogRange(
    latest.avgViews || latest.totalViews,
    benchmark.avgViewsLogRange,
  );
  const reach = (reachFollowers + reachViews) / 2;

  // --- Engagement quality: (likes+comments)/avgViews vs. category percentiles ---
  // avgViews (not totalViews) is the right denominator: likes/comments are
  // per-recent-video averages, not lifetime cumulative totals.
  const perVideoViews = latest.avgViews || latest.totalViews;
  const engagementRate =
    perVideoViews > 0 ? (latest.likes + latest.comments) / perVideoViews : 0;
  const [p10, , p90] = benchmark.engagementRate;
  const engagement = normalizeRange(engagementRate, p10, p90);

  // --- Consistency: coefficient of variation of gaps between upload days ---
  const uploadDays: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    if (recent[i].uploadCount > recent[i - 1].uploadCount) uploadDays.push(i);
  }
  let consistency: number;
  if (uploadDays.length < 2) {
    // Not enough upload events in the window to judge cadence — treat as
    // middling rather than penalizing a creator whose platform snapshot
    // cadence doesn't line up with their posting cadence.
    consistency = 50;
  } else {
    const gaps = uploadDays.slice(1).map((d, i) => d - uploadDays[i]);
    const cv = coefficientOfVariation(gaps);
    // cv=0 (perfectly regular) -> 100; cv>=1.5 (wildly irregular) -> 0.
    consistency = clamp(100 - (cv / 1.5) * 100, 0, 100);
  }

  // --- Trajectory: normalized slope of followers + views over the window ---
  const followerSlope = relativeSlope(recent.map((p) => p.followers));
  const viewSlope = relativeSlope(recent.map((p) => p.totalViews));
  // A slope of +30% of the mean over the window is treated as excellent
  // growth (100); flat or declining trends toward 0.
  const trajectory = clamp(
    50 + ((followerSlope + viewSlope) / 2 / 0.3) * 50,
    0,
    100,
  );

  // --- Tenure: years active, saturating at 5 years ---
  const currentYear = now.getFullYear();
  const years = yearsActiveSince ? Math.max(0, currentYear - yearsActiveSince) : 0;
  const tenure = clamp((years / 5) * 100, 0, 100);

  // --- Audience authenticity: comment:like and view:follower ratios vs. norms ---
  const commentLikeRatio = latest.likes > 0 ? latest.comments / latest.likes : 0;
  const viewFollowerRatio =
    latest.followers > 0 ? (latest.avgViews || latest.totalViews) / latest.followers : 0;
  const commentLikeCloseness =
    100 -
    clamp(
      (Math.abs(commentLikeRatio - benchmark.commentLikeRatioMedian) /
        Math.max(benchmark.commentLikeRatioMedian, 0.001)) *
        100,
      0,
      100,
    );
  const viewFollowerCloseness =
    100 -
    clamp(
      (Math.abs(viewFollowerRatio - benchmark.viewFollowerRatioMedian) /
        Math.max(benchmark.viewFollowerRatioMedian, 0.001)) *
        100,
      0,
      100,
    );
  const authenticity = (commentLikeCloseness + viewFollowerCloseness) / 2;

  const rawByComponent: Record<ComponentKey, number> = {
    reach,
    engagement,
    consistency,
    trajectory,
    tenure,
    authenticity,
  };

  const components = {} as RoiComponentBreakdown;
  let compositeOutOf100 = 0;
  for (const key of Object.keys(WEIGHTS) as ComponentKey[]) {
    const raw = clamp(rawByComponent[key], 0, 100);
    const weight = WEIGHTS[key];
    const weighted = raw * weight;
    components[key] = { raw: Math.round(raw * 10) / 10, weight, weighted };
    compositeOutOf100 += weighted;
  }

  const score = Math.round(compositeOutOf100 * 10); // 0-100 -> 0-1000

  return {
    score,
    grade: gradeFromScore(score),
    components,
    algoVersion: ALGO_VERSION,
  };
}

/** Flattens an RoiResult's components into the plain `RoiComponents` shape
 * stored in `roi_scores.components` (raw 0-100 sub-scores only). */
export function toStoredComponents(
  breakdown: RoiComponentBreakdown | Record<string, never>,
): RoiComponents | Record<string, never> {
  if (Object.keys(breakdown).length === 0) return {};
  const b = breakdown as RoiComponentBreakdown;
  return {
    reach: b.reach.raw,
    engagement: b.engagement.raw,
    consistency: b.consistency.raw,
    trajectory: b.trajectory.raw,
    tenure: b.tenure.raw,
    authenticity: b.authenticity.raw,
  };
}

/** Compute a category benchmark from a set of peers' latest snapshots. Falls
 * back to DEFAULT_BENCHMARK when the category doesn't have enough peers yet. */
export function computeCategoryBenchmark(
  peerLatestSnapshots: CreatorMetricPoint[],
): CategoryBenchmark {
  if (peerLatestSnapshots.length < MIN_PEERS_FOR_BENCHMARK) {
    return DEFAULT_BENCHMARK;
  }

  const followerLogs = peerLatestSnapshots
    .map((p) => (p.followers > 0 ? Math.log10(p.followers) : null))
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  const avgViewsLogs = peerLatestSnapshots
    .map((p) => {
      const v = p.avgViews || p.totalViews;
      return v > 0 ? Math.log10(v) : null;
    })
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  const engagementRates = peerLatestSnapshots
    .map((p) => {
      const v = p.avgViews || p.totalViews;
      return v > 0 ? (p.likes + p.comments) / v : null;
    })
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  const commentLikeRatios = peerLatestSnapshots
    .map((p) => (p.likes > 0 ? p.comments / p.likes : null))
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  const viewFollowerRatios = peerLatestSnapshots
    .map((p) => (p.followers > 0 ? (p.avgViews || p.totalViews) / p.followers : null))
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);

  return {
    followerLogRange: [percentile(followerLogs, 10), percentile(followerLogs, 90)],
    avgViewsLogRange: [percentile(avgViewsLogs, 10), percentile(avgViewsLogs, 90)],
    engagementRate: [
      percentile(engagementRates, 10),
      percentile(engagementRates, 50),
      percentile(engagementRates, 90),
    ],
    commentLikeRatioMedian: percentile(commentLikeRatios, 50) || DEFAULT_BENCHMARK.commentLikeRatioMedian,
    viewFollowerRatioMedian:
      percentile(viewFollowerRatios, 50) || DEFAULT_BENCHMARK.viewFollowerRatioMedian,
  };
}
