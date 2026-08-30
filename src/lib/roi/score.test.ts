import { describe, expect, it } from "vitest";
import {
  computeRoiScore,
  DEFAULT_BENCHMARK,
  type CreatorMetricPoint,
} from "./score";

const DAY_MS = 86_400_000;

function isoDate(offsetDays: number, from = new Date("2026-06-01")): string {
  return new Date(from.getTime() + offsetDays * DAY_MS).toISOString().slice(0, 10);
}

/** Build a 120-day daily series from a per-day generator function. */
function buildSeries(
  days: number,
  gen: (day: number) => Omit<CreatorMetricPoint, "date">,
): CreatorMetricPoint[] {
  return Array.from({ length: days }, (_, day) => ({
    date: isoDate(day),
    ...gen(day),
  }));
}

describe("computeRoiScore", () => {
  it("returns null when there's no history", () => {
    const result = computeRoiScore([], 2023);
    expect(result.score).toBeNull();
    expect(result.grade).toBeNull();
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
    const score = result.score as number;
    expect(score).toBeGreaterThan(500);

    const components = result.components as Record<
      string,
      { raw: number; weight: number; weighted: number }
    >;
    const reconciled = Math.round(
      Object.values(components).reduce((sum, c) => sum + c.weighted, 0) * 10,
    );
    expect(reconciled).toBe(score);

    // Weights themselves should sum to 1.
    const totalWeight = Object.values(components).reduce((s, c) => s + c.weight, 0);
    expect(totalWeight).toBeCloseTo(1, 5);
  });

  it("penalizes a bot-inflated creator on engagement and authenticity despite huge reach", () => {
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

    // Same huge follower/view counts, but an engagement rate and
    // comment:like ratio that are wildly outside the healthy category norm —
    // the classic signature of purchased followers/views.
    const botInflated = buildSeries(120, (day) => {
      const followers = 5_000_000 + day * 1000;
      const avgViews = 4_800_000 + day * 200; // implausibly high views:followers
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

    const healthyComponents = healthyResult.components as Record<
      string,
      { raw: number }
    >;
    const botComponents = botResult.components as Record<string, { raw: number }>;

    expect(botComponents.engagement.raw).toBeLessThan(healthyComponents.engagement.raw);
    expect(botComponents.authenticity.raw).toBeLessThan(
      healthyComponents.authenticity.raw,
    );
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
      // Flat followers, no new uploads after day 10, slowly decaying views.
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
    expect((activeResult.score as number)).toBeGreaterThan(dormantResult.score as number);
  });
});
