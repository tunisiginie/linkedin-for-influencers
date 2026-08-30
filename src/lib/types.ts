// Row types mirroring supabase/schema.sql. Kept as plain interfaces (no
// generated types) so the app runs before Supabase is even configured.

export type AccountType = "creator" | "sponsor" | "admin";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  photo_url: string | null;
  account_type: AccountType;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  website: string | null;
  logo_url: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  sort_order: number;
}

export type PlatformSlug = "youtube" | "instagram" | "tiktok" | "twitch" | "x";

export interface Platform {
  id: string;
  slug: PlatformSlug;
  name: string;
  icon: string | null;
}

export interface Creator {
  id: string;
  slug: string;
  display_name: string;
  headline: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  country: string | null;
  language: string | null;
  years_active_since: number | null;
  claimed_by: string | null;
  claimed_at: string | null;
  is_seed_data: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatorAccount {
  id: string;
  creator_id: string;
  platform_id: string;
  handle: string;
  external_id: string | null;
  url: string | null;
  is_primary: boolean;
  last_synced_at: string | null;
  created_at: string;
}

export interface AccountMetric {
  id: string;
  creator_account_id: string;
  snapshot_date: string; // YYYY-MM-DD
  followers: number;
  total_views: number;
  avg_views: number;
  likes: number;
  comments: number;
  watch_hours: number;
  upload_count: number;
  created_at: string;
}

export interface CreatorCategory {
  creator_id: string;
  category_id: string;
  confidence: number;
}

export interface ContactPreferences {
  creator_id: string;
  opt_out_at: string | null;
  deletion_requested_at: string | null;
  updated_at: string;
}

export type ContactSource = "public_profile" | "self_provided";

export interface CreatorContact {
  id: string;
  creator_id: string;
  email: string | null;
  phone: string | null;
  source: ContactSource;
  verified_at: string | null;
  created_at: string;
}

export type RoiGrade = "A" | "B" | "C" | "D" | "F";

export interface RoiComponents {
  reach: number;
  engagement: number;
  consistency: number;
  trajectory: number;
  tenure: number;
  authenticity: number;
}

export interface RoiScore {
  creator_id: string;
  score: number | null;
  grade: RoiGrade | null;
  components: RoiComponents | Record<string, never>;
  algo_version: string;
  computed_at: string;
}

export type ClaimMethod = "oauth_youtube" | "bio_token";
export type ClaimStatus = "pending" | "verified" | "rejected";

export interface ClaimRequest {
  id: string;
  creator_id: string;
  user_id: string;
  method: ClaimMethod;
  verification_token: string | null;
  status: ClaimStatus;
  verified_at: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  org_id: string;
  creator_id: string;
  subject: string | null;
  created_at: string;
  updated_at: string;
}

export type SenderType = "sponsor" | "creator";

export interface Message {
  id: string;
  conversation_id: string;
  sender_type: SenderType;
  sender_user_id: string | null;
  body: string;
  ai_drafted: boolean;
  read_at: string | null;
  created_at: string;
}

export type DocumentKind =
  | "campaign_brief"
  | "term_sheet"
  | "insertion_order"
  | "deliverables_schedule";
export type DocumentStatus = "draft" | "sent" | "accepted";

export interface CreatorDocument {
  id: string;
  conversation_id: string;
  kind: DocumentKind;
  title: string;
  content: Record<string, unknown>;
  status: DocumentStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TalentList {
  id: string;
  org_id: string;
  name: string;
  created_by: string | null;
  created_at: string;
}

export interface TalentListItem {
  list_id: string;
  creator_id: string;
  note: string | null;
  added_at: string;
}

export interface SavedSearch {
  id: string;
  org_id: string;
  user_id: string | null;
  name: string;
  query: Record<string, unknown>;
  created_at: string;
}

// ---- Composite view models used by the UI ----

export interface CreatorAccountWithPlatform extends CreatorAccount {
  platforms: Pick<Platform, "slug" | "name" | "icon"> | null;
}

export interface CreatorCategoryWithCategory extends CreatorCategory {
  categories: Pick<Category, "slug" | "name" | "icon"> | null;
}

export interface CreatorReach {
  creator_id: string;
  total_followers: number;
  total_views: number;
  latest_snapshot_date: string | null;
}

export interface CreatorSummary extends Creator {
  roi_scores: Pick<RoiScore, "score" | "grade"> | null;
  creator_categories: CreatorCategoryWithCategory[];
  creator_accounts: CreatorAccountWithPlatform[];
  reach: Pick<CreatorReach, "total_followers" | "total_views"> | null;
}

export interface CreatorProfile extends Creator {
  roi_scores: RoiScore | null;
  creator_categories: CreatorCategoryWithCategory[];
  creator_accounts: (CreatorAccountWithPlatform & {
    account_metrics: AccountMetric[];
  })[];
}
