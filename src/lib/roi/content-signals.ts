// LLM-derived content signals for the ROI score's Relevance & authority
// pillar (ROI v2 Phase B).
//
// Scope note: the framework's Relevance & authority pillar has four
// variables — content relevance, brand fit, topical authority, production
// quality. Content relevance and brand fit are SPONSOR-specific (how well a
// creator fits *one* sponsor's product), so they belong in
// match_creators_for_product, not in this creator-absolute score. Topical
// authority is creator-absolute and genuinely gradeable from data the
// platform actually has (bio, headline, category, recent content titles) —
// it's the only variable implemented here.
//
// Production quality and sentiment are deliberately NOT scored yet:
//   - Production quality means audio/editing/visual execution per the
//     framework's own definition — that needs real video or thumbnail
//     inspection, and no PlatformAdapter fetches thumbnails today.
//   - Sentiment means actual audience comment TEXT, weighted toward
//     substantive comments — no adapter fetches comment text (only counts),
//     and scraping it raises its own platform-ToS questions the compliance
//     rules in AGENTS.md don't yet cover.
// Scoring either from bio text alone would be exactly the "vague analyst
// judgment" the framework explicitly warns qualitative variables away from
// — so they're left out rather than faked. Unlock path: wire real
// thumbnail/video fetching (production quality) or comment-text ingestion
// under an approved API scope (sentiment).
//
// This module does the one piece of I/O in the ROI pipeline that isn't a
// database read/write — everything in score.ts stays a pure function, by
// design (see that file's header). Called from the ingest orchestrator
// (src/lib/ingest/run.ts), not from computeRoiScore itself.

import type { SupabaseClient } from "@supabase/supabase-js";
import { CLAUDE_MODEL, getClaudeClient } from "@/lib/claude";

export interface ContentSignalInput {
  bio: string | null;
  headline: string | null;
  categoryNames: string[];
  /** Most recent post/video titles, newest first. Empty is fine — the
   * rubric still has bio/headline to work from, just with less grounding. */
  recentTitles: string[];
}

export interface ContentSignalResult {
  topicalAuthority: number; // 0-100
  rationale: string;
}

const TOPICAL_AUTHORITY_SYSTEM_PROMPT = `You evaluate whether a content creator demonstrates real topical authority and expertise in their stated content category, based only on their profile text and recent content titles.

Score topical authority 0-100 using this rubric:
- 0-20: Generic or off-topic — bio/titles show no clear specialization, or contradict the stated category.
- 21-45: Loosely on-topic — some relevant content, but shallow, inconsistent, or interchangeable with any creator in the space.
- 46-70: Clearly specialized — consistent focus on the category, plausible working knowledge, a recognizable niche.
- 71-90: Demonstrated expertise — specific, credible depth (named techniques, tools, sub-topics, a distinct point of view) beyond generic category content.
- 91-100: Standout authority — content and framing suggest genuine leading expertise or a distinctive, hard-to-replicate angle within the category.

Be skeptical of marketing language — a polished bio with no specific substance scores in the lower half. Base the score only on the text you're given; never invent facts about the creator, their credentials, or content beyond what's provided.`;

// output_config.format's json_schema doesn't support `minimum`/`maximum` on
// integer properties (400 invalid_request_error) — the 0-100 rubric bound
// is enforced in code instead (see the clamp below), not in the schema.
const TOPICAL_AUTHORITY_SCHEMA = {
  type: "object",
  properties: {
    topicalAuthority: { type: "integer", description: "0-100, per the rubric." },
    rationale: { type: "string", description: "One sentence justifying the score." },
  },
  required: ["topicalAuthority", "rationale"],
  additionalProperties: false,
} as const;

/** Scores one creator's topical authority. Returns null when Claude isn't
 * configured (graceful degradation, per AGENTS.md) or there's nothing
 * meaningful to score against — never throws on a missing key. */
export async function scoreTopicalAuthority(
  input: ContentSignalInput,
): Promise<ContentSignalResult | null> {
  const client = getClaudeClient();
  if (!client) return null;
  if (!input.bio && !input.headline && input.recentTitles.length === 0) return null;

  const lines = [
    input.headline ? `Headline: ${input.headline}` : null,
    input.bio ? `Bio: ${input.bio}` : null,
    input.categoryNames.length ? `Stated category: ${input.categoryNames.join(", ")}` : null,
    input.recentTitles.length
      ? `Recent content titles:\n${input.recentTitles.map((t) => `- ${t}`).join("\n")}`
      : "No recent content titles available — score from bio/headline only.",
  ].filter((line): line is string => line !== null);

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 512,
    system: [
      { type: "text", text: TOPICAL_AUTHORITY_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: lines.join("\n\n") }],
    output_config: { format: { type: "json_schema", schema: TOPICAL_AUTHORITY_SCHEMA } },
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;

  const parsed = JSON.parse(textBlock.text) as { topicalAuthority: number; rationale: string };
  return {
    topicalAuthority: Math.max(0, Math.min(100, Math.round(parsed.topicalAuthority))),
    rationale: parsed.rationale,
  };
}

const RECENT_TITLES_PER_CREATOR = 12;

interface CreatorForSignals {
  id: string;
  bio: string | null;
  headline: string | null;
  creator_categories: { categories: { name: string } | null }[];
  creator_accounts: { id: string }[];
}

export interface RecomputeContentSignalsSummary {
  scored: number;
  skipped: number;
}

/** Bridges scoreTopicalAuthority() to the database: pulls each creator's
 * bio/headline/categories plus their most recent content-item titles across
 * every connected account, scores topical authority, and upserts
 * creator_content_signals. Mirrors recomputeRoiScores()'s shape in
 * src/lib/roi/recompute.ts. Skips (does not overwrite) a creator when
 * Claude isn't configured or there's nothing to score — a prior real score
 * is never clobbered by a transient "unscored" run. */
export async function recomputeContentSignals(
  supabase: SupabaseClient,
  creatorIds: string[],
): Promise<RecomputeContentSignalsSummary> {
  if (creatorIds.length === 0) return { scored: 0, skipped: 0 };
  if (!getClaudeClient()) return { scored: 0, skipped: creatorIds.length };

  const { data, error } = await supabase
    .from("creators")
    .select(
      `
      id, bio, headline,
      creator_categories(categories(name)),
      creator_accounts(id)
    `,
    )
    .in("id", creatorIds);
  if (error) throw new Error(`recomputeContentSignals: failed to load creators: ${error.message}`);

  const rows = (data as unknown as CreatorForSignals[]) ?? [];
  let scored = 0;
  let skipped = 0;

  for (const row of rows) {
    const accountIds = row.creator_accounts.map((a) => a.id);
    let recentTitles: string[] = [];
    if (accountIds.length > 0) {
      const { data: items } = await supabase
        .from("creator_content_items")
        .select("title, published_at")
        .in("creator_account_id", accountIds)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(RECENT_TITLES_PER_CREATOR);
      recentTitles = (items ?? []).map((i) => i.title as string);
    }

    const result = await scoreTopicalAuthority({
      bio: row.bio,
      headline: row.headline,
      categoryNames: row.creator_categories.map((c) => c.categories?.name).filter((n): n is string => !!n),
      recentTitles,
    });

    if (!result) {
      skipped += 1;
      continue;
    }

    const { error: upsertError } = await supabase.from("creator_content_signals").upsert(
      {
        creator_id: row.id,
        topical_authority: result.topicalAuthority,
        rationale: result.rationale,
        model: CLAUDE_MODEL,
        definition_version: "v1",
        computed_at: new Date().toISOString(),
      },
      { onConflict: "creator_id" },
    );
    if (upsertError) {
      console.error(`recomputeContentSignals: failed to upsert for creator ${row.id}:`, upsertError.message);
      skipped += 1;
      continue;
    }
    scored += 1;
  }

  return { scored, skipped };
}
