// ROI Score v2 — a defensible, FICO-shaped creator sponsorship score.
//
// Architecture follows the four-layer model in "Data-Backed Creator
// Sponsorship ROI Scoring Framework" (research doc, not checked into the
// repo): peer-cohort percentile normalization -> reliability shrinkage ->
// transparent weighted aggregation -> (future) historical-ROI calibration.
// Three deliberate departures from that framework, decided with the product
// owner:
//
//  1. Higher = better, 0-1000, grades A-F — like FICO (the framework inverts
//     this; we rejected that without a strong reason to invert).
//  2. Tiered scoring: only pillars/variables with a real, live data source
//     are weighted. Baseline weights for not-yet-built pillars (relevance,
//     commercial, most of deal economics) are documented below but
//     renormalized away to 0 until their phase lands (LLM content signals,
//     creator-declared pricing, YouTube Analytics OAuth, campaign outcomes —
//     see the ROI Score v2 plan). This is safe *at cold start* because
//     missingness is uniform (nobody has campaign data yet, so it carries no
//     signal); it should tighten to shrink-toward-neutral once some
//     creators connect a data source and others decline one.
//  3. Fraud/anomaly signals apply a soft, capped multiplicative penalty —
//     never a hard gate to the worst score. Publishing an outright fraud
//     determination about a named real person carries real legal exposure;
//     a bad actor also can't fully average their way back to respectable,
//     since the penalty also caps overall confidence.
//
// Pure functions only — no I/O — so this is unit-testable and reusable by
// the nightly recompute job, the ingestion pipeline, and the seed script.

import type { RoiComponents, RoiGrade, RoiPillarKey, RoiReason } from "@/lib/types";

/** One daily (or otherwise regularly-spaced) snapshot for a creator, already
 * aggregated across all of their connected platform accounts.
 *
 * `followers`, `totalViews`, `uploadCount`, and `watchHours` are cumulative
 * channel totals (what platform APIs expose directly — e.g. YouTube's
 * `subscriberCount` / `viewCount` / `videoCount`). `avgViews`, `likes`, and
 * `comments` are *per-recent-video averages* (derived by sampling the
 * creator's last N posts) — platforms don't expose lifetime cumulative
 * likes/comments, so this is the honestly-computable engagement signal.
 *
 * `watchHours` is real only via authenticated YouTube Analytics (not yet
 * built — see Phase D of the ROI Score v2 plan); today's ingest paths either
 * write 0 (the public YouTube Data API doesn't expose it) or a rough
 * estimate. The scorer treats `watchHours <= 0` as "no data" and
 * renormalizes the watch-time variable away for that creator, so this
 * degrades honestly rather than silently trusting a placeholder. */
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
  /** Cumulative lifetime watch hours as of this snapshot, or 0 if unknown. */
  watchHours: number;
}

export const ALGO_VERSION = "v2";
export const MIN_PEERS_FOR_BENCHMARK = 5;
export const MIN_HISTORY_DAYS = 30;

// ---------------------------------------------------------------------------
// Small numeric utilities
// ---------------------------------------------------------------------------

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Median absolute deviation — a robust spread measure used for the
 * cadence target-tolerance so a few irregular creators don't distort it. */
function medianAbsoluteDeviation(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const m = median(sorted);
  const deviations = sorted.map((v) => Math.abs(v - m)).sort((a, b) => a - b);
  return median(deviations);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = clamp(Math.round((p / 100) * (sorted.length - 1)), 0, sorted.length - 1);
  return sorted[idx];
}

/** Winsorize a sorted array at [p1, p99] — clip outliers to the boundary
 * rather than dropping them, per the framework's outlier-treatment guidance.
 * Must run *after* raw values are available for anomaly detection, since
 * winsorizing first would erase the very spikes that signal fraud. */
function winsorize(sorted: number[]): number[] {
  if (sorted.length < 5) return sorted;
  const lo = percentile(sorted, 1);
  const hi = percentile(sorted, 99);
  return sorted.map((v) => clamp(v, lo, hi));
}

/** Empirical-CDF percentile rank of `value` within `sorted`, using the
 * framework's mid-rank formula `(rank - 0.5) / N` so no observation lands
 * on an exact 0 or 100. Ties are averaged. Returns 50 (neutral) when there's
 * no cohort data at all. */
function percentileRank(sorted: number[], value: number): number {
  if (sorted.length === 0) return 50;
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= value) lo = mid + 1;
    else hi = mid;
  }
  const countLE = lo;
  lo = 0;
  hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  const countLT = lo;
  const rank = (countLE + countLT) / 2;
  return clamp(((rank - 0.5) / sorted.length) * 100, 0, 100);
}

/** Reliability shrinkage toward neutral: q' = 50 + r(q - 50). A perfectly
 * reliable (r=1) measurement passes through unchanged; an unreliable one
 * (r->0) collapses toward 50 rather than counting fully either way. */
function shrinkToward50(raw: number, reliability: number): number {
  return 50 + clamp(reliability, 0, 1) * (raw - 50);
}

/** Beta-binomial shrinkage for a rate computed from a small denominator, so
 * e.g. 2 conversions from 2 views doesn't score identically to 10,000 from
 * 10,000. `priorMean` is the cohort's typical rate; `priorStrength` is how
 * many pseudo-observations that prior is worth. */
function shrinkRate(
  successes: number,
  trials: number,
  priorMean: number,
  priorStrength: number,
): number {
  if (trials <= 0) return priorMean;
  const alpha = priorMean * priorStrength;
  const beta = (1 - priorMean) * priorStrength;
  return (successes + alpha) / (trials + alpha + beta);
}

/** Target-optimal (Gaussian) scoring — both too-low and too-high are
 * undesirable, e.g. posting cadence. */
function targetOptimal(value: number, target: number, tolerance: number): number {
  if (tolerance <= 0) return value === target ? 100 : 0;
  return clamp(100 * Math.exp(-0.5 * ((value - target) / tolerance) ** 2), 0, 100);
}

/** Ordinary least squares slope of y over an evenly-spaced index 0..n-1,
 * expressed as a fraction of the series' mean (so it's comparable across
 * creators of very different scale) and annualized-ish over the window.
 * Exported so recompute.ts can build a peer cohort's growth distribution
 * from full series (computeCategoryBenchmark only sees latest snapshots). */
export function relativeSlope(values: number[]): number {
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
  return (slope * n) / meanY;
}

function gradeFromScore(score: number): RoiGrade {
  if (score >= 850) return "A";
  if (score >= 700) return "B";
  if (score >= 550) return "C";
  if (score >= 400) return "D";
  return "F";
}

function sortByDate(series: CreatorMetricPoint[]): CreatorMetricPoint[] {
  return [...series].sort((a, b) => a.date.localeCompare(b.date));
}

/** Hootsuite-style creator size tiers — used to build a size-matched peer
 * cohort for everything *except* audience size itself, which the framework
 * explicitly warns should stay category-wide (tier-restricting it would
 * eliminate the scale signal it's meant to measure). */
export type SizeTier = "nano" | "micro" | "mid" | "macro" | "mega";

export function sizeTierFor(followers: number): SizeTier {
  if (followers < 10_000) return "nano";
  if (followers < 50_000) return "micro";
  if (followers < 500_000) return "mid";
  if (followers < 1_000_000) return "macro";
  return "mega";
}

// ---------------------------------------------------------------------------
// Pillars and variable weights
// ---------------------------------------------------------------------------

/** Documented baseline weights (sum to 100), adapted from the framework's
 * 14/17/18/15/22/9/5 split. Scale is cut hard and attention/trust raised —
 * the framework's central thesis is that a large audience shouldn't
 * automatically outrank a smaller one with better attention, trust and
 * economics; the sketch this replaces put 40% on scale+growth alone.
 * "commercial" and "deal" stay documented for Phases C/E even though they
 * contribute 0 today — a pillar only ever weighs in for a creator when it
 * has at least one live, non-missing variable; see combinePillars() and the
 * per-creator active-pillar derivation in computeRoiScore(). "relevance"
 * went live in Phase B (topical authority only, from content-signals.ts). */
export const PILLAR_BASELINE_WEIGHTS: Record<RoiPillarKey, number> = {
  scale: 8,
  attention: 26,
  trust: 26,
  relevance: 12,
  commercial: 20,
  deal: 6,
  governance: 2,
};

type ScaleVariable = "audienceSize" | "reachEfficiency" | "trajectory" | "platformMix";
type AttentionVariable = "engagement" | "watchTime" | "cadence";
type TrustVariable = "authenticity";
type RelevanceVariable = "topicalAuthority";
type GovernanceVariable = "tenure";

const SCALE_WEIGHTS: Record<ScaleVariable, number> = {
  audienceSize: 0.15,
  reachEfficiency: 0.3,
  trajectory: 0.4,
  platformMix: 0.15,
};
const ATTENTION_WEIGHTS: Record<AttentionVariable, number> = {
  engagement: 0.45,
  watchTime: 0.35,
  cadence: 0.2,
};
const TRUST_WEIGHTS: Record<TrustVariable, number> = { authenticity: 1 };
const RELEVANCE_WEIGHTS: Record<RelevanceVariable, number> = { topicalAuthority: 1 };
const GOVERNANCE_WEIGHTS: Record<GovernanceVariable, number> = { tenure: 1 };

/** Reliability priors (0-1) by data provenance, per the framework's rating
 * table (authenticated API ~0.9, modeled/derived ~0.55-0.8, self-reported
 * ~0.4). watchTime is capped at 0.5 until Phase D replaces today's proxy
 * with real YouTube Analytics average view duration. topicalAuthority sits
 * at "medium, modeled" — an LLM judgment grounded in real profile/content
 * text, not an authenticated measurement. */
const RELIABILITY: Record<
  ScaleVariable | AttentionVariable | TrustVariable | RelevanceVariable | GovernanceVariable,
  number
> = {
  audienceSize: 0.85,
  reachEfficiency: 0.8,
  trajectory: 0.75,
  platformMix: 0.85,
  engagement: 0.8,
  watchTime: 0.5,
  cadence: 0.7,
  authenticity: 0.65,
  topicalAuthority: 0.55,
  tenure: 0.6,
};

const REASON_LABELS: Record<string, { positive: string; negative: string; pillar: RoiPillarKey }> = {
  audienceSize: { positive: "Large audience for the category", negative: "Small audience for the category", pillar: "scale" },
  reachEfficiency: { positive: "Views punch above follower count", negative: "Views lag follower count", pillar: "scale" },
  trajectory: { positive: "Growing faster than category peers", negative: "Growing slower than category peers", pillar: "scale" },
  platformMix: { positive: "Diversified audience across platforms", negative: "Reliant on a single platform", pillar: "scale" },
  engagement: { positive: "Strong engagement vs. category peers", negative: "Weak engagement vs. category peers", pillar: "attention" },
  watchTime: { positive: "Strong average watch time", negative: "Weak average watch time", pillar: "attention" },
  cadence: { positive: "Consistent, predictable posting cadence", negative: "Irregular posting cadence", pillar: "attention" },
  authenticity: { positive: "Audience response looks organic", negative: "Audience response looks unusual", pillar: "trust" },
  topicalAuthority: { positive: "Demonstrates real topical expertise", negative: "Content shows limited topical depth", pillar: "relevance" },
  tenure: { positive: "Long track record creating content", negative: "Limited track record creating content", pillar: "governance" },
};

// ---------------------------------------------------------------------------
// Category benchmark
// ---------------------------------------------------------------------------

export interface CategoryBenchmark {
  /** Sorted, winsorized log10(followers) — category-wide (not size-tier
   * restricted; see sizeTierFor's doc comment for why). */
  followerSamplesLog: number[];
  /** Sorted, winsorized avgViews/followers ratio — size-tier peers. */
  reachEfficiencySamples: number[];
  /** Sorted, winsorized relativeSlope of followers+views — size-tier peers. */
  growthSamples: number[];
  /** Sorted, winsorized (likes+comments)/avgViews — size-tier peers. */
  engagementSamples: number[];
  /** Sorted, winsorized minutes watched per view — size-tier peers. */
  watchMinutesPerViewSamples: number[];
  /** Sorted gaps (days) between upload events — size-tier peers; used to
   * derive a target-optimal cadence rather than a fixed constant. */
  cadenceGapDaySamples: number[];
  /** Median comment:like ratio — size-tier peers; authenticity anchor. */
  commentLikeRatioMedian: number;
  /** Median avgViews:followers ratio — size-tier peers; authenticity anchor. */
  viewFollowerRatioMedian: number;
  sampleSize: number;
}

/** Hand-authored synthetic distributions, calibrated so a mid-pack creator
 * lands near the 50th percentile. Used whenever a real peer cohort is too
 * thin (< MIN_PEERS_FOR_BENCHMARK) — per-field, so a category with enough
 * peers for audience size but not yet for engagement uses real data for one
 * and the synthetic fallback for the other. */
export const DEFAULT_BENCHMARK: CategoryBenchmark = {
  followerSamplesLog: [3.0, 3.3, 3.6, 3.9, 4.2, 4.5, 4.8, 5.1, 5.4, 5.7, 6.0, 6.3, 6.7],
  reachEfficiencySamples: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.55, 0.7, 0.9, 1.2],
  growthSamples: [-0.6, -0.35, -0.2, -0.1, -0.03, 0.0, 0.05, 0.12, 0.22, 0.35, 0.55, 0.85, 1.3],
  engagementSamples: [0.002, 0.005, 0.008, 0.01, 0.015, 0.02, 0.028, 0.035, 0.045, 0.06, 0.09, 0.14, 0.22],
  watchMinutesPerViewSamples: [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.2, 5.0, 5.8, 6.5, 7.5, 9.0],
  cadenceGapDaySamples: [1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7.5, 9, 12, 16],
  commentLikeRatioMedian: 0.06,
  viewFollowerRatioMedian: 0.35,
  sampleSize: 0,
};

function arrOrDefault(real: number[], fallback: number[]): number[] {
  return real.length >= MIN_PEERS_FOR_BENCHMARK ? winsorize([...real].sort((a, b) => a - b)) : fallback;
}

/**
 * Build a peer-cohort benchmark. `categoryPeers` should be every creator's
 * latest snapshot in the category (any size) — used only for audience size.
 * `tierPeers` should be latest snapshots restricted to creators in the same
 * category *and* the same size tier as the creator being scored — used for
 * everything else, so e.g. growth is judged against similarly-sized peers
 * rather than lumping a 1K and 1M creator together.
 */
export function computeCategoryBenchmark(
  categoryPeers: CreatorMetricPoint[],
  tierPeers: CreatorMetricPoint[],
): CategoryBenchmark {
  const followerLogs = categoryPeers
    .map((p) => (p.followers > 0 ? Math.log10(p.followers) : null))
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);

  const reachEff = tierPeers
    .map((p) => (p.followers > 0 ? (p.avgViews || p.totalViews) / p.followers : null))
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);

  // Growth needs at least two points per creator; with only latest
  // snapshots available here we approximate cohort growth spread from the
  // default distribution unless the caller supplies real series elsewhere.
  // (recomputeRoiScores widens this — see src/lib/roi/recompute.ts.)
  const engagementRates = tierPeers
    .map((p) => {
      const v = p.avgViews || p.totalViews;
      return v > 0 ? (p.likes + p.comments) / v : null;
    })
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);

  const watchRatios = tierPeers
    .map((p) => {
      const v = p.avgViews || p.totalViews;
      return v > 0 && p.watchHours > 0 ? (p.watchHours * 60) / Math.max(1, p.totalViews) : null;
    })
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);

  const commentLikeRatios = tierPeers
    .map((p) => (p.likes > 0 ? p.comments / p.likes : null))
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  const viewFollowerRatios = tierPeers
    .map((p) => (p.followers > 0 ? (p.avgViews || p.totalViews) / p.followers : null))
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);

  // Same MIN_PEERS_FOR_BENCHMARK gate as arrOrDefault, but for a single
  // median value rather than a full sample array — a thin cohort (or, worst
  // case, a cohort of exactly the creator being scored) must not silently
  // become the creator's own value via `median(...) || fallback`, since
  // `median` of a single real (nonzero) observation is truthy and would
  // never hit that fallback.
  const commentLikeRatioMedian =
    commentLikeRatios.length >= MIN_PEERS_FOR_BENCHMARK
      ? median(commentLikeRatios)
      : DEFAULT_BENCHMARK.commentLikeRatioMedian;
  const viewFollowerRatioMedian =
    viewFollowerRatios.length >= MIN_PEERS_FOR_BENCHMARK
      ? median(viewFollowerRatios)
      : DEFAULT_BENCHMARK.viewFollowerRatioMedian;

  return {
    followerSamplesLog: arrOrDefault(followerLogs, DEFAULT_BENCHMARK.followerSamplesLog),
    reachEfficiencySamples: arrOrDefault(reachEff, DEFAULT_BENCHMARK.reachEfficiencySamples),
    growthSamples: DEFAULT_BENCHMARK.growthSamples, // widened per-creator in recompute.ts
    engagementSamples: arrOrDefault(engagementRates, DEFAULT_BENCHMARK.engagementSamples),
    watchMinutesPerViewSamples: arrOrDefault(watchRatios, DEFAULT_BENCHMARK.watchMinutesPerViewSamples),
    cadenceGapDaySamples: DEFAULT_BENCHMARK.cadenceGapDaySamples, // widened per-creator in recompute.ts
    commentLikeRatioMedian,
    viewFollowerRatioMedian,
    sampleSize: tierPeers.length,
  };
}

/** Allows recompute.ts to inject real cohort growth/cadence samples (which
 * need full series, not just latest snapshots, so they can't be computed
 * inside computeCategoryBenchmark). Returns a new benchmark; does not
 * mutate. */
export function withCohortSeries(
  benchmark: CategoryBenchmark,
  growthSamples: number[],
  cadenceGapDaySamples: number[],
): CategoryBenchmark {
  return {
    ...benchmark,
    growthSamples: arrOrDefault(growthSamples, DEFAULT_BENCHMARK.growthSamples),
    cadenceGapDaySamples: arrOrDefault(cadenceGapDaySamples, DEFAULT_BENCHMARK.cadenceGapDaySamples),
  };
}

// ---------------------------------------------------------------------------
// Per-variable scoring (each exported for direct unit testing)
// ---------------------------------------------------------------------------

/** Asymmetric authenticity band, fixing the old symmetric-closeness bug
 * (which scored a creator at 2x the category median identically to one at
 * 0 — punishing unusually high, and usually genuine, engagement as hard as
 * an absence of it). Wide comfortable band [0.5x, 3x] median scores ~100;
 * decays gently below and above; never floors to 0 — the soft fraud
 * dampener (not this function) is what handles truly implausible values. */
export function authenticityBandScore(ratio: number, cohortMedian: number): number {
  if (cohortMedian <= 0) return 50;
  const x = ratio / cohortMedian;
  if (x >= 0.5 && x <= 3) return 100;
  if (x < 0.5) {
    // Linear decay from 100 at 0.5x down to a 15-point floor at 0.1x.
    return clamp(15 + (85 * clamp(x, 0, 0.5)) / 0.5, 15, 100);
  }
  // x > 3: gentle decay from 100 at 3x down to a 30-point floor at 8x+.
  return clamp(100 - (70 * clamp(x - 3, 0, 5)) / 5, 30, 100);
}

/** Cohort-relative growth score — the fix for the old "+30% over the window
 * = 100, flat for everyone" formula, which treated a given growth rate as
 * equally significant regardless of creator size (trivial for a 1K creator,
 * extraordinary for a 1M one). By scoring the *same* relativeSlope() value
 * against a size-tier-matched peer distribution instead of one universal
 * curve, an identical growth rate correctly reads as merely average against
 * fast-moving small-creator peers and exceptional against a mostly-flat
 * mega-creator cohort. Exported standalone for direct unit testing. */
export function trajectoryPercentile(
  followerSlope: number,
  viewSlope: number,
  growthSamples: number[],
): number {
  return percentileRank(growthSamples, (followerSlope + viewSlope) / 2);
}

interface VariableScore {
  raw: number;
  weight: number;
  reliability: number;
  missing: boolean;
}

function scored(raw: number, weight: number, reliability: number): VariableScore {
  return { raw: clamp(raw, 0, 100), weight, reliability, missing: false };
}
function missingVariable(weight: number, reliability: number): VariableScore {
  return { raw: 50, weight, reliability, missing: true };
}

// ---------------------------------------------------------------------------
// Fraud / anomaly detection — soft, multi-signal, never a hard gate
// ---------------------------------------------------------------------------

export interface AnomalySignals {
  suddenFollowerSpike: boolean;
  lowEngagementHighViews: boolean;
  implausibleViewToFollowerRatio: boolean;
}

/** Multi-signal anomaly check, kept deliberately independent of the
 * authenticity band above so the same suspicious pattern isn't penalized
 * twice under different names (the framework's anti-double-counting rule).
 * One signal -> mild soft penalty; multiple independent signals -> material
 * penalty. Never returns a value that zeroes a score outright. */
export function detectAnomalySignals(
  series: CreatorMetricPoint[],
  engagementPercentile: number,
  reachEfficiency: number,
): AnomalySignals {
  let suddenFollowerSpike = false;
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1].followers;
    if (prev > 0 && (series[i].followers - prev) / prev > 0.12) {
      suddenFollowerSpike = true;
      break;
    }
  }
  return {
    suddenFollowerSpike,
    lowEngagementHighViews: engagementPercentile < 5 && reachEfficiency > 0.5,
    implausibleViewToFollowerRatio: reachEfficiency > 2.5,
  };
}

const PENALTY_BY_SIGNAL_COUNT = [0, 0.15, 0.35, 0.6];

export function fraudPenaltyFraction(signals: AnomalySignals): number {
  const count = Object.values(signals).filter(Boolean).length;
  return PENALTY_BY_SIGNAL_COUNT[Math.min(count, PENALTY_BY_SIGNAL_COUNT.length - 1)];
}

// ---------------------------------------------------------------------------
// Pillar combination — exported standalone so tests can validate the
// aggregation math independent of our specific variable definitions (e.g.
// against the framework's own worked-example pillar values and weights).
// ---------------------------------------------------------------------------

/** Weighted sum of pillar values (each 0-100) into a 0-100 utility U, with
 * `weights` renormalized to sum to 100 across whatever keys are present in
 * `pillarValues` — implements both the framework's `U = Σwᵢqᵢ/100` and our
 * tiered-renormalization departure from it in one function. */
export function combinePillars(
  pillarValues: Partial<Record<string, number>>,
  weights: Record<string, number>,
): number {
  const activeKeys = Object.keys(pillarValues).filter((k) => pillarValues[k] !== undefined);
  const totalActiveWeight = activeKeys.reduce((s, k) => s + (weights[k] ?? 0), 0);
  if (totalActiveWeight <= 0) return 0;
  let u = 0;
  for (const key of activeKeys) {
    const effectiveWeight = (weights[key] ?? 0) / totalActiveWeight; // fraction, sums to 1
    u += effectiveWeight * (pillarValues[key] as number);
  }
  return u;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export interface RoiResult {
  /** 0-1000, or null when there isn't enough history to score yet. */
  score: number | null;
  grade: RoiGrade | null;
  /** 0-1 overall confidence, or null alongside a null score. */
  confidence: number | null;
  reasons: RoiReason[];
  components: RoiComponents;
  algoVersion: string;
  reason?: string;
}

export function computeRoiScore(
  series: CreatorMetricPoint[],
  yearsActiveSince: number | null,
  benchmark: CategoryBenchmark = DEFAULT_BENCHMARK,
  now: Date = new Date(),
  options: {
    activePlatformCount?: number;
    /** 0-100, from content-signals.ts's scoreTopicalAuthority(). Undefined
     * or null when never scored — the relevance pillar then simply doesn't
     * activate for this creator, per tiered scoring. */
    topicalAuthority?: number | null;
  } = {},
): RoiResult {
  const sorted = sortByDate(series).filter((p) => p.followers >= 0 && p.totalViews >= 0);

  if (sorted.length === 0) {
    return {
      score: null,
      grade: null,
      confidence: null,
      reasons: [],
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
      confidence: null,
      reasons: [],
      components: {},
      algoVersion: ALGO_VERSION,
      reason: `Needs ${MIN_HISTORY_DAYS} days of history (has ${Math.round(spanDays)}).`,
    };
  }

  // Trailing 90-day window for "current state" variables (reach, engagement,
  // cadence, authenticity, watch time); the full series for trajectory, so a
  // brand-new upload burst can't fake a long-term trend.
  const windowDays = 90;
  const windowStart = new Date(last.getTime() - windowDays * 86_400_000);
  const window = sorted.filter((p) => new Date(p.date) >= windowStart);
  const recent = window.length > 0 ? window : sorted;
  const latest = recent[recent.length - 1];

  // ---- Scale & delivery ----
  const audienceSizeRaw = percentileRank(benchmark.followerSamplesLog, Math.log10(Math.max(1, latest.followers)));
  const audienceSize = scored(audienceSizeRaw, SCALE_WEIGHTS.audienceSize, RELIABILITY.audienceSize);

  const reachEfficiencyValue = latest.followers > 0 ? (latest.avgViews || latest.totalViews) / latest.followers : 0;
  const reachEfficiencyRaw = percentileRank(benchmark.reachEfficiencySamples, reachEfficiencyValue);
  const reachEfficiency = scored(reachEfficiencyRaw, SCALE_WEIGHTS.reachEfficiency, RELIABILITY.reachEfficiency);

  const followerSlope = clamp(relativeSlope(sorted.map((p) => p.followers)), -3, 5);
  const viewSlope = clamp(relativeSlope(sorted.map((p) => p.totalViews)), -3, 5);
  const trajectoryRaw = trajectoryPercentile(followerSlope, viewSlope, benchmark.growthSamples);
  const trajectory = scored(trajectoryRaw, SCALE_WEIGHTS.trajectory, RELIABILITY.trajectory);

  const activePlatformCount = Math.max(1, options.activePlatformCount ?? 1);
  const platformMixRaw = clamp(40 + 25 * Math.log(1 + activePlatformCount), 0, 100);
  const platformMix = scored(platformMixRaw, SCALE_WEIGHTS.platformMix, RELIABILITY.platformMix);

  // ---- Attention & engagement ----
  const perVideoViews = latest.avgViews || latest.totalViews;
  const rawEngagementRate = perVideoViews > 0 ? (latest.likes + latest.comments) / perVideoViews : 0;
  const cohortEngagementMean = median(benchmark.engagementSamples) || DEFAULT_BENCHMARK.engagementSamples[6];
  const shrunkEngagementRate = shrinkRate(latest.likes + latest.comments, perVideoViews, cohortEngagementMean, 200);
  const engagementRaw = percentileRank(benchmark.engagementSamples, shrunkEngagementRate);
  const engagement = scored(engagementRaw, ATTENTION_WEIGHTS.engagement, RELIABILITY.engagement);
  // Unshrunk percentile, used only for fraud-signal detection below — the
  // shrinkage that protects small creators from noise would also mask the
  // exact pattern (huge views, near-zero raw engagement) fraud detection
  // needs to see.
  const rawEngagementPercentile = percentileRank(benchmark.engagementSamples, rawEngagementRate);

  const watchMinutesPerView = latest.watchHours > 0 ? (latest.watchHours * 60) / Math.max(1, latest.totalViews) : null;
  const watchTime =
    watchMinutesPerView === null
      ? missingVariable(ATTENTION_WEIGHTS.watchTime, RELIABILITY.watchTime)
      : scored(
          percentileRank(benchmark.watchMinutesPerViewSamples, watchMinutesPerView),
          ATTENTION_WEIGHTS.watchTime,
          RELIABILITY.watchTime,
        );

  // Real calendar-day gaps between upload events (fixes the old bug that
  // counted snapshot array indices, so a missed cron run read as a cadence
  // gap even though no real-world gap occurred).
  const uploadDates: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    if (recent[i].uploadCount > recent[i - 1].uploadCount) {
      uploadDates.push(new Date(recent[i].date).getTime());
    }
  }
  let cadence: VariableScore;
  if (uploadDates.length < 2) {
    cadence = missingVariable(ATTENTION_WEIGHTS.cadence, RELIABILITY.cadence);
  } else {
    const gapsDays = uploadDates.slice(1).map((t, i) => (t - uploadDates[i]) / 86_400_000);
    const sortedGaps = [...gapsDays].sort((a, b) => a - b);
    const target = median(benchmark.cadenceGapDaySamples) || 4;
    const tolerance = Math.max(1, medianAbsoluteDeviation(sortedGaps) * 1.5 || target * 0.6);
    const typicalGap = median(sortedGaps);
    cadence = scored(targetOptimal(typicalGap, target, tolerance), ATTENTION_WEIGHTS.cadence, RELIABILITY.cadence);
  }

  // ---- Audience trust & quality ----
  const commentLikeRatio = latest.likes > 0 ? latest.comments / latest.likes : 0;
  const viewFollowerRatio = latest.followers > 0 ? (latest.avgViews || latest.totalViews) / latest.followers : 0;
  const authenticityRaw =
    (authenticityBandScore(commentLikeRatio, benchmark.commentLikeRatioMedian) +
      authenticityBandScore(viewFollowerRatio, benchmark.viewFollowerRatioMedian)) /
    2;

  const anomalySignals = detectAnomalySignals(recent, rawEngagementPercentile, reachEfficiencyValue);
  const penaltyFraction = fraudPenaltyFraction(anomalySignals);
  const authenticity = scored(
    authenticityRaw * (1 - penaltyFraction),
    TRUST_WEIGHTS.authenticity,
    RELIABILITY.authenticity,
  );

  // ---- Relevance & authority (Phase B: topical authority only — see
  // content-signals.ts for why brand fit/content relevance stay out of this
  // creator-absolute score, and why production quality/sentiment aren't
  // implemented at all yet). ----
  const topicalAuthority =
    options.topicalAuthority == null
      ? missingVariable(RELEVANCE_WEIGHTS.topicalAuthority, RELIABILITY.topicalAuthority)
      : scored(options.topicalAuthority, RELEVANCE_WEIGHTS.topicalAuthority, RELIABILITY.topicalAuthority);

  // ---- Governance & future ----
  const currentYear = now.getFullYear();
  const years = yearsActiveSince ? Math.max(0, currentYear - yearsActiveSince) : 0;
  const tenure = scored(clamp((years / 5) * 100, 0, 100), GOVERNANCE_WEIGHTS.tenure, RELIABILITY.tenure);

  // ---- Combine variables -> pillar raw scores (variable-level reliability
  // shrink first, then a weight-renormalized average over non-missing
  // variables — the per-creator half of tiered renormalization). `present`
  // tracks whether the pillar has ANY live variable for this creator, which
  // is what makes pillar activation dynamic rather than a fixed constant —
  // relevance activates the moment a creator has a topicalAuthority score,
  // with zero other code changes needed here. ----
  function combineVariables(vars: Record<string, VariableScore>): {
    raw: number;
    confidence: number;
    present: boolean;
  } {
    const present = Object.values(vars).filter((v) => !v.missing);
    if (present.length === 0) return { raw: 50, confidence: 0, present: false };
    const totalWeight = present.reduce((s, v) => s + v.weight, 0);
    let raw = 0;
    let confidenceNum = 0;
    for (const v of present) {
      const w = v.weight / totalWeight;
      raw += w * shrinkToward50(v.raw, v.reliability);
      confidenceNum += w * v.reliability;
    }
    return { raw: clamp(raw, 0, 100), confidence: clamp(confidenceNum, 0, 1), present: true };
  }

  const scalePillar = combineVariables({ audienceSize, reachEfficiency, trajectory, platformMix });
  const attentionPillar = combineVariables({ engagement, watchTime, cadence });
  const trustPillar = combineVariables({ authenticity });
  const relevancePillar = combineVariables({ topicalAuthority });
  const commercialPillar = combineVariables({}); // Phase E
  const dealPillar = combineVariables({}); // Phase C
  const governancePillar = combineVariables({ tenure });

  // Fraud additionally caps overall confidence, so a bad actor can't fully
  // average their way back to a high-confidence score even if other pillars
  // look clean.
  const confidenceCap = 1 - penaltyFraction;

  const pillarResults: Record<RoiPillarKey, { raw: number; confidence: number; present: boolean }> = {
    scale: scalePillar,
    attention: attentionPillar,
    trust: trustPillar,
    relevance: relevancePillar,
    commercial: commercialPillar,
    deal: dealPillar,
    governance: governancePillar,
  };
  const activePillars = (Object.keys(pillarResults) as RoiPillarKey[]).filter(
    (k) => pillarResults[k].present,
  );
  const activeWeightTotal = activePillars.reduce((s, k) => s + PILLAR_BASELINE_WEIGHTS[k], 0);

  const pillarRaws: Partial<Record<RoiPillarKey, number>> = {};
  for (const key of activePillars) pillarRaws[key] = pillarResults[key].raw;

  const utility = combinePillars(pillarRaws, PILLAR_BASELINE_WEIGHTS);
  const score = Math.round(clamp(utility, 0, 100) * 10);

  const components: RoiComponents = {};
  let overallConfidenceNum = 0;
  for (const key of activePillars) {
    const effectiveWeight = PILLAR_BASELINE_WEIGHTS[key] / activeWeightTotal;
    components[key] = {
      raw: Math.round(pillarResults[key].raw * 10) / 10,
      weight: Math.round(effectiveWeight * 1000) / 1000,
      confidence: Math.round(pillarResults[key].confidence * 100) / 100,
    };
    overallConfidenceNum += effectiveWeight * pillarResults[key].confidence;
  }
  const confidence = clamp(Math.min(overallConfidenceNum, confidenceCap), 0, 1);

  // ---- Reason codes: top variables by |weighted deviation from neutral|,
  // split by direction. ----
  function effectiveWeightOf(pillar: RoiPillarKey): number {
    return activeWeightTotal > 0 ? PILLAR_BASELINE_WEIGHTS[pillar] / activeWeightTotal : 0;
  }
  const allVariables: { key: string; v: VariableScore; effectivePillarWeight: number }[] = [
    { key: "audienceSize", v: audienceSize, effectivePillarWeight: effectiveWeightOf("scale") },
    { key: "reachEfficiency", v: reachEfficiency, effectivePillarWeight: effectiveWeightOf("scale") },
    { key: "trajectory", v: trajectory, effectivePillarWeight: effectiveWeightOf("scale") },
    { key: "platformMix", v: platformMix, effectivePillarWeight: effectiveWeightOf("scale") },
    { key: "engagement", v: engagement, effectivePillarWeight: effectiveWeightOf("attention") },
    { key: "watchTime", v: watchTime, effectivePillarWeight: effectiveWeightOf("attention") },
    { key: "cadence", v: cadence, effectivePillarWeight: effectiveWeightOf("attention") },
    { key: "authenticity", v: authenticity, effectivePillarWeight: effectiveWeightOf("trust") },
    { key: "topicalAuthority", v: topicalAuthority, effectivePillarWeight: effectiveWeightOf("relevance") },
    { key: "tenure", v: tenure, effectivePillarWeight: effectiveWeightOf("governance") },
  ].filter((x) => !x.v.missing);

  // A variable only qualifies as a reason if it's meaningfully far from
  // neutral (|raw-50| >= 15) — otherwise a barely-positive 57/100 ends up
  // mislabeled "strong", which erodes trust in the labels faster than
  // omitting a marginal factor does. Ranking among qualifying candidates
  // still uses the full weighted deviation, so a high-weight moderate
  // factor can still outrank a low-weight extreme one.
  const MIN_RAW_DEVIATION_FOR_REASON = 15;
  const scoredReasons = allVariables
    .filter((x) => Math.abs(x.v.raw - 50) >= MIN_RAW_DEVIATION_FOR_REASON)
    .map((x) => ({
      key: x.key,
      deviation: (x.v.raw - 50) * x.v.weight * x.effectivePillarWeight,
    }))
    .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));

  const reasons: RoiReason[] = [];
  const positives = scoredReasons.filter((r) => r.deviation > 0).slice(0, 2);
  const negatives = scoredReasons.filter((r) => r.deviation < 0).slice(0, 2);
  for (const r of positives) {
    const labels = REASON_LABELS[r.key];
    reasons.push({ code: `strong_${r.key}`, label: labels.positive, pillar: labels.pillar, direction: "positive" });
  }
  for (const r of negatives) {
    const labels = REASON_LABELS[r.key];
    reasons.push({ code: `weak_${r.key}`, label: labels.negative, pillar: labels.pillar, direction: "negative" });
  }

  return {
    score,
    grade: gradeFromScore(score),
    confidence: Math.round(confidence * 100) / 100,
    reasons,
    components,
    algoVersion: ALGO_VERSION,
  };
}

/** Passes RoiResult.components straight through — kept as a named export
 * (rather than inlining `result.components` at call sites) so the stored
 * shape has one obvious seam if it ever needs to diverge from the in-memory
 * shape again. */
export function toStoredComponents(result: RoiResult): RoiComponents {
  return result.components;
}
