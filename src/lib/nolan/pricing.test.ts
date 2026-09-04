import { describe, expect, it } from "vitest";
import {
  benchmarkRangesFor,
  counterofferLadder,
  creatorSpecificRange,
  decomposeDeal,
  impliedCpaCents,
  impliedCpeCents,
  impliedCpmCents,
  roas,
  type BenchmarkRange,
} from "./pricing";
import type { RateBenchmark } from "@/lib/types";

function benchmark(overrides: Partial<RateBenchmark>): RateBenchmark {
  return {
    id: "id",
    platform_slug: "instagram",
    size_tier: "micro",
    low_cents: 20000,
    high_cents: 200000,
    source: "Test source",
    methodology_note: null,
    as_of: "2026-01-01",
    ...overrides,
  };
}

describe("implied performance economics", () => {
  it("computes CPM as cost/impressions x 1000", () => {
    expect(impliedCpmCents(50000, 100000)).toBeCloseTo(500, 5);
  });

  it("computes CPE as cost/engagements", () => {
    expect(impliedCpeCents(50000, 1000)).toBeCloseTo(50, 5);
  });

  it("computes CPA as cost/conversions", () => {
    expect(impliedCpaCents(50000, 10)).toBeCloseTo(5000, 5);
  });

  it("computes ROAS as revenue/cost", () => {
    expect(roas(320000, 100000)).toBeCloseTo(3.2, 5);
  });

  it("returns null rather than dividing by a zero or negative denominator", () => {
    expect(impliedCpmCents(50000, 0)).toBeNull();
    expect(impliedCpeCents(50000, -5)).toBeNull();
    expect(impliedCpaCents(50000, 0)).toBeNull();
    expect(roas(50000, 0)).toBeNull();
  });
});

describe("benchmarkRangesFor", () => {
  const benchmarks: RateBenchmark[] = [
    benchmark({ platform_slug: "instagram", size_tier: "micro", source: "Hootsuite 2026 pricing guide", low_cents: 20000, high_cents: 200000 }),
    benchmark({ platform_slug: "instagram", size_tier: "micro", source: "Shopify 2026 aggregation", low_cents: 25000, high_cents: 500000, methodology_note: "Different tier boundaries." }),
    benchmark({ platform_slug: "instagram", size_tier: "mid", source: "Hootsuite 2026 pricing guide", low_cents: 200000, high_cents: 500000 }),
    benchmark({ platform_slug: "instagram", size_tier: "marketplace_average", source: "Collabstr 2026 marketplace report", low_cents: 19300, high_cents: 21400 }),
    benchmark({ platform_slug: "tiktok", size_tier: "micro", source: "Hootsuite 2026 pricing guide", low_cents: 50000, high_cents: 200000 }),
  ];

  it("resolves the creator's tier from follower count and returns only that platform's rows", () => {
    // 25,000 followers -> "micro" per sizeTierFor()
    const ranges = benchmarkRangesFor(benchmarks, "instagram", 25_000);
    expect(ranges.every((r) => r.tierMatched || r.tierLabel === "marketplace_average")).toBe(true);
    expect(ranges.some((r) => r.tierLabel === "mid")).toBe(false);
    expect(ranges.every((r) => r.source !== undefined)).toBe(true);
  });

  it("never averages multiple sources for the same tier — every source stays a separate row", () => {
    const ranges = benchmarkRangesFor(benchmarks, "instagram", 25_000);
    const tierMatchedSources = ranges.filter((r) => r.tierMatched).map((r) => r.source);
    expect(tierMatchedSources).toContain("Hootsuite 2026 pricing guide");
    expect(tierMatchedSources).toContain("Shopify 2026 aggregation");
    expect(tierMatchedSources.length).toBe(2); // not collapsed into 1
    // Values must be exactly what was stored, not an average of the two.
    const hootsuite = ranges.find((r) => r.source === "Hootsuite 2026 pricing guide")!;
    expect(hootsuite.lowCents).toBe(20000);
    expect(hootsuite.highCents).toBe(200000);
  });

  it("includes a non-tier row (marketplace average) as context without treating it as tier-matched", () => {
    const ranges = benchmarkRangesFor(benchmarks, "instagram", 25_000);
    const marketplace = ranges.find((r) => r.source === "Collabstr 2026 marketplace report");
    expect(marketplace).toBeDefined();
    expect(marketplace!.tierMatched).toBe(false);
  });
});

describe("creatorSpecificRange", () => {
  const tierMatchedRanges: BenchmarkRange[] = [
    { source: "Hootsuite 2026 pricing guide", lowCents: 20000, highCents: 200000, tierLabel: "micro", tierMatched: true, methodologyNote: null, asOf: "2026-01-01" },
  ];

  it("stays within the cited benchmark bounds regardless of percentile", () => {
    const low = creatorSpecificRange(tierMatchedRanges, 0)!;
    const high = creatorSpecificRange(tierMatchedRanges, 100)!;
    for (const r of [low, high]) {
      expect(r.lowCents).toBeGreaterThanOrEqual(20000);
      expect(r.highCents).toBeLessThanOrEqual(200000);
    }
  });

  it("places a below-median performer lower in the range than an above-median one", () => {
    const low = creatorSpecificRange(tierMatchedRanges, 10)!;
    const high = creatorSpecificRange(tierMatchedRanges, 90)!;
    expect(high.lowCents).toBeGreaterThan(low.lowCents);
    expect(high.highCents).toBeGreaterThan(low.highCents);
  });

  it("returns null when no tier-matched (bounded) range exists", () => {
    const unbounded: BenchmarkRange[] = [
      { source: "Hootsuite 2026 pricing guide", lowCents: 1500000, highCents: null, tierLabel: "mega", tierMatched: true, methodologyNote: null, asOf: "2026-01-01" },
    ];
    expect(creatorSpecificRange(unbounded, 50)).toBeNull();
    expect(creatorSpecificRange([], 50)).toBeNull();
  });

  it("cites which sources it was derived from", () => {
    const r = creatorSpecificRange(tierMatchedRanges, 50)!;
    expect(r.basedOnSources).toEqual(["Hootsuite 2026 pricing guide"]);
  });
});

describe("decomposeDeal", () => {
  it("sums only the known components, leaving unspecified ones absent rather than zero", () => {
    const d = decomposeDeal({ production: 100000, usageLicense: 50000 });
    expect(d.totalKnownCents).toBe(150000);
    expect(d.components.exclusivity).toBeUndefined();
  });

  it("computes unallocated amount when a proposed total is supplied", () => {
    const d = decomposeDeal({ production: 100000 }, 150000);
    expect(d.unallocatedCents).toBe(50000);
  });

  it("leaves unallocated null when no proposed total is supplied", () => {
    const d = decomposeDeal({ production: 100000 });
    expect(d.unallocatedCents).toBeNull();
  });
});

describe("counterofferLadder", () => {
  const range = { lowCents: 50000, highCents: 150000, basedOnSources: ["Hootsuite 2026 pricing guide"], reachEfficiencyPercentile: 60 };

  it("opens at the top of the creator-specific range when no proposal exceeds it", () => {
    const ladder = counterofferLadder(range, 80000);
    expect(ladder.openingAskCents).toBe(150000);
  });

  it("never anchors the opening ask below a brand proposal that already exceeds the range", () => {
    const ladder = counterofferLadder(range, 200000);
    expect(ladder.openingAskCents).toBe(200000);
  });

  it("targets the midpoint of the range for the settlement point", () => {
    const ladder = counterofferLadder(range);
    expect(ladder.targetSettlementCents).toBe(100000);
  });

  it("lists scope concessions to trade before price, per the knowledge base", () => {
    const ladder = counterofferLadder(range);
    expect(ladder.scopeConcessions.length).toBeGreaterThan(0);
  });
});
