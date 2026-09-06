// Nolan's site-search tool (front-of-site overhaul, part 3). A single
// custom tool with a `type` discriminator rather than five separate tools —
// one schema for the model to reason about, one executor that branches to
// the existing query helpers.
//
// Security note, the one thing this file has to get right: every helper
// here is called with the *request-scoped* Supabase client
// (`@/lib/supabase/server`, which carries the caller's cookies), never the
// admin client. RLS is the access control for `lists`, `products`, and
// `conversations` — an anonymous or wrong-org caller gets an empty result
// the same way the rest of the app would deny them, automatically. Reusing
// searchCreators/getTalentLists/getOrgProducts/getNolanThreads from
// src/lib/queries.ts (rather than writing new queries here) means this tool
// can't accidentally see more than the equivalent page already shows.

import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getNolanThreads, getOrgProducts, getTalentLists, searchCreators } from "@/lib/queries";

const SITE_PAGES: { path: string; title: string; description: string }[] = [
  { path: "/", title: "Landing page", description: "The public homepage — pick creator or sponsor." },
  { path: "/search", title: "Talent search", description: "Filter and browse the full creator directory by category, platform, size, and JAE Score." },
  { path: "/jae-score", title: "JAE Score explainer", description: "What the JAE Score is, how it's computed from real metrics, and what it doesn't measure yet." },
  { path: "/creator", title: "Creator home", description: "Claim your auto-generated profile and get discovered by sponsors." },
  { path: "/sponsor", title: "Sponsor home", description: "Search creators and browse top-scoring profiles." },
  { path: "/claim", title: "Claim your profile", description: "Find your auto-generated creator profile and verify ownership of it." },
  { path: "/nolan", title: "Nolan", description: "This assistant — sponsorship deal analysis, contract review, pricing benchmarks." },
  { path: "/dashboard", title: "Dashboard", description: "Your account's home base once signed in." },
  { path: "/messages", title: "Messages", description: "Conversations between creators and sponsors." },
  { path: "/settings", title: "Settings", description: "Account settings." },
];

export const SEARCH_SITE_TOOL: Anthropic.Tool = {
  name: "search_site",
  description:
    "Search CreatorNetwork itself: the public creator directory, the signed-in user's own saved talent lists, their organization's products, their past Nolan conversations, or find a relevant page on the site. Use this whenever the creator asks to find, browse, look up, or navigate to something on the platform, instead of guessing at names, urls, or data you don't have. Results outside `pages` reflect only what the signed-in caller is allowed to see — an empty result for lists/products/conversations usually just means they're signed out or have none yet, not that the search failed.",
  input_schema: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["creators", "lists", "products", "conversations", "pages"],
        description:
          "creators: the public creator directory. lists: the signed-in sponsor's saved talent lists. products: the signed-in sponsor's org's products. conversations: the signed-in creator's past Nolan threads. pages: static site pages/navigation (not user data).",
      },
      query: {
        type: "string",
        description:
          "Free-text search term. For creators: matches name/headline/bio. For pages: matches title/description. Ignored for lists/products/conversations, which just list everything the caller has access to.",
      },
      category: { type: "string", description: "Creator category slug. type=creators only." },
      platform: { type: "string", description: "Platform slug. type=creators only." },
      minFollowers: { type: "number", description: "type=creators only." },
      maxFollowers: { type: "number", description: "type=creators only." },
      minJaeScore: {
        type: "number",
        description: "Minimum JAE Score, 0-1000. type=creators only.",
      },
    },
    required: ["type"],
  },
};

export interface SearchSiteInput {
  type: "creators" | "lists" | "products" | "conversations" | "pages";
  query?: string;
  category?: string;
  platform?: string;
  minFollowers?: number;
  maxFollowers?: number;
  minJaeScore?: number;
}

function isSearchSiteInput(input: unknown): input is SearchSiteInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "type" in input &&
    typeof (input as { type: unknown }).type === "string"
  );
}

/** Executes one search_site tool call and returns its result as a JSON
 * string (what a tool_result block's `content` wants). Never throws — a
 * lookup failure becomes `{ error }` in the payload so the model can react
 * to it in-conversation rather than the whole turn failing. */
export async function executeSearchSite(rawInput: unknown): Promise<string> {
  if (!isSearchSiteInput(rawInput)) {
    return JSON.stringify({ error: "Malformed search_site input." });
  }
  const input = rawInput;

  try {
    switch (input.type) {
      case "creators": {
        const { creators, total } = await searchCreators({
          q: input.query,
          category: input.category,
          platform: input.platform,
          minFollowers: input.minFollowers,
          maxFollowers: input.maxFollowers,
          minRoiScore: input.minJaeScore,
          sort: "roi",
          limit: 8,
        });
        return JSON.stringify({
          total,
          results: creators.map((c) => ({
            name: c.display_name,
            headline: c.headline,
            url: `/creators/${c.slug}`,
            jaeScore: c.roi_scores?.score ?? null,
            grade: c.roi_scores?.grade ?? null,
            followers: c.reach?.total_followers ?? null,
            claimed: c.claimed_by !== null,
          })),
        });
      }

      case "lists": {
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          return JSON.stringify({ results: [], note: "Not signed in — no lists to search." });
        }
        const { data: orgRow } = await supabase
          .from("org_members")
          .select("org_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();
        if (!orgRow) {
          return JSON.stringify({ results: [], note: "This account has no organization." });
        }
        const lists = await getTalentLists(orgRow.org_id);
        return JSON.stringify({
          results: lists.map((l) => ({
            name: l.name,
            url: `/lists/${l.id}`,
            createdAt: l.created_at,
          })),
        });
      }

      case "products": {
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          return JSON.stringify({ results: [], note: "Not signed in — no products to search." });
        }
        const { data: orgRow } = await supabase
          .from("org_members")
          .select("org_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();
        if (!orgRow) {
          return JSON.stringify({ results: [], note: "This account has no organization." });
        }
        const products = await getOrgProducts(orgRow.org_id);
        return JSON.stringify({
          results: products.map((p) => ({
            name: p.name,
            description: p.description,
            url: `/products/${p.id}`,
            topics: p.topics,
          })),
        });
      }

      case "conversations": {
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          return JSON.stringify({ results: [], note: "Not signed in — no conversations to search." });
        }
        const { data: creatorRow } = await supabase
          .from("creators")
          .select("id")
          .eq("claimed_by", user.id)
          .maybeSingle();
        if (!creatorRow) {
          return JSON.stringify({ results: [], note: "No claimed creator profile on this account." });
        }
        const threads = await getNolanThreads(creatorRow.id);
        return JSON.stringify({
          results: threads.map((t) => ({
            title: t.title ?? "Untitled conversation",
            url: `/nolan/${t.id}`,
            updatedAt: t.updated_at,
          })),
        });
      }

      case "pages": {
        const q = (input.query ?? "").trim().toLowerCase();
        const results = q
          ? SITE_PAGES.filter(
              (p) =>
                p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
            )
          : SITE_PAGES;
        return JSON.stringify({ results });
      }

      default:
        return JSON.stringify({ error: `Unknown search_site type: ${String(input.type)}` });
    }
  } catch (err) {
    console.error("search_site tool failed:", err);
    return JSON.stringify({ error: "That search failed unexpectedly." });
  }
}
