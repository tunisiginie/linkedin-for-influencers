// Server-side read helpers. Safe to call from Server Components / Route
// Handlers. When Supabase isn't configured yet they return empty results so
// the UI still renders (mirrors the Rentapro convention).

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type {
  Category,
  ContactPreferences,
  Conversation,
  CreatorDocument,
  CreatorMatch,
  CreatorPreferences,
  CreatorProfile,
  CreatorReach,
  CreatorSummary,
  Message,
  NolanDocument,
  NolanMessage,
  NolanThread,
  OrgProduct,
  Platform,
  TalentList,
} from "@/lib/types";

const CREATOR_SUMMARY_SELECT = `
  *,
  roi_scores(score, grade),
  creator_categories(category_id, confidence, categories(slug, name, icon)),
  creator_accounts(*, platforms(slug, name, icon))
`;

export async function getCategories(): Promise<Category[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").order("sort_order");
  return (data as Category[]) ?? [];
}

export async function getPlatforms(): Promise<Platform[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("platforms").select("*").order("name");
  return (data as Platform[]) ?? [];
}

export interface CreatorSearchParams {
  q?: string;
  category?: string; // category slug
  platform?: string; // platform slug
  country?: string;
  minFollowers?: number;
  maxFollowers?: number;
  minRoiScore?: number;
  sort?: "roi" | "followers" | "growth" | "newest";
  limit?: number;
  offset?: number;
}

/** Fetches creator_reach rows for a set of creator ids and returns a
 * lookup map. Kept separate from the main creators query because Postgrest
 * can't embed an aggregate view via a detected relationship the way it can
 * a real foreign key. */
async function attachReach(
  supabase: Awaited<ReturnType<typeof createClient>>,
  creators: Omit<CreatorSummary, "reach">[],
): Promise<CreatorSummary[]> {
  if (creators.length === 0) return [];
  const { data } = await supabase
    .from("creator_reach")
    .select("*")
    .in(
      "creator_id",
      creators.map((c) => c.id),
    );
  const reachById = new Map(
    ((data as CreatorReach[]) ?? []).map((r) => [r.creator_id, r]),
  );
  return creators.map((c) => ({
    ...c,
    reach: reachById.get(c.id)
      ? {
          total_followers: reachById.get(c.id)!.total_followers,
          total_views: reachById.get(c.id)!.total_views,
        }
      : null,
  }));
}

/** The Sales-Nav-style facet search. Follower-count filters are applied
 * client-side after the join (via creator_reach) because Postgrest can't
 * filter on an aggregate view through a detected relationship — fine at MVP
 * scale (a few thousand creators); revisit with a server-side RPC if that
 * changes. */
export async function searchCreators(
  params: CreatorSearchParams = {},
): Promise<{ creators: CreatorSummary[]; total: number }> {
  if (!isSupabaseConfigured()) return { creators: [], total: 0 };
  const supabase = await createClient();
  const {
    q,
    category,
    platform,
    country,
    minRoiScore,
    minFollowers,
    maxFollowers,
    sort = "roi",
    limit = 24,
    offset = 0,
  } = params;

  let query = supabase.from("creators").select(CREATOR_SUMMARY_SELECT, { count: "exact" });

  if (q && q.trim()) {
    const term = `%${q.trim()}%`;
    query = query.or(`display_name.ilike.${term},headline.ilike.${term},bio.ilike.${term}`);
  }
  if (country) query = query.eq("country", country);
  if (category) {
    query = query.eq("creator_categories.categories.slug", category);
  }
  if (platform) {
    query = query.eq("creator_accounts.platforms.slug", platform);
  }

  const { data, count } = await query.range(offset, offset + limit - 1);
  const withoutReach = (data as unknown as Omit<CreatorSummary, "reach">[]) ?? [];
  let creators = await attachReach(supabase, withoutReach);

  if (minRoiScore !== undefined) {
    creators = creators.filter((c) => (c.roi_scores?.score ?? 0) >= minRoiScore);
  }
  if (minFollowers !== undefined) {
    creators = creators.filter((c) => (c.reach?.total_followers ?? 0) >= minFollowers);
  }
  if (maxFollowers !== undefined) {
    creators = creators.filter((c) => (c.reach?.total_followers ?? 0) <= maxFollowers);
  }

  if (sort === "roi") {
    creators = creators.sort((a, b) => (b.roi_scores?.score ?? 0) - (a.roi_scores?.score ?? 0));
  } else if (sort === "followers") {
    creators = creators.sort(
      (a, b) => (b.reach?.total_followers ?? 0) - (a.reach?.total_followers ?? 0),
    );
  } else if (sort === "newest") {
    creators = creators.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }

  return { creators, total: count ?? creators.length };
}

export async function getFeaturedCreators(limit = 12): Promise<CreatorSummary[]> {
  const { creators } = await searchCreators({ sort: "roi", limit });
  return creators;
}

export async function getCreatorBySlug(slug: string): Promise<CreatorProfile | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("creators")
    .select(
      `
      *,
      roi_scores(*),
      creator_categories(category_id, confidence, categories(slug, name, icon)),
      creator_accounts(*, platforms(slug, name, icon), account_metrics(*))
    `,
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!data) return null;

  // Sort each account's metric history ascending by date for chart rendering.
  const profile = data as unknown as CreatorProfile;
  profile.creator_accounts = profile.creator_accounts.map((acc) => ({
    ...acc,
    account_metrics: [...(acc.account_metrics ?? [])].sort((a, b) =>
      a.snapshot_date.localeCompare(b.snapshot_date),
    ),
  }));

  return profile;
}

export async function getCreatorById(id: string): Promise<CreatorProfile | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("creators")
    .select(
      `
      *,
      roi_scores(*),
      creator_categories(category_id, confidence, categories(slug, name, icon)),
      creator_accounts(*, platforms(slug, name, icon), account_metrics(*))
    `,
    )
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as CreatorProfile) ?? null;
}

export async function getOrganizationById(id: string) {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("*").eq("id", id).maybeSingle();
  return data;
}

export async function getOrgIdForUser(userId: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return data?.org_id ?? null;
}

export async function getTalentLists(orgId: string): Promise<TalentList[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("talent_lists")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  return (data as TalentList[]) ?? [];
}

export interface TalentListWithCreators extends TalentList {
  items: { note: string | null; added_at: string; creator: CreatorSummary }[];
}

export async function getTalentListWithCreators(
  listId: string,
): Promise<TalentListWithCreators | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("talent_lists")
    .select(`*, talent_list_items(note, added_at, creators(${CREATOR_SUMMARY_SELECT}))`)
    .eq("id", listId)
    .maybeSingle();
  if (!data) return null;

  const raw = data as unknown as TalentList & {
    talent_list_items: { note: string | null; added_at: string; creators: Omit<CreatorSummary, "reach"> }[];
  };

  const creatorsWithoutReach = raw.talent_list_items.map((item) => item.creators);
  const creatorsWithReach = await attachReach(supabase, creatorsWithoutReach);
  const reachById = new Map(creatorsWithReach.map((c) => [c.id, c.reach]));

  return {
    ...raw,
    items: raw.talent_list_items.map((item) => ({
      note: item.note,
      added_at: item.added_at,
      creator: { ...item.creators, reach: reachById.get(item.creators.id) ?? null },
    })),
  };
}

export async function getConversationsForUser(
  userId: string,
  accountType: "creator" | "sponsor",
): Promise<(Conversation & { creators: { display_name: string; avatar_url: string | null; slug: string } | null; organizations: { name: string; logo_url: string | null } | null })[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  let query = supabase
    .from("conversations")
    .select("*, creators(display_name, avatar_url, slug), organizations(name, logo_url)")
    .order("updated_at", { ascending: false });

  if (accountType === "creator") {
    const { data: creatorRow } = await supabase
      .from("creators")
      .select("id")
      .eq("claimed_by", userId)
      .maybeSingle();
    if (!creatorRow) return [];
    query = query.eq("creator_id", creatorRow.id);
  } else {
    const orgId = await getOrgIdForUser(userId);
    if (!orgId) return [];
    query = query.eq("org_id", orgId);
  }

  const { data } = await query;
  return (data as never) ?? [];
}

export interface ConversationDetail extends Conversation {
  creators: { id: string; display_name: string; avatar_url: string | null; slug: string } | null;
  organizations: { id: string; name: string; logo_url: string | null } | null;
}

/** Returns null if the conversation doesn't exist *or* the caller isn't a
 * participant — RLS filters the row out either way, and the caller (a page
 * component) should treat both cases identically (404), not distinguish
 * them, so as not to leak which conversation ids exist. */
export async function getConversationDetail(id: string): Promise<ConversationDetail | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversations")
    .select("*, creators(id, display_name, avatar_url, slug), organizations(id, name, logo_url)")
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as ConversationDetail) ?? null;
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  return (data as Message[]) ?? [];
}

export async function getDocuments(conversationId: string): Promise<CreatorDocument[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false });
  return (data as CreatorDocument[]) ?? [];
}

export async function getContactPreferences(
  creatorId: string,
): Promise<ContactPreferences | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("contact_preferences")
    .select("*")
    .eq("creator_id", creatorId)
    .maybeSingle();
  return data;
}

export async function isCreatorContactable(creatorId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;
  const supabase = await createClient();
  const { data } = await supabase
    .from("contact_preferences")
    .select("opt_out_at, deletion_requested_at")
    .eq("creator_id", creatorId)
    .maybeSingle();
  if (!data) return true;
  return !data.opt_out_at && !data.deletion_requested_at;
}

/** What a creator is open to, or null if they haven't set preferences yet
 * (not the same as "closed" — see the DEFAULT_CREATOR_PREFERENCES fallback
 * callers should render when this is null). */
export async function getCreatorPreferences(
  creatorId: string,
): Promise<CreatorPreferences | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("creator_preferences")
    .select("*")
    .eq("creator_id", creatorId)
    .maybeSingle();
  return data;
}

export async function getOrgProducts(orgId: string): Promise<OrgProduct[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("org_products")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  return (data as OrgProduct[]) ?? [];
}

export async function getOrgProductById(id: string): Promise<OrgProduct | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("org_products").select("*").eq("id", id).maybeSingle();
  return (data as OrgProduct) ?? null;
}

/** Ranked creator matches for a sponsor's product, via the
 * match_creators_for_product RPC (see supabase/schema.sql) — deliberately a
 * real SQL query rather than searchCreators(), which filters/sorts in JS
 * after pagination and can't rank a whole table. Attaches full CreatorSummary
 * rows (including reach) so the UI can render CreatorCard directly. */
export async function getMatchesForProduct(
  productId: string,
  limit = 20,
): Promise<{ match: CreatorMatch; creator: CreatorSummary }[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data: matches } = await supabase.rpc("match_creators_for_product", {
    target_product: productId,
    result_limit: limit,
  });
  const matchRows = (matches as CreatorMatch[]) ?? [];
  if (matchRows.length === 0) return [];

  const { data: creatorRows } = await supabase
    .from("creators")
    .select(CREATOR_SUMMARY_SELECT)
    .in(
      "id",
      matchRows.map((m) => m.creator_id),
    );
  const withoutReach = (creatorRows as unknown as Omit<CreatorSummary, "reach">[]) ?? [];
  const withReach = await attachReach(supabase, withoutReach);
  const creatorById = new Map(withReach.map((c) => [c.id, c]));

  return matchRows
    .map((match) => {
      const creator = creatorById.get(match.creator_id);
      return creator ? { match, creator } : null;
    })
    .filter((row): row is { match: CreatorMatch; creator: CreatorSummary } => row !== null);
}

// ---- Nolan (creator-facing AI advisor) ----

export async function getNolanThreads(creatorId: string): Promise<NolanThread[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("nolan_threads")
    .select("*")
    .eq("creator_id", creatorId)
    .order("updated_at", { ascending: false });
  return (data as NolanThread[]) ?? [];
}

/** Null both when the thread doesn't exist and when the caller isn't its
 * owner — RLS filters the row out either way; callers should treat both as
 * 404, same convention as getConversationDetail. */
export async function getNolanThread(threadId: string): Promise<NolanThread | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("nolan_threads")
    .select("*")
    .eq("id", threadId)
    .maybeSingle();
  return (data as NolanThread) ?? null;
}

export async function getNolanMessages(threadId: string): Promise<NolanMessage[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("nolan_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  return (data as NolanMessage[]) ?? [];
}

export async function getNolanDocuments(threadId: string): Promise<NolanDocument[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("nolan_documents")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false });
  return (data as NolanDocument[]) ?? [];
}
