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

export interface CreatorPreferences {
  creator_id: string;
  open_to_sponsorships: boolean;
  product_types: string[];
  products_i_use: string[];
  dream_brands: string[];
  excluded_topics: string[];
  content_formats: string[];
  min_rate_cents: number | null;
  rate_notes: string | null;
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

// v2 pillars, per the seven-pillar architecture in the ROI scoring framework
// (docs/reference — see src/lib/roi/score.ts header). "commercial" and "deal"
// are documented here for forward-compatibility with Phases C/E but carry no
// live variables yet — a creator's `components` will simply omit them until
// their data source lands, rather than showing a fabricated 0. "relevance"
// went live in Phase B (topical authority only — see content-signals.ts).
export type RoiPillarKey =
  | "scale"
  | "attention"
  | "trust"
  | "relevance"
  | "commercial"
  | "deal"
  | "governance";

export interface RoiPillarComponent {
  /** This pillar's own 0-100 composite (post reliability-shrink, and for
   * "trust", post fraud-signal dampening). */
  raw: number;
  /** This creator's renormalized effective weight for this pillar, as a
   * fraction of the composite (sums to 1 across present pillars) — not the
   * documented baseline, which includes not-yet-implemented pillars. */
  weight: number;
  /** Weighted average reliability (0-1) of the variables behind this
   * pillar's raw score. */
  confidence: number;
}

/** Sparse — only pillars with at least one live variable are present. */
export type RoiComponents = Partial<Record<RoiPillarKey, RoiPillarComponent>>;

export interface RoiReason {
  /** Stable machine key, e.g. "strong_watch_time". */
  code: string;
  /** Human-readable, e.g. "Strong average watch time vs. category peers". */
  label: string;
  pillar: RoiPillarKey;
  direction: "positive" | "negative";
}

export interface RoiScore {
  creator_id: string;
  score: number | null;
  grade: RoiGrade | null;
  components: RoiComponents;
  /** 0-1 overall measurement confidence — weighted-average reliability of
   * every variable that contributed, further capped when fraud signals
   * fire. Null alongside a null score. */
  confidence: number | null;
  /** Top factors helping and hurting the score, most-influential first. */
  reasons: RoiReason[];
  /** e.g. "fitness::micro" — the peer cohort this score was benchmarked
   * against. Null when there weren't enough peers for a real cohort. */
  cohort_key: string | null;
  algo_version: string;
  computed_at: string;
}

/** One recent post/video title, used to ground topical-authority scoring.
 * See content-signals.ts for why this is the only content-derived signal
 * implemented so far (production quality and sentiment need data — real
 * video/thumbnail inspection and actual comment text — that no adapter
 * fetches yet). */
export interface CreatorContentItem {
  id: string;
  creator_account_id: string;
  external_id: string;
  title: string;
  published_at: string | null;
  created_at: string;
}

export interface CreatorContentSignals {
  creator_id: string;
  /** 0-100, or null if never scored (no ANTHROPIC_API_KEY, or nothing to
   * score against yet). */
  topical_authority: number | null;
  rationale: string | null;
  model: string;
  definition_version: string;
  computed_at: string;
}

/** A structured pricing data point from the sponsorship knowledge base
 * (Nolan v2 Phase C2). `size_tier` is usually a SizeTier from
 * src/lib/roi/score.ts (nano/micro/mid/macro/mega), but a source with its
 * own incompatible tier boundaries or no tier concept at all (a
 * marketplace-wide average) uses a free-text label instead — see the
 * seed comments in supabase/schema.sql. Multiple rows can share a
 * (platform_slug, size_tier) with different `source`s; that dispersion is
 * intentional and must never be averaged away — see pricing.ts. */
export interface RateBenchmark {
  id: string;
  platform_slug: string;
  size_tier: string;
  low_cents: number;
  /** null = open-ended, e.g. "$50,000+". */
  high_cents: number | null;
  source: string;
  methodology_note: string | null;
  as_of: string;
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

export interface OrgProduct {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  topics: string[];
  target_audience: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatorMatch {
  creator_id: string;
  match_score: number;
  category_match: boolean;
  topic_overlap_count: number;
}

// ---- Nolan (creator-facing AI advisor) ----

export type NolanRole = "user" | "assistant";

export interface NolanThread {
  id: string;
  creator_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface NolanMessage {
  id: string;
  thread_id: string;
  role: NolanRole;
  body: string;
  created_at: string;
}

/** Nolan v2 (Phase C5) risk scale — LOW/MEDIUM/HIGH/CRITICAL, per the
 * knowledge base's clause-review model (src/lib/knowledge/sponsorship-industry.ts).
 * Replaces the old three-level info/caution/warning scale. */
export type ContractRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ContractRecommendation = "ACCEPT" | "COUNTER" | "DECLINE" | "COUNSEL_REVIEW";

/** One clause from the knowledge base's core clause matrix (deliverables,
 * compensation, usage rights, exclusivity, indemnity, termination, etc. —
 * ~25 categories), scored individually rather than lumped into one
 * generic "red flags" list. */
export interface ContractClauseRisk {
  clause: string;
  /** What the document currently says, paraphrased — or "Not addressed in
   * this document" when the clause is simply absent (itself often the
   * risk, e.g. no kill fee). */
  currentLanguage: string;
  risk: ContractRiskLevel;
  why: string;
  whoControlsRisk: "creator" | "brand" | "shared";
  proposedMitigation: string;
  /** True when this specific issue is substantial enough to warrant real
   * legal review, not just Nolan's plain-language read. */
  counselReview: boolean;
}

/** The rights actually granted, decomposed per the knowledge base's rights
 * checklist — a "perpetual, worldwide, all-media" grant should never hide
 * inside one flat "usage rights" field unnoticed. Each field is null when
 * the document doesn't address that dimension at all (silence on a rights
 * dimension is itself worth flagging, not the same as "none granted"). */
export interface ContractRightsGrant {
  media: string | null;
  territory: string | null;
  term: string | null;
  sublicensing: string | null;
  editingDerivatives: string | null;
  nameLikenessVoice: string | null;
  aiSyntheticReplica: string | null;
  whitelistingPaidMedia: string | null;
  postTerminationUse: string | null;
  renewal: string | null;
}

export interface ContractComplianceCheck {
  issue: string;
  status: "ok" | "concern" | "unclear" | "not_applicable";
  requiredAction: string | null;
  /** e.g. "FTC Endorsement Guides" — never left unattributed. */
  source: string | null;
}

/** Structured extraction and analysis from a contract, produced by
 * /api/nolan/analyze via output_config.format. Plain-language, never a
 * legal conclusion — see NOLAN_SYSTEM_PROMPT in src/lib/claude.ts. */
export interface ContractReview {
  summary: string;
  overallRisk: ContractRiskLevel;
  recommendation: ContractRecommendation;
  parties: string[];
  term: string | null;
  compensation: string | null;
  deliverables: string[];
  rights: ContractRightsGrant;
  clauseRisks: ContractClauseRisk[];
  complianceChecks: ContractComplianceCheck[];
  /** What the review had to assume, or couldn't determine from the
   * document at all — kept separate from findings per the knowledge
   * base's audit-trail principle. */
  assumptionsOrMissingData: string[];
}

export interface NolanDocument {
  id: string;
  thread_id: string;
  storage_path: string;
  file_name: string;
  media_type: string;
  review: ContractReview | null;
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
