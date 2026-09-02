-- LinkedIn for Influencers — Supabase schema
-- Run in the Supabase SQL Editor (Project → SQL Editor → New query).
-- Idempotent: safe to re-run.

-- =========================================================================
-- PROFILES  (one row per auth user)
-- =========================================================================
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  full_name    text,
  photo_url    text,
  account_type text not null default 'sponsor', -- creator | sponsor | admin
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are self-access" on public.profiles;
create policy "Profiles are self-access" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Profiles are readable by conversation partners" on public.profiles;
create policy "Profiles are readable by conversation partners" on public.profiles
  for select using (true); -- display names/avatars on threads & claimed badges; nothing sensitive lives here

-- Auto-create a profile row whenever an auth user is created.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, account_type)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    coalesce(new.raw_user_meta_data ->> 'account_type', 'sponsor')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Shared updated_at touch trigger.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- =========================================================================
-- ORGANIZATIONS  (sponsor-side accounts)
-- =========================================================================
create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  website    text,
  logo_url   text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

create table if not exists public.org_members (
  org_id     uuid not null references public.organizations (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'member', -- owner | member
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index if not exists org_members_user_idx on public.org_members (user_id);

alter table public.org_members enable row level security;

-- helper: is the calling user a member of this org?
create or replace function public.is_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members m where m.org_id = target_org and m.user_id = auth.uid()
  );
$$;

drop policy if exists "Orgs are readable by members" on public.organizations;
create policy "Orgs are readable by members" on public.organizations
  for select using (public.is_org_member(id));

drop policy if exists "Orgs are creatable by any authenticated user" on public.organizations;
create policy "Orgs are creatable by any authenticated user" on public.organizations
  for insert with check (auth.uid() is not null and created_by = auth.uid());

drop policy if exists "Orgs are updatable by members" on public.organizations;
create policy "Orgs are updatable by members" on public.organizations
  for update using (public.is_org_member(id));

drop policy if exists "Org members manage their own membership rows" on public.org_members;
create policy "Org members manage their own membership rows" on public.org_members
  for select using (public.is_org_member(org_id));

drop policy if exists "Org members can be added by existing members" on public.org_members;
create policy "Org members can be added by existing members" on public.org_members
  for insert with check (public.is_org_member(org_id) or user_id = auth.uid());

-- =========================================================================
-- CATEGORIES  (content taxonomy)
-- =========================================================================
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  icon       text, -- lucide icon name
  sort_order int not null default 0
);

alter table public.categories enable row level security;

drop policy if exists "Categories are public-read" on public.categories;
create policy "Categories are public-read" on public.categories
  for select using (true);

insert into public.categories (slug, name, icon, sort_order) values
  ('gaming',        'Gaming',            'Gamepad2',    1),
  ('beauty',        'Beauty & Style',    'Sparkles',    2),
  ('finance',       'Finance & Business','Landmark',    3),
  ('fitness',       'Fitness & Health',  'Dumbbell',    4),
  ('tech',          'Tech & Reviews',    'Cpu',         5),
  ('food',          'Food & Cooking',    'ChefHat',     6),
  ('travel',        'Travel',            'Plane',       7),
  ('education',     'Education',         'GraduationCap',8),
  ('comedy',        'Comedy & Entertainment','Drama',   9),
  ('music',         'Music',             'Music',       10),
  ('parenting',     'Parenting & Family','Baby',        11),
  ('fashion',       'Fashion',           'Shirt',       12)
on conflict (slug) do nothing;

-- =========================================================================
-- PLATFORMS  (seeded source platforms)
-- =========================================================================
create table if not exists public.platforms (
  id   uuid primary key default gen_random_uuid(),
  slug text not null unique, -- youtube | instagram | tiktok | twitch | x
  name text not null,
  icon text
);

alter table public.platforms enable row level security;

drop policy if exists "Platforms are public-read" on public.platforms;
create policy "Platforms are public-read" on public.platforms
  for select using (true);

-- Icon names are generic lucide icons, not brand logos: lucide-react v1
-- dropped all trademarked brand/logo icons (Youtube, Instagram, Twitter,
-- Twitch, ...), so we pick a sensible generic stand-in per platform instead.
insert into public.platforms (slug, name, icon) values
  ('youtube',   'YouTube',   'Play'),
  ('instagram', 'Instagram', 'Camera'),
  ('tiktok',    'TikTok',    'Music2'),
  ('twitch',    'Twitch',    'Radio'),
  ('x',         'X',         'AtSign')
on conflict (slug) do nothing;

-- =========================================================================
-- CREATORS  (the canonical creator entity — public directory)
-- =========================================================================
create table if not exists public.creators (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  display_name       text not null,
  headline           text,
  bio                text,
  avatar_url         text,
  cover_url          text,
  country            text,
  language            text,
  years_active_since smallint, -- calendar year of first upload/publish
  claimed_by         uuid references auth.users (id) on delete set null,
  claimed_at         timestamptz,
  is_seed_data       boolean not null default false, -- true for demo/seeded rows, false once ingested for real
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists creators_claimed_by_idx on public.creators (claimed_by);
create index if not exists creators_country_idx on public.creators (country);

alter table public.creators enable row level security;

drop policy if exists "Creators are public-read" on public.creators;
create policy "Creators are public-read" on public.creators
  for select using (true);

-- helper: does the calling user own (have claimed) this creator profile?
create or replace function public.owns_creator(target_creator uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.creators c where c.id = target_creator and c.claimed_by = auth.uid()
  );
$$;

drop policy if exists "Creators are editable by their claimant" on public.creators;
create policy "Creators are editable by their claimant" on public.creators
  for update using (public.owns_creator(id)) with check (public.owns_creator(id));

drop trigger if exists creators_touch on public.creators;
create trigger creators_touch before update on public.creators
  for each row execute function public.touch_updated_at();

-- =========================================================================
-- CREATOR_ACCOUNTS  (one row per creator × platform)
-- =========================================================================
create table if not exists public.creator_accounts (
  id           uuid primary key default gen_random_uuid(),
  creator_id   uuid not null references public.creators (id) on delete cascade,
  platform_id  uuid not null references public.platforms (id) on delete cascade,
  handle       text not null,
  external_id  text, -- platform-native channel/user id, used for ingestion + claim verification
  url          text,
  is_primary   boolean not null default false,
  last_synced_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (platform_id, external_id)
);

create index if not exists creator_accounts_creator_idx on public.creator_accounts (creator_id);
create index if not exists creator_accounts_platform_idx on public.creator_accounts (platform_id);

alter table public.creator_accounts enable row level security;

drop policy if exists "Creator accounts are public-read" on public.creator_accounts;
create policy "Creator accounts are public-read" on public.creator_accounts
  for select using (true);

drop policy if exists "Creator accounts are editable by claimant" on public.creator_accounts;
create policy "Creator accounts are editable by claimant" on public.creator_accounts
  for all using (public.owns_creator(creator_id)) with check (public.owns_creator(creator_id));

-- =========================================================================
-- ACCOUNT_METRICS  (time series — one row per account per snapshot day)
--
-- followers / total_views / upload_count are cumulative channel totals (what
-- platform APIs expose directly, e.g. YouTube's subscriberCount/viewCount/
-- videoCount). avg_views / likes / comments are *per-recent-video averages*
-- (derived by sampling the account's last N posts) — platforms don't expose
-- lifetime cumulative likes/comments, so this is the honestly-computable
-- engagement signal. See src/lib/roi/score.ts for how these are combined.
-- =========================================================================
create table if not exists public.account_metrics (
  id                uuid primary key default gen_random_uuid(),
  creator_account_id uuid not null references public.creator_accounts (id) on delete cascade,
  snapshot_date     date not null,
  followers         bigint not null default 0,
  total_views       bigint not null default 0,
  avg_views         bigint not null default 0,
  likes             bigint not null default 0,
  comments          bigint not null default 0,
  watch_hours       bigint not null default 0,
  upload_count      int not null default 0,
  created_at        timestamptz not null default now(),
  unique (creator_account_id, snapshot_date)
);

create index if not exists account_metrics_account_idx on public.account_metrics (creator_account_id, snapshot_date desc);

alter table public.account_metrics enable row level security;

drop policy if exists "Account metrics are public-read" on public.account_metrics;
create policy "Account metrics are public-read" on public.account_metrics
  for select using (true);

-- =========================================================================
-- CREATOR_CATEGORIES  (many-to-many, Claude-assigned confidence)
-- =========================================================================
create table if not exists public.creator_categories (
  creator_id  uuid not null references public.creators (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  confidence  numeric not null default 1.0,
  primary key (creator_id, category_id)
);

create index if not exists creator_categories_category_idx on public.creator_categories (category_id);

alter table public.creator_categories enable row level security;

drop policy if exists "Creator categories are public-read" on public.creator_categories;
create policy "Creator categories are public-read" on public.creator_categories
  for select using (true);

drop policy if exists "Creator categories are editable by claimant" on public.creator_categories;
create policy "Creator categories are editable by claimant" on public.creator_categories
  for all using (public.owns_creator(creator_id)) with check (public.owns_creator(creator_id));

-- =========================================================================
-- CONTACT_PREFERENCES  (opt-out / deletion — checked before any outreach)
-- =========================================================================
create table if not exists public.contact_preferences (
  creator_id           uuid primary key references public.creators (id) on delete cascade,
  opt_out_at           timestamptz,
  deletion_requested_at timestamptz,
  updated_at           timestamptz not null default now()
);

alter table public.contact_preferences enable row level security;

drop policy if exists "Contact prefs readable by claimant" on public.contact_preferences;
create policy "Contact prefs readable by claimant" on public.contact_preferences
  for select using (public.owns_creator(creator_id));

drop policy if exists "Contact prefs writable by claimant" on public.contact_preferences;
create policy "Contact prefs writable by claimant" on public.contact_preferences
  for all using (public.owns_creator(creator_id)) with check (public.owns_creator(creator_id));

-- helper: is a creator currently reachable (not opted out, not deletion-pending)?
create or replace function public.creator_is_contactable(target_creator uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from public.contact_preferences p
    where p.creator_id = target_creator
      and (p.opt_out_at is not null or p.deletion_requested_at is not null)
  );
$$;

-- =========================================================================
-- CREATOR_CONTACTS  (business email only at MVP — see plan compliance notes)
-- =========================================================================
-- One row per creator: a creator has at most one business email + one
-- creator-supplied phone on file at a time (the unique constraint also
-- makes ingestion/seeding idempotent via upsert-on-creator_id).
create table if not exists public.creator_contacts (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null unique references public.creators (id) on delete cascade,
  email       text,
  phone       text, -- populated only when the creator supplies it themselves at claim time
  source      text not null default 'public_profile', -- public_profile | self_provided
  verified_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists creator_contacts_creator_idx on public.creator_contacts (creator_id);

alter table public.creator_contacts enable row level security;

-- Contacts are visible only to signed-in sponsor org members, and only while
-- the creator hasn't opted out or requested deletion. The claimant can always
-- see (and correct) their own contact record.
drop policy if exists "Contacts readable by sponsors when contactable" on public.creator_contacts;
create policy "Contacts readable by sponsors when contactable" on public.creator_contacts
  for select using (
    public.owns_creator(creator_id)
    or (auth.uid() is not null and public.creator_is_contactable(creator_id))
  );

drop policy if exists "Contacts writable by claimant" on public.creator_contacts;
create policy "Contacts writable by claimant" on public.creator_contacts
  for all using (public.owns_creator(creator_id)) with check (public.owns_creator(creator_id));

-- =========================================================================
-- ROI_SCORES  (transparent 0-1000 composite; see src/lib/roi/score.ts)
-- =========================================================================
create table if not exists public.roi_scores (
  creator_id   uuid primary key references public.creators (id) on delete cascade,
  score        int, -- null until >= 30 days of history exist
  grade        text, -- A | B | C | D | F
  components   jsonb not null default '{}'::jsonb,
  algo_version text not null default 'v1',
  computed_at  timestamptz not null default now()
);

alter table public.roi_scores enable row level security;

drop policy if exists "ROI scores are public-read" on public.roi_scores;
create policy "ROI scores are public-read" on public.roi_scores
  for select using (true);

-- =========================================================================
-- CLAIM_REQUESTS  (phase 6 — claim-your-page verification)
-- =========================================================================
create table if not exists public.claim_requests (
  id                 uuid primary key default gen_random_uuid(),
  creator_id         uuid not null references public.creators (id) on delete cascade,
  user_id            uuid not null references auth.users (id) on delete cascade,
  method             text not null, -- oauth_youtube | bio_token
  verification_token text,
  status             text not null default 'pending', -- pending | verified | rejected
  verified_at        timestamptz,
  created_at         timestamptz not null default now()
);

create index if not exists claim_requests_creator_idx on public.claim_requests (creator_id);

alter table public.claim_requests enable row level security;

drop policy if exists "Claim requests are self-access" on public.claim_requests;
create policy "Claim requests are self-access" on public.claim_requests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================================================
-- CONVERSATIONS + MESSAGES  (one thread per sponsor org <-> creator pair)
-- =========================================================================
create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  creator_id uuid not null references public.creators (id) on delete cascade,
  subject    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, creator_id)
);

create index if not exists conversations_org_idx on public.conversations (org_id);
create index if not exists conversations_creator_idx on public.conversations (creator_id);

alter table public.conversations enable row level security;

-- helper: is the calling user a participant in this conversation (sponsor-side
-- org member, or the creator who claimed the other side)?
create or replace function public.is_conversation_participant(target_conversation uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversations c
    where c.id = target_conversation
      and (public.is_org_member(c.org_id) or public.owns_creator(c.creator_id))
  );
$$;

drop policy if exists "Conversations readable by participants" on public.conversations;
create policy "Conversations readable by participants" on public.conversations
  for select using (public.is_conversation_participant(id));

drop policy if exists "Conversations creatable by sponsor org members" on public.conversations;
create policy "Conversations creatable by sponsor org members" on public.conversations
  for insert with check (public.is_org_member(org_id));

drop trigger if exists conversations_touch on public.conversations;
create trigger conversations_touch before update on public.conversations
  for each row execute function public.touch_updated_at();

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_type     text not null, -- sponsor | creator
  sender_user_id  uuid references auth.users (id) on delete set null,
  body            text not null,
  ai_drafted      boolean not null default false,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);

alter table public.messages enable row level security;

drop policy if exists "Messages readable by participants" on public.messages;
create policy "Messages readable by participants" on public.messages
  for select using (public.is_conversation_participant(conversation_id));

drop policy if exists "Messages sendable by participants" on public.messages;
create policy "Messages sendable by participants" on public.messages
  for insert with check (
    public.is_conversation_participant(conversation_id) and sender_user_id = auth.uid()
  );

-- =========================================================================
-- DOCUMENTS  (Claude-generated briefs / term sheets, attached to a thread)
-- =========================================================================
create table if not exists public.documents (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  kind            text not null, -- campaign_brief | term_sheet | insertion_order | deliverables_schedule
  title           text not null,
  content         jsonb not null default '{}'::jsonb,
  status          text not null default 'draft', -- draft | sent | accepted
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists documents_conversation_idx on public.documents (conversation_id);

alter table public.documents enable row level security;

drop policy if exists "Documents readable by participants" on public.documents;
create policy "Documents readable by participants" on public.documents
  for select using (public.is_conversation_participant(conversation_id));

drop policy if exists "Documents writable by participants" on public.documents;
create policy "Documents writable by participants" on public.documents
  for all using (public.is_conversation_participant(conversation_id))
  with check (public.is_conversation_participant(conversation_id));

drop trigger if exists documents_touch on public.documents;
create trigger documents_touch before update on public.documents
  for each row execute function public.touch_updated_at();

-- =========================================================================
-- TALENT_LISTS + ITEMS  (the Sales-Nav "save to list" layer)
-- =========================================================================
create table if not exists public.talent_lists (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  name       text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists talent_lists_org_idx on public.talent_lists (org_id);

alter table public.talent_lists enable row level security;

drop policy if exists "Talent lists managed by org members" on public.talent_lists;
create policy "Talent lists managed by org members" on public.talent_lists
  for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

create table if not exists public.talent_list_items (
  list_id    uuid not null references public.talent_lists (id) on delete cascade,
  creator_id uuid not null references public.creators (id) on delete cascade,
  note       text,
  added_at   timestamptz not null default now(),
  primary key (list_id, creator_id)
);

alter table public.talent_list_items enable row level security;

-- helper: does the calling user belong to the org that owns this list?
create or replace function public.owns_talent_list(target_list uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.talent_lists l where l.id = target_list and public.is_org_member(l.org_id)
  );
$$;

drop policy if exists "Talent list items managed by list owners" on public.talent_list_items;
create policy "Talent list items managed by list owners" on public.talent_list_items
  for all using (public.owns_talent_list(list_id)) with check (public.owns_talent_list(list_id));

-- =========================================================================
-- SAVED_SEARCHES
-- =========================================================================
create table if not exists public.saved_searches (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  user_id    uuid references auth.users (id) on delete set null,
  name       text not null,
  query      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists saved_searches_org_idx on public.saved_searches (org_id);

alter table public.saved_searches enable row level security;

drop policy if exists "Saved searches managed by org members" on public.saved_searches;
create policy "Saved searches managed by org members" on public.saved_searches
  for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

-- =========================================================================
-- CREATOR_REACH  (view: latest cumulative follower/view totals per creator,
-- summed across every connected platform account — powers the search facet
-- filters and the follower count shown on creator cards without requiring
-- the client to walk every account's metric history).
-- security_invoker: the view runs under the *querying* user's RLS, not the
-- view owner's — matters even though the underlying tables are public-read.
-- =========================================================================
create or replace view public.creator_reach
with (security_invoker = true) as
with latest_per_account as (
  select distinct on (am.creator_account_id)
    am.creator_account_id,
    am.followers,
    am.total_views,
    am.snapshot_date
  from public.account_metrics am
  order by am.creator_account_id, am.snapshot_date desc
)
select
  ca.creator_id,
  sum(l.followers)::bigint as total_followers,
  sum(l.total_views)::bigint as total_views,
  max(l.snapshot_date) as latest_snapshot_date
from public.creator_accounts ca
join latest_per_account l on l.creator_account_id = ca.id
group by ca.creator_id;

-- =========================================================================
-- CREATOR_PREFERENCES  (what a creator is open to — public, so sponsors can
-- see fit at a glance on the profile; writable only by the claimant, mirrors
-- contact_preferences' shape and owns_creator() RLS pattern).
-- =========================================================================
create table if not exists public.creator_preferences (
  creator_id            uuid primary key references public.creators (id) on delete cascade,
  open_to_sponsorships  boolean not null default true,
  product_types         text[] not null default '{}',
  products_i_use        text[] not null default '{}',
  dream_brands          text[] not null default '{}',
  excluded_topics       text[] not null default '{}', -- e.g. gambling, alcohol, crypto
  content_formats       text[] not null default '{}', -- e.g. long-form, shorts, livestream
  min_rate_cents        int,
  rate_notes            text,
  updated_at            timestamptz not null default now()
);

alter table public.creator_preferences enable row level security;

drop policy if exists "Creator preferences are public-read" on public.creator_preferences;
create policy "Creator preferences are public-read" on public.creator_preferences
  for select using (true);

drop policy if exists "Creator preferences writable by claimant" on public.creator_preferences;
create policy "Creator preferences writable by claimant" on public.creator_preferences
  for all using (public.owns_creator(creator_id)) with check (public.owns_creator(creator_id));

drop trigger if exists creator_preferences_touch on public.creator_preferences;
create trigger creator_preferences_touch before update on public.creator_preferences
  for each row execute function public.touch_updated_at();

-- =========================================================================
-- ORG_PRODUCTS  (what a sponsor has to place — feeds the matching RPC below)
-- =========================================================================
create table if not exists public.org_products (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  name            text not null,
  description     text,
  category_id     uuid references public.categories (id) on delete set null,
  topics          text[] not null default '{}',
  target_audience text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists org_products_org_idx on public.org_products (org_id);
create index if not exists org_products_category_idx on public.org_products (category_id);

alter table public.org_products enable row level security;

drop policy if exists "Org products managed by org members" on public.org_products;
create policy "Org products managed by org members" on public.org_products
  for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

drop trigger if exists org_products_touch on public.org_products;
create trigger org_products_touch before update on public.org_products
  for each row execute function public.touch_updated_at();

-- =========================================================================
-- MATCH_CREATORS_FOR_PRODUCT  (server-side RPC — deliberately NOT layered on
-- searchCreators()/queries.ts, which applies its follower/ROI filters and
-- sorting in JS *after* a paginated .range() and therefore only sees the
-- current page. A relevance feed needs to rank the whole table, so this is
-- a real SQL query instead.)
--
-- Scoring is a simple weighted sum, 0-100:
--   40  category match (creator's categories vs. the product's category)
--   30  topic overlap (product.topics vs. creator_preferences.product_types
--       + products_i_use + dream_brands, case-insensitive)
--   20  ROI score, scaled from its native 0-1000 range
--   10  reach tier bucket, scaled from creator_reach.total_followers
-- A creator is excluded entirely (not just down-ranked) when:
--   - they've opted out of sponsorships (open_to_sponsorships = false), or
--   - any of the product's topics appears in their excluded_topics.
-- =========================================================================
create or replace function public.match_creators_for_product(target_product uuid, result_limit int default 20)
returns table (
  creator_id uuid,
  match_score numeric,
  category_match boolean,
  topic_overlap_count int
)
language sql stable security invoker set search_path = public as $$
  with product as (
    select id, org_id, category_id, topics from public.org_products where id = target_product
  ),
  eligible as (
    select c.id as creator_id
    from public.creators c
    left join public.creator_preferences cp on cp.creator_id = c.id
    where coalesce(cp.open_to_sponsorships, true)
      and not exists (
        select 1 from product p
        where cp.excluded_topics is not null
          and cp.excluded_topics && p.topics
      )
  ),
  category_scores as (
    select e.creator_id,
      exists (
        select 1 from public.creator_categories cc, product p
        where cc.creator_id = e.creator_id and p.category_id is not null and cc.category_id = p.category_id
      ) as category_match
    from eligible e
  ),
  topic_scores as (
    select e.creator_id,
      coalesce((
        select count(*)::int from product p,
          unnest(p.topics) as topic
        where exists (
          select 1 from public.creator_preferences cp
          where cp.creator_id = e.creator_id
            and (
              lower(topic) = any (select lower(x) from unnest(cp.product_types) as x)
              or lower(topic) = any (select lower(x) from unnest(cp.products_i_use) as x)
              or lower(topic) = any (select lower(x) from unnest(cp.dream_brands) as x)
            )
        )
      ), 0) as topic_overlap_count
    from eligible e
  ),
  reach_scores as (
    select e.creator_id, coalesce(cr.total_followers, 0) as total_followers
    from eligible e
    left join public.creator_reach cr on cr.creator_id = e.creator_id
  ),
  roi_scores_scaled as (
    select e.creator_id, coalesce(rs.score, 0) as score
    from eligible e
    left join public.roi_scores rs on rs.creator_id = e.creator_id
  )
  select
    e.creator_id,
    (
      40 * (case when cs.category_match then 1 else 0 end)
      + 30 * least(ts.topic_overlap_count, 3) / 3.0
      + 20 * (rss.score / 1000.0)
      + 10 * least(ln(1 + rs.total_followers) / ln(1 + 5000000), 1.0)
    )::numeric(6, 2) as match_score,
    cs.category_match,
    ts.topic_overlap_count
  from eligible e
  join category_scores cs on cs.creator_id = e.creator_id
  join topic_scores ts on ts.creator_id = e.creator_id
  join reach_scores rs on rs.creator_id = e.creator_id
  join roi_scores_scaled rss on rss.creator_id = e.creator_id
  order by match_score desc, rss.score desc nulls last
  limit result_limit;
$$;

-- =========================================================================
-- NOLAN  (creator-facing AI advisor threads — distinct from conversations,
-- which are sponsor<->creator and require both an org_id and a creator_id.
-- A Nolan thread has no sponsor side at all.)
-- =========================================================================
create table if not exists public.nolan_threads (
  id         uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  title      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nolan_threads_creator_idx on public.nolan_threads (creator_id);

alter table public.nolan_threads enable row level security;

drop policy if exists "Nolan threads are owner-access" on public.nolan_threads;
create policy "Nolan threads are owner-access" on public.nolan_threads
  for all using (public.owns_creator(creator_id)) with check (public.owns_creator(creator_id));

drop trigger if exists nolan_threads_touch on public.nolan_threads;
create trigger nolan_threads_touch before update on public.nolan_threads
  for each row execute function public.touch_updated_at();

-- helper: is the calling user the owner of this Nolan thread?
create or replace function public.owns_nolan_thread(target_thread uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.nolan_threads t where t.id = target_thread and public.owns_creator(t.creator_id)
  );
$$;

create table if not exists public.nolan_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.nolan_threads (id) on delete cascade,
  role       text not null, -- user | assistant
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists nolan_messages_thread_idx on public.nolan_messages (thread_id, created_at);

alter table public.nolan_messages enable row level security;

drop policy if exists "Nolan messages are owner-access" on public.nolan_messages;
create policy "Nolan messages are owner-access" on public.nolan_messages
  for all using (public.owns_nolan_thread(thread_id)) with check (public.owns_nolan_thread(thread_id));

-- Uploaded contracts/screenshots and their extracted structured review.
-- storage_path points into the private "nolan-uploads" bucket (see below).
create table if not exists public.nolan_documents (
  id             uuid primary key default gen_random_uuid(),
  thread_id      uuid not null references public.nolan_threads (id) on delete cascade,
  storage_path   text not null,
  file_name      text not null,
  media_type     text not null, -- application/pdf | image/png | image/jpeg
  review         jsonb, -- structured contract_review output — see NOLAN_SYSTEM_PROMPT
  created_at     timestamptz not null default now()
);

create index if not exists nolan_documents_thread_idx on public.nolan_documents (thread_id);

alter table public.nolan_documents enable row level security;

drop policy if exists "Nolan documents are owner-access" on public.nolan_documents;
create policy "Nolan documents are owner-access" on public.nolan_documents
  for all using (public.owns_nolan_thread(thread_id)) with check (public.owns_nolan_thread(thread_id));

-- Private storage bucket for contract/screenshot uploads. Objects are keyed
-- "<user_id>/<thread_id>/<filename>" so the policy can check ownership from
-- the path alone without a join.
insert into storage.buckets (id, name, public)
values ('nolan-uploads', 'nolan-uploads', false)
on conflict (id) do nothing;

drop policy if exists "Nolan uploads are owner-access" on storage.objects;
create policy "Nolan uploads are owner-access" on storage.objects
  for all
  using (bucket_id = 'nolan-uploads' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'nolan-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

-- =========================================================================
-- REALTIME  (live message delivery in the inbox — src/components/message-thread.tsx)
-- =========================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
