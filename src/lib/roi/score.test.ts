import { describe, expect, it } from "vitest";
import {
  authenticityBandScore,
  combinePillars,
  computeRoiScore,
  DEFAULT_BENCHMARK,
  PILLAR_BASELINE_WEIGHTS,
  trajectoryPercentile,
  type CreatorMetricPoint,
} from "./score";

const DAY_MS = 86_400_000;

function isoDate(offsetDays: number, from = new Date("2026-06-01")): string {
  return new Date(from.getTime() + offsetDays * DAY_MS).toISOString().slice(0, 10);
}

/** Build a daily series from a per-day generator function. Every fixture
 * gets a plausible cumulative watchHours by default (~3 min/view) so the
 * watch-time variable is present rather than "missing" unless a test
 * deliberately overrides it. */
function buildSeries(
  days: number,
  gen: (day: number) => Omit<CreatorMetricPoint, "date" | "watchHours"> & { watchHours?: number },
): CreatorMetricPoint[] {
  return Array.from({ length: days }, (_, day) => {
    const point = gen(day);
    return {
      date: isoDate(day),
      watchHours: point.watchHours ?? Math.round((point.totalViews * 3) / 60),
      ...point,
    };
  });
}

/** Tiny deterministic PRNG (mulberry32) so the Monte Carlo test below is
 * reproducible rather than flaky. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("computeRoiScore", () => {
  it("returns null when there's no history", () => {
    const result = computeRoiScore([], 2023);
    expect(result.score).toBeNull();
    expect(result.grade).toBeNull();
    expect(result.confidence).toBeNull();
    expect(result.components).toEqual({});
  });

  it("returns null when history is shorter than the minimum window", () => {
    const series = buildSeries(10, (day) => ({
      followers: 10_000 + day * 50,
      totalViews: 500_000 + day * 5_000,
      avgViews: 20_000,
      likes: 1_000,
      comments: 60,
      uploadCount: Math.floor(day / 3),
    }));
    const result = computeRoiScore(series, 2023);
    expect(result.score).toBeNull();
    expect(result.reason).toMatch(/30 days/);
  });

  it("scores a healthy, steadily-growing creator well, and the component breakdown reconciles to the total", () => {
    const series = buildSeries(120, (day) => {
      const followers = 200_000 + day * 800; // steady growth
      const avgViews = 60_000 + day * 150;
      const uploadCount = Math.floor(day / 3.5); // uploads roughly every 3.5 days
      const totalViews = avgViews * (uploadCount + 1);
      return {
        followers,
        totalViews,
        avgViews,
        likes: Math.round(avgViews * 0.05),
        comments: Math.round(avgViews * 0.003),
        uploadCount,
      };
    });

    const result = computeRoiScore(series, 2021);

    expect(result.score).not.toBeNull();
    expect(result.grade).not.toBeNull();
    expect(result.confidence).toBeGreaterThan(0);
    const score = result.score as number;
    expect(score).toBeGreaterThan(500);

    // Every present pillar's effective weight should sum to ~1 (tiered
    // renormalization across the currently-active pillars).
    const totalWeight = Object.values(result.components).reduce((s, c) => s + c!.weight, 0);
    expect(totalWeight).toBeCloseTo(1, 2);

    // Reconciliation: Σ(weight * raw) * 10 should land within rounding
    // distance of the stored score (each pillar raw is itself rounded to
    // one decimal before storage, so this is a tolerance check, not exact).
    const reconciled = Math.round(
      Object.values(result.components).reduce((s, c) => s + c!.weight * c!.raw, 0) * 10,
    );
    expect(Math.abs(reconciled - score)).toBeLessThanOrEqual(2);

    // Reason codes should reference only pillars actually present.
    for (const r of result.reasons) {
      expect(Object.keys(result.components)).toContain(r.pillar);
    }
  });

  it("penalizes a bot-inflated creator on engagement and trust despite huge reach", () => {
    const healthy = buildSeries(120, (day) => {
      const followers = 500_000 + day * 1000;
      const avgViews = 100_000 + day * 200;
      const uploadCount = Math.floor(day / 4);
      return {
        followers,
        totalViews: avgViews * (uploadCount + 1),
        avgViews,
        likes: Math.round(avgViews * 0.05),
        comments: Math.round(avgViews * 0.003),
        uploadCount,
      };
    });

    // Same huge follower/view counts, but an engagement rate and view:
    // follower ratio wildly outside the healthy category norm — the classic
    // signature of purchased followers/views (bought views routinely exceed
    // the follower count itself, unlike organic reach).
    const botInflated = buildSeries(120, (day) => {
      const followers = 5_000_000 + day * 1000;
      const avgViews = 16_000_000 + day * 200; // avg views > 3x followers
      const uploadCount = Math.floor(day / 4);
      return {
        followers,
        totalViews: avgViews * (uploadCount + 1),
        avgViews,
        likes: Math.round(avgViews * 0.0005), // engagement far below norm
        comments: Math.round(avgViews * 0.00001),
        uploadCount,
      };
    });

    const healthyResult = computeRoiScore(healthy, 2021, DEFAULT_BENCHMARK);
    const botResult = computeRoiScore(botInflated, 2021, DEFAULT_BENCHMARK);

    expect(botResult.components.attention!.raw).toBeLessThan(healthyResult.components.attention!.raw);
    expect(botResult.components.trust!.raw).toBeLessThan(healthyResult.components.trust!.raw);
    // The fraud dampener should also visibly cap confidence relative to a
    // clean creator with an otherwise-comparable data footprint.
    expect(botResult.confidence as number).toBeLessThan(healthyResult.confidence as number);
  });

  it("scores a dormant creator (flat/declining, no recent uploads) lower than an active peer", () => {
    const active = buildSeries(120, (day) => {
      const followers = 100_000 + day * 400;
      const avgViews = 30_000 + day * 100;
      const uploadCount = Math.floor(day / 3);
      return {
        followers,
        totalViews: avgViews * (uploadCount + 1),
        avgViews,
        likes: Math.round(avgViews * 0.05),
        comments: Math.round(avgViews * 0.003),
        uploadCount,
      };
    });

    const dormant = buildSeries(120, (day) => {
      const uploadCount = Math.min(3, Math.floor(day / 10));
      return {
        followers: 100_000 - day * 20,
        totalViews: 3_000_000 - day * 500,
        avgViews: 30_000,
        likes: 1_200,
        comments: 40,
        uploadCount,
      };
    });

    const activeResult = computeRoiScore(active, 2020);
    const dormantResult = computeRoiScore(dormant, 2020);

    expect(activeResult.score).not.toBeNull();
    expect(dormantResult.score).not.toBeNull();
    expect(activeResult.score as number).toBeGreaterThan(dormantResult.score as number);
  });

  it("scores watch time using the same latest-snapshot cadence gaps regardless of which non-upload snapshot rows survive (real dates, not array indices)", () => {
    // Both series post every 5 real calendar days, ending on the same date
    // with identical latest-snapshot metrics — so engagement/watch-time are
    // identical and only cadence can differ. The sparse version drops
    // non-upload days unevenly (sometimes 2 rows between upload rows,
    // sometimes 6), which would have thrown off the old index-based gap
    // calculation even though the *real* calendar gap is always 5 days.
    const uploadEveryNDays = 5;
    const dense = buildSeries(150, (day) => ({
      followers: 300_000 + day * 200,
      totalViews: 9_000_000 + day * 30_000,
      avgViews: 60_000,
      likes: 3_000,
      comments: 180,
      uploadCount: Math.floor(day / uploadEveryNDays),
    }));
    // Keep every upload-boundary day, but drop a pseudo-random subset of
    // the non-upload days in between.
    const sparse = dense.filter((_, i, arr) => {
      const isUploadDay = i === 0 || arr[i].uploadCount > arr[i - 1].uploadCount;
      return isUploadDay || i % 3 !== 0;
    });

    const denseResult = computeRoiScore(dense, 2021, DEFAULT_BENCHMARK);
    const sparseResult = computeRoiScore(sparse, 2021, DEFAULT_BENCHMARK);

    expect(denseResult.components.attention!.raw).toBeCloseTo(
      sparseResult.components.attention!.raw,
      0,
    );
  });
});

describe("relevance pillar (ROI v2 Phase B — dynamic pillar activation)", () => {
  const HEALTHY_SERIES = buildSeries(120, (day) => {
    const followers = 200_000 + day * 800;
    const avgViews = 60_000 + day * 150;
    const uploadCount = Math.floor(day / 3.5);
    return {
      followers,
      totalViews: avgViews * (uploadCount + 1),
      avgViews,
      likes: Math.round(avgViews * 0.05),
      comments: Math.round(avgViews * 0.003),
      uploadCount,
    };
  });

  it("omits the relevance pillar entirely when no topicalAuthority is supplied", () => {
    const result = computeRoiScore(HEALTHY_SERIES, 2021, DEFAULT_BENCHMARK, new Date(), {});
    expect(result.components.relevance).toBeUndefined();
    const totalWeight = Object.values(result.components).reduce((s, c) => s + c!.weight, 0);
    expect(totalWeight).toBeCloseTo(1, 2);
  });

  it("activates the relevance pillar — and renormalizes every other pillar's weight down — the moment topicalAuthority is supplied", () => {
    const without = computeRoiScore(HEALTHY_SERIES, 2021, DEFAULT_BENCHMARK, new Date(), {});
    const withSignal = computeRoiScore(HEALTHY_SERIES, 2021, DEFAULT_BENCHMARK, new Date(), {
      topicalAuthority: 80,
    });

    expect(withSignal.components.relevance).toBeDefined();
    expect(withSignal.components.relevance!.raw).toBeGreaterThan(50);

    // Every pillar's renormalized weight should shrink once relevance joins
    // — no pillar keeps its old weight unchanged.
    for (const key of ["scale", "attention", "trust", "governance"] as const) {
      expect(withSignal.components[key]!.weight).toBeLessThan(without.components[key]!.weight);
    }
    const totalWeight = Object.values(withSignal.components).reduce((s, c) => s + c!.weight, 0);
    expect(totalWeight).toBeCloseTo(1, 2);
  });

  it("a low topicalAuthority score pulls the relevance pillar (and can surface as a reason) below neutral", () => {
    const result = computeRoiScore(HEALTHY_SERIES, 2021, DEFAULT_BENCHMARK, new Date(), {
      topicalAuthority: 10,
    });
    expect(result.components.relevance!.raw).toBeLessThan(50);
    const relevanceReason = result.reasons.find((r) => r.pillar === "relevance");
    if (relevanceReason) expect(relevanceReason.direction).toBe("negative");
  });
});

describe("authenticityBandScore (bug fix: symmetric-closeness no longer zeroes out high engagement)", () => {
  it("does not score an unusually high (2x median) comment ratio near 0", () => {
    const cohortMedian = 0.06;
    const score = authenticityBandScore(cohortMedian * 2, cohortMedian);
    expect(score).toBeGreaterThanOrEqual(90);
  });

  it("still scores comfortably for a ratio well below the median", () => {
    const cohortMedian = 0.06;
    const score = authenticityBandScore(cohortMedian * 0.7, cohortMedian);
    expect(score).toBe(100);
  });

  it("only meaningfully penalizes far-below-median ratios", () => {
    const cohortMedian = 0.06;
    const score = authenticityBandScore(cohortMedian * 0.1, cohortMedian);
    expect(score).toBeLessThan(40);
  });

  it("never floors to 0, even at an extreme ratio (fraud dampening handles extremes separately)", () => {
    expect(authenticityBandScore(0.06 * 20, 0.06)).toBeGreaterThanOrEqual(30);
    expect(authenticityBandScore(0.06 * 0.001, 0.06)).toBeGreaterThanOrEqual(15);
  });
});

describe("trajectoryPercentile (bug fix: growth is judged against a size-matched cohort, not one flat curve)", () => {
  it("scores the same growth rate differently depending on what's typical for the peer cohort", () => {
    const slope = 0.15;
    // Typical for a fast-moving nano/micro cohort — this pace is unremarkable.
    const nanoPeers = [-0.1, -0.02, 0.05, 0.1, 0.15, 0.15, 0.16, 0.2, 0.25, 0.3, 0.4, 0.55, 0.8];
    // Typical for a mega cohort, where most peers barely grow — this pace is exceptional.
    const megaPeers = [-0.05, -0.02, 0, 0.01, 0.02, 0.02, 0.03, 0.03, 0.04, 0.05, 0.06, 0.08, 0.1];

    const scoreAgainstNano = trajectoryPercentile(slope, slope, nanoPeers);
    const scoreAgainstMega = trajectoryPercentile(slope, slope, megaPeers);

    expect(scoreAgainstMega).toBeGreaterThan(scoreAgainstNano);
    expect(scoreAgainstNano).toBeGreaterThan(30);
    expect(scoreAgainstNano).toBeLessThan(70);
    expect(scoreAgainstMega).toBeGreaterThan(85);
  });
});

// ---------------------------------------------------------------------------
// Framework worked-example fixtures — validates the aggregation layer
// (combinePillars) independently of our own variable definitions, using the
// research framework's own published pillar values, weights, and utility
// results for its five synthetic creator profiles.
// ---------------------------------------------------------------------------

const FRAMEWORK_WEIGHTS = {
  scale: 14,
  attention: 17,
  trust: 18,
  relevance: 15,
  commercial: 22,
  deal: 9,
  governance: 5,
};

/** Strips the fixture's `expectedU` annotation, leaving just the seven
 * pillar values combinePillars() expects. */
function pillarValuesOf(profile: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(profile).filter(([key]) => key !== "expectedU"));
}

const FRAMEWORK_PROFILES = {
  A_precisionMicro: { scale: 58, attention: 88, trust: 91, relevance: 94, commercial: 90, deal: 86, governance: 85, expectedU: 85.35 },
  B_massReachCelebrity: { scale: 96, attention: 60, trust: 68, relevance: 65, commercial: 58, deal: 30, governance: 82, expectedU: 65.19 },
  C_highGrowthShortForm: { scale: 78, attention: 92, trust: 82, relevance: 80, commercial: 76, deal: 80, governance: 72, expectedU: 80.84 },
  D_authorityLongForm: { scale: 72, attention: 95, trust: 89, relevance: 96, commercial: 93, deal: 58, governance: 90, expectedU: 86.83 },
  E_inflatedMetricsRisk: { scale: 80, attention: 45, trust: 18, relevance: 55, commercial: 25, deal: 75, governance: 35, expectedU: 44.34 },
} as const;

describe("combinePillars — framework worked-example fixtures", () => {
  it("reproduces each published utility U within rounding tolerance", () => {
    for (const [name, profile] of Object.entries(FRAMEWORK_PROFILES)) {
      const u = combinePillars(pillarValuesOf(profile), FRAMEWORK_WEIGHTS);
      expect(u, name).toBeCloseTo(profile.expectedU, 1);
    }
  });

  it("preserves the framework's stated ranking: D > A > C > B > E", () => {
    const u = (p: (typeof FRAMEWORK_PROFILES)[keyof typeof FRAMEWORK_PROFILES]) =>
      combinePillars(pillarValuesOf(p), FRAMEWORK_WEIGHTS);
    const uD = u(FRAMEWORK_PROFILES.D_authorityLongForm);
    const uA = u(FRAMEWORK_PROFILES.A_precisionMicro);
    const uC = u(FRAMEWORK_PROFILES.C_highGrowthShortForm);
    const uB = u(FRAMEWORK_PROFILES.B_massReachCelebrity);
    const uE = u(FRAMEWORK_PROFILES.E_inflatedMetricsRisk);
    expect(uD).toBeGreaterThan(uA);
    expect(uA).toBeGreaterThan(uC);
    expect(uC).toBeGreaterThan(uB);
    expect(uB).toBeGreaterThan(uE);
  });

  it("maps utility to OUR higher-is-better score (S = round(U*10)) — the deliberate rejection of the framework's inverted 100=best scale", () => {
    const uA = combinePillars(pillarValuesOf(FRAMEWORK_PROFILES.A_precisionMicro), FRAMEWORK_WEIGHTS);
    const uE = combinePillars(pillarValuesOf(FRAMEWORK_PROFILES.E_inflatedMetricsRisk), FRAMEWORK_WEIGHTS);
    // A (strong profile) must score HIGHER than E (weak profile) under our
    // mapping — the framework's own S=1000-9U would instead give A a lower
    // number (232) than E (601), which is exactly the inversion we reject.
    expect(Math.round(uA * 10)).toBeGreaterThan(Math.round(uE * 10));
  });

  it("renormalizes weights across only the pillars actually present, per our tiered-scoring departure", () => {
    // Only scale+attention present, at framework baseline weights (14+17=31
    // active) — should behave exactly like a 2-pillar composite renormalized
    // to sum to 1, not silently treat the missing 69% as zeros.
    const u = combinePillars({ scale: 100, attention: 0 }, FRAMEWORK_WEIGHTS);
    // scale weight/(scale weight+attention weight) = 14/31 ≈ 0.4516
    expect(u).toBeCloseTo((14 / 31) * 100, 1);
  });
});

describe("combinePillars — Monte Carlo weight-perturbation robustness", () => {
  it("keeps the top-ranked profile (D) in the top 2 under most plausible weight configurations", () => {
    const rand = mulberry32(42);
    const draws = 1000;
    let topTwoCount = 0;

    for (let i = 0; i < draws; i++) {
      // Jitter each weight by up to ±15%, then renormalize to sum to 100 —
      // exactly the framework's prescribed perturbation process.
      const jittered: Record<string, number> = {};
      let total = 0;
      for (const [key, w] of Object.entries(FRAMEWORK_WEIGHTS)) {
        const epsilon = (rand() - 0.5) * 0.3; // uniform in [-0.15, 0.15]
        const wPrime = Math.max(0.1, w * (1 + epsilon));
        jittered[key] = wPrime;
        total += wPrime;
      }
      const weights = Object.fromEntries(
        Object.entries(jittered).map(([k, w]) => [k, (w / total) * 100]),
      );

      const scores = Object.entries(FRAMEWORK_PROFILES).map(([name, profile]) => ({
        name,
        u: combinePillars(pillarValuesOf(profile), weights),
      }));
      scores.sort((a, b) => b.u - a.u);
      const rankOfD = scores.findIndex((s) => s.name === "D_authorityLongForm");
      if (rankOfD <= 1) topTwoCount++;
    }

    const probability = topTwoCount / draws;
    expect(probability).toBeGreaterThan(0.85);
  });
});

describe("PILLAR_BASELINE_WEIGHTS", () => {
  it("sums to exactly 100, and shifts weight from scale toward attention/trust vs. the framework's own split", () => {
    const total = Object.values(PILLAR_BASELINE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
    expect(PILLAR_BASELINE_WEIGHTS.scale).toBeLessThan(FRAMEWORK_WEIGHTS.scale);
    expect(PILLAR_BASELINE_WEIGHTS.attention).toBeGreaterThan(FRAMEWORK_WEIGHTS.attention);
    expect(PILLAR_BASELINE_WEIGHTS.trust).toBeGreaterThan(FRAMEWORK_WEIGHTS.trust);
  });
});
