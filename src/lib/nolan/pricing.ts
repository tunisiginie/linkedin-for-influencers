// Nolan's pricing engine (Nolan v2, Phase C3). Pure functions, no I/O — same
// discipline as src/lib/roi/score.ts — so the caller (a route handler or a
// server action) owns fetching rate_benchmarks rows and any peer-cohort
// percentile, and this module owns the arithmetic.
//
// Every function here follows the sponsorship knowledge base's central
// pricing rule (src/lib/knowledge/sponsorship-industry.ts): a benchmark is
// a discovery-stage budget range, never a fair-market-value determination,
// and different sources measuring different populations must never be
// averaged into one fake number. Nothing in this file collapses multiple
// `rate_benchmarks` rows into a single figure — see benchmarkRangesFor().
//
// It also follows the doc's explicit warning against invented formulas like
// "usage rights always cost 30%" or "exclusivity always doubles the rate" —
// decomposeDeal() is a structuring helper for whatever the creator/sponsor
// actually specify, not a percentage generator.

import { sizeTierFor, type SizeTier } from "@/lib/roi/score";
import type { RateBenchmark } from "@/lib/types";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

// ---------------------------------------------------------------------------
// Implied performance economics — CPM = cost/impressions x 1000,
// CPE = cost/engagements, CPA = cost/conversions, ROAS = revenue/cost.
// All cost/revenue figures are in cents; all return null rather than
// dividing by zero or a negative denominator.
// ---------------------------------------------------------------------------

export function impliedCpmCents(costCents: number, impressions: number): number | null {
  if (impressions <= 0) return null;
  return (costCents / impressions) * 1000;
}

export function impliedCpeCents(costCents: number, engagements: number): number | null {
  if (engagements <= 0) return null;
  return costCents / engagements;
}

export function impliedCpaCents(costCents: number, conversions: number): number | null {
  if (conversions <= 0) return null;
  return costCents / conversions;
}

/** Unitless ratio (e.g. 3.2 = "3.2x"), not cents. */
export function roas(attributedRevenueCents: number, costCents: number): number | null {
  if (costCents <= 0) return null;
  return attributedRevenueCents / costCents;
}

// ---------------------------------------------------------------------------
// Benchmark lookup — dispersion-preserving
// ---------------------------------------------------------------------------

export interface BenchmarkRange {
  source: string;
  lowCents: number;
  highCents: number | null;
  /** The stored size_tier value verbatim — a SizeTier for most rows, or a
   * free-text label (e.g. "marketplace_average") for a source whose
   * methodology doesn't map onto the tier scheme. */
  tierLabel: string;
  /** True when tierLabel matches the creator's own tier via sizeTierFor().
   * A non-tier row (tierMatched: false) is still returned — it's relevant
   * context, just not tier-specific — so callers should label it
   * differently in the UI rather than dropping it. */
  tierMatched: boolean;
  methodologyNote: string | null;
  asOf: string;
}

const KNOWN_SIZE_TIERS = new Set<SizeTier>(["nano", "micro", "mid", "macro", "mega"]);

/**
 * Every benchmark row for a platform, relevant to a creator's follower
 * count — tier-matched rows AND platform-wide non-tier rows (e.g. a
 * marketplace average) both included, each kept as its own source rather
 * than merged. This is deliberate: the knowledge base's central lesson is
 * that Hootsuite's rate-card range and Collabstr's marketplace-transaction
 * average measure different populations, and collapsing them into one
 * number would erase exactly the distinction that makes this data honest.
 */
export function benchmarkRangesFor(
  benchmarks: RateBenchmark[],
  platformSlug: string,
  followers: number,
): BenchmarkRange[] {
  const tier = sizeTierFor(followers);
  return benchmarks
    .filter((b) => b.platform_slug === platformSlug)
    .filter((b) => b.size_tier === tier || !KNOWN_SIZE_TIERS.has(b.size_tier as SizeTier))
    .map((b) => ({
      source: b.source,
      lowCents: b.low_cents,
      highCents: b.high_cents,
      tierLabel: b.size_tier,
      tierMatched: b.size_tier === tier,
      methodologyNote: b.methodology_note,
      asOf: b.as_of,
    }));
}

// ---------------------------------------------------------------------------
// Creator-specific range — per the doc's rule 3: "never treat follower
// count alone as fair market value." Interpolates within the cited
// tier-matched benchmark bounds using a real measured signal (how the
// creator's own reach compares to peers in the same tier) rather than
// inventing a number beyond what the benchmarks already support.
// ---------------------------------------------------------------------------

export interface CreatorSpecificRange {
  lowCents: number;
  highCents: number;
  /** Which benchmark sources this range was derived from — always cite
   * these alongside the number, per the doc's RESEARCH RULES. */
  basedOnSources: string[];
  /** 0-100 — the creator's reach efficiency (views relative to followers)
   * percentile against same-tier peers. This is what moves them within the
   * benchmark range; supply it from the same peer-cohort percentile
   * machinery the ROI scorer uses (computeCategoryBenchmark + the
   * reach-efficiency variable in src/lib/roi/score.ts), not a fresh
   * calculation, so "how good is this creator's reach" means the same
   * thing everywhere in the product. */
  reachEfficiencyPercentile: number;
}

/**
 * Narrows the tier-matched benchmark range toward where this specific
 * creator's real, measured performance places them — never outside the
 * cited range, and never collapsing it to a single point. A creator at the
 * peer-cohort median lands at the range's center; above/below-median
 * performers shift toward the top/bottom, capped at a conservative band so
 * one benchmark source's uncertainty isn't overstated as false precision.
 */
export function creatorSpecificRange(
  ranges: BenchmarkRange[],
  reachEfficiencyPercentile: number,
): CreatorSpecificRange | null {
  const tierMatched = ranges.filter(
    (r): r is BenchmarkRange & { highCents: number } => r.tierMatched && r.highCents != null,
  );
  if (tierMatched.length === 0) return null;

  const lo = Math.min(...tierMatched.map((r) => r.lowCents));
  const hi = Math.max(...tierMatched.map((r) => r.highCents));
  const span = hi - lo;
  const pct = clamp(reachEfficiencyPercentile, 0, 100) / 100;

  const center = lo + span * (0.35 + 0.3 * pct); // pct=0 -> 35% into range, pct=100 -> 65%
  const bandHalfWidth = span * 0.125; // a conservative +/-12.5%-of-span band around center

  return {
    lowCents: Math.round(clamp(center - bandHalfWidth, lo, hi)),
    highCents: Math.round(clamp(center + bandHalfWidth, lo, hi)),
    basedOnSources: tierMatched.map((r) => r.source),
    reachEfficiencyPercentile,
  };
}

// ---------------------------------------------------------------------------
// Deal decomposition — the doc's A-J economic split. A structuring helper
// for whatever the creator/sponsor actually specify, NOT a percentage
// generator: the doc is explicit that rules like "usage is always 30%" are
// unsupported. Unknown components stay absent rather than defaulting to 0.
// ---------------------------------------------------------------------------

export type DealComponent =
  | "production"
  | "organicDistribution"
  | "usageLicense"
  | "paidMediaWhitelisting"
  | "nameLikeness"
  | "exclusivity"
  | "rushComplexity"
  | "performanceUpside"
  | "expenses"
  | "agencyFees";

export const DEAL_COMPONENT_LABELS: Record<DealComponent, string> = {
  production: "Production (filming, editing, travel, props, crew)",
  organicDistribution: "Organic distribution (the post/video itself)",
  usageLicense: "Usage/license rights (media, territory, term)",
  paidMediaWhitelisting: "Paid-media / whitelisting rights",
  nameLikeness: "Name, image, and likeness rights",
  exclusivity: "Exclusivity / opportunity cost",
  rushComplexity: "Rush, complexity, or unusual production demands",
  performanceUpside: "Performance-based upside (CPA/CPS bonus, etc.)",
  expenses: "Reimbursable expenses",
  agencyFees: "Intermediary / agency fees",
};

export interface DealDecomposition {
  components: Partial<Record<DealComponent, number>>; // cents, only what's known
  totalKnownCents: number;
  proposedTotalCents: number | null;
  /** proposedTotal - totalKnown when both are known — a positive value
   * means part of the proposed fee isn't accounted for by any named
   * component, which is worth surfacing rather than silently absorbing. */
  unallocatedCents: number | null;
}

export function decomposeDeal(
  known: Partial<Record<DealComponent, number>>,
  proposedTotalCents: number | null = null,
): DealDecomposition {
  const totalKnownCents = Object.values(known).reduce((s: number, v) => s + (v ?? 0), 0);
  return {
    components: known,
    totalKnownCents,
    proposedTotalCents,
    unallocatedCents: proposedTotalCents != null ? proposedTotalCents - totalKnownCents : null,
  };
}

// ---------------------------------------------------------------------------
// Counteroffer ladder — opening ask, target settlement, and the doc's
// "trade scope before price" concession order. Never a single false-
// precision number; always anchored to the creator-specific range above.
// ---------------------------------------------------------------------------

export interface CounterofferLadder {
  openingAskCents: number;
  targetSettlementCents: number;
  /** Non-price concessions to offer before touching the base fee, in the
   * order the knowledge base recommends trading them. */
  scopeConcessions: string[];
}

const SCOPE_CONCESSIONS = [
  "Narrow the usage-rights term (e.g. 90 days instead of a year) before lowering the base fee",
  "Limit or separately price paid-media / whitelisting rights",
  "Narrow exclusivity to named competitors and a shorter pre/post window",
  "Reduce revision rounds rather than reducing the fee",
  "Offer a package/volume discount only in exchange for a committed multi-deliverable volume",
];

/**
 * Never guarantees algorithm-controlled outcomes and never anchors below
 * what the creator-specific range already supports — if the brand's own
 * proposal exceeds that range, the opening ask starts from the proposal,
 * not from a number that would concede ground the data doesn't require.
 */
export function counterofferLadder(
  range: CreatorSpecificRange,
  proposedFeeCents: number | null = null,
): CounterofferLadder {
  const openingAskCents =
    proposedFeeCents != null && proposedFeeCents > range.highCents
      ? proposedFeeCents
      : range.highCents;
  const targetSettlementCents = Math.round((range.lowCents + range.highCents) / 2);

  return {
    openingAskCents,
    targetSettlementCents,
    scopeConcessions: SCOPE_CONCESSIONS,
  };
}
