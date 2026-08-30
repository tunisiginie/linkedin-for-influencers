# CreatorNetwork — LinkedIn for Influencers

Handoff notes. Read `AGENTS.md` for the coding conventions this repo requires.

## What it is

A two-sided professional network:

- **Creators** get an auto-generated profile consolidating their metrics across platforms, which they can claim and edit.
- **Sponsors** get Sales-Navigator-style faceted talent discovery, direct messaging, and Claude-assisted outreach + sponsorship paperwork.

The differentiator is the **ROI score** — a transparent 0–1000 composite that replaces "finger in the wind" creator evaluation. It is deliberately explainable: every profile shows the per-component breakdown, because a black-box score is not something a sponsor will spend money against.

## Status: MVP feature-complete, not yet run against live services

All six planned phases are built. `npm run build` and `npx eslint .` are clean; `npm test` passes 5/5 on the ROI algorithm.

**Verified:** compile, typecheck, lint, ROI unit tests, and browser-driven UI checks (all routes render, light/dark theme, mobile at 375px, auth redirects, 404s, zero console errors).

**Not verified — needs real keys:**
- Schema application + `npm run seed`
- Real YouTube ingestion
- Claude endpoints actually calling Anthropic
- Google OAuth claim round-trip
- RLS enforcement under a real authenticated session

That gap is the top of the to-do list.

## Getting running

```bash
npm install && cp .env.example .env.local
```

Minimum to see real data: the three `NEXT_PUBLIC_SUPABASE_*` / `SUPABASE_SERVICE_ROLE_KEY` values. Then paste `supabase/schema.sql` into the Supabase SQL editor (idempotent, safe to re-run), and:

```bash
npm run seed && npm run dev
```

Add `ANTHROPIC_API_KEY` for the AI features and `YOUTUBE_API_KEY` for real ingestion. Everything degrades gracefully without them — the app boots with zero secrets.

| Script | Does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run seed` | ~60 creators + 180 days of metrics history |
| `npm run ingest` | One-shot ingestion run |
| `npm test` | Vitest — ROI algorithm |
| `npx eslint .` | Lint (no `lint` script wrapper worth using; call directly) |

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Supabase (Postgres + Auth + RLS + Realtime) · Tailwind v4 · shadcn-generated **Base UI** primitives · `@anthropic-ai/sdk` · Vitest

Deliberately mirrors the sibling `../Rentapro` project — the Supabase client files and the graceful-degradation pattern were carried over from it.

## Architecture

### Data model (`supabase/schema.sql`, 19 tables, RLS on all)

The load-bearing design decision: **`account_metrics` is a time series**, one row per platform account per day. Growth rate, trajectory, and consistency all fall out of it. Everything else hangs off `creators`.

```
creators ─┬─ creator_accounts ── account_metrics   (daily snapshots)
          ├─ creator_categories ── categories
          ├─ creator_contacts                      (business email only)
          ├─ contact_preferences                   (opt-out / deletion)
          ├─ roi_scores                            (score + jsonb breakdown)
          └─ claim_requests

organizations ─ org_members
conversations ── messages, documents
talent_lists ── talent_list_items
```

Creator profiles are publicly readable (it's a directory). Contacts are readable only by authenticated sponsors *and only when not opted out*. Messages are participant-only. A `creator_reach` view aggregates latest-per-account followers/views. `messages` is added to the `supabase_realtime` publication for live inbox delivery.

### Ingestion (`src/lib/ingest/`)

`PlatformAdapter` interface with two implementations: `youtube.ts` (real, YouTube Data API v3) and `seeded.ts` (Instagram/TikTok fixtures). The UI can't tell them apart, so swapping in a paid aggregator later is one file.

YouTube costs ~3 quota units per creator refresh (`channels.list` + `playlistItems.list` + `videos.list`). **Never use `search.list`** — it's 100 units and would burn the 10k/day free quota in 100 calls. `run.ts` refreshes the stalest accounts first; `/api/cron/refresh` is the Vercel Cron target (daily 06:00, see `vercel.json`), guarded by `CRON_SECRET`.

### ROI score (`src/lib/roi/score.ts`)

0–1000 composite, `ALGO_VERSION = "v1"`, requires `MIN_HISTORY_DAYS = 30` or it returns null + "insufficient data" rather than a misleading number.

| Component | Weight | Why it predicts ROI |
|---|---|---|
| Reach | 20% | Ceiling on impressions |
| Engagement quality | 25% | Attention, not just eyeballs |
| Consistency | 15% | Predictable delivery = schedulable campaigns |
| Trajectory | 20% | Rising creators overdeliver vs. their rate card |
| Tenure | 10% | Longevity = lower flake risk |
| Audience authenticity | 10% | Cheap bot-inflation detector |

Each component normalizes against the creator's own category and size tier — a 50k finance channel and a 5M gaming channel aren't comparable on raw numbers. The full breakdown is stored in `roi_scores.components` (jsonb) and rendered on the profile. Tests in `score.test.ts` cover healthy / bot-inflated / dormant fixtures.

### Claude (`src/lib/claude.ts` + three routes)

| Route | Technique |
|---|---|
| `/api/assistant/search` | Tool use with `strict: true`; NL query → the same facet filters the sidebar produces |
| `/api/assistant/outreach` | Structured output; drafts a message the sponsor **must** review and send manually |
| `/api/documents/generate` | Structured output per document kind (campaign brief, term sheet, insertion order, deliverables schedule) → typed object rendered into a template |

All three share `PLATFORM_SYSTEM_PROMPT` behind a `cache_control` breakpoint, and all three return `{ type: "fallback" }` when `ANTHROPIC_API_KEY` is unset.

### Routes

Public: `/`, `/search`, `/creators/[slug]`, `/login`, `/signup`
Authed: `/dashboard` (role-aware), `/messages`, `/messages/[id]`, `/lists`, `/lists/[id]`, `/settings`, `/claim`, `/claim/[slug]`

## Next steps, in order

1. **Commit and push.** ~24 files are uncommitted on top of the single `Initial commit from Create Next App`. This is the actual blocker for sharing across machines.
2. **Wire a real Supabase project** and work through the unverified list above — schema apply, seed, then RLS spot-checks as anon / non-owner creator / sponsor.
3. **Ingest real YouTube handles** and confirm quota use matches the ~3 units/creator budget.
4. **Exercise the Claude routes** with a real key, then unset it and confirm every surface still degrades without throwing.
5. **Claim flow OAuth round-trip**, including the mismatch rejection path.

Deferred by design (phase 2): rate benchmarking ("what should this creator charge" — needs real deal volume to be honest), paid aggregator for global coverage, Stripe Connect payouts.
