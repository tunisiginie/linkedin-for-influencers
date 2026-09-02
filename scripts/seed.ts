// Seeds ~60 realistic demo creators across every category, each with 180
// days of account_metrics history, so the ROI score, trajectory charts, and
// search facets have something real-shaped to work with from day one.
//
// Usage: npm run seed   (reads .env.local; needs SUPABASE_SERVICE_ROLE_KEY)

import "dotenv/config";
import { config as loadEnvLocal } from "dotenv";
loadEnvLocal({ path: ".env.local", override: true });

import { createClient } from "@supabase/supabase-js";
import { recomputeRoiScores } from "../src/lib/roi/recompute";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local — nothing to seed.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---- deterministic RNG so re-running the script produces the same demo data ----
function mulberry32(seed: number) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const COUNTRIES = ["US", "GB", "CA", "AU", "DE", "FR", "BR", "IN", "JP", "MX", "NG", "PH"];
const LANGUAGES: Record<string, string> = {
  US: "en", GB: "en", CA: "en", AU: "en", DE: "de", FR: "fr",
  BR: "pt", IN: "en", JP: "ja", MX: "es", NG: "en", PH: "en",
};

type GrowthProfile = "steady" | "viral" | "dormant" | "bot";

interface CreatorSeed {
  name: string;
  categorySlug: string;
  profile: GrowthProfile;
}

// 12 categories x 5 creators = 60. Names are invented placeholders for demo
// data, not real people or channels.
const CREATOR_SEEDS: CreatorSeed[] = [
  ["PixelForge Gaming", "NightOwl Plays", "Speedrun Sam", "Retro Respawn", "Clutch Kingdom"].map((n) => ({ name: n, categorySlug: "gaming", profile: "steady" as GrowthProfile })),
  ["Glow & Grace", "Bare Beauty Lab", "The Vanity Edit", "Skinlogic", "Palette Theory"].map((n) => ({ name: n, categorySlug: "beauty", profile: "steady" as GrowthProfile })),
  ["The Ledger Life", "Compound Curious", "Money Mechanics", "Bull Market Diaries", "Net Worth Notes"].map((n) => ({ name: n, categorySlug: "finance", profile: "steady" as GrowthProfile })),
  ["Iron Circuit", "Form & Function Fitness", "The Daily Rep", "Trail & Barbell", "Recovery Room"].map((n) => ({ name: n, categorySlug: "fitness", profile: "steady" as GrowthProfile })),
  ["Unboxed Weekly", "The Silicon Desk", "Gadget Grove", "Benchmark Bros", "Circuit Breaker"].map((n) => ({ name: n, categorySlug: "tech", profile: "steady" as GrowthProfile })),
  ["Simmered", "The Weeknight Table", "Flour & Flame", "Pantry Raid", "Slow Sunday Kitchen"].map((n) => ({ name: n, categorySlug: "food", profile: "steady" as GrowthProfile })),
  ["Offbeat Itinerary", "Two Passports", "The Layover Life", "Backroad Atlas", "Departure Lounge"].map((n) => ({ name: n, categorySlug: "travel", profile: "steady" as GrowthProfile })),
  ["Explain Like I'm Five", "The Study Hall", "Curious Curriculum", "Lecture Hall Leaks", "Mind Over Matter"].map((n) => ({ name: n, categorySlug: "education", profile: "steady" as GrowthProfile })),
  ["Deadpan Diaries", "Sketch Surplus", "The Punchline Pub", "Improv Overload", "Comedy Cul-de-Sac"].map((n) => ({ name: n, categorySlug: "comedy", profile: "steady" as GrowthProfile })),
  ["Analog Static", "The Mixdown", "Bedroom Producer", "Chord Theory", "Setlist Sessions"].map((n) => ({ name: n, categorySlug: "music", profile: "steady" as GrowthProfile })),
  ["The Tantrum Files", "Nap Schedule Nation", "Two Under Two", "Parenting Unfiltered", "The Sippy Cup Diaries"].map((n) => ({ name: n, categorySlug: "parenting", profile: "steady" as GrowthProfile })),
  ["Thrifted & Tailored", "Capsule Theory", "Street Cut", "The Seasonal Closet", "Runway Rundown"].map((n) => ({ name: n, categorySlug: "fashion", profile: "steady" as GrowthProfile })),
].flat();

// Sprinkle in variety so the ROI distribution (and the compliance flows) are
// realistic: a few breakout/viral creators, a few dormant ones, and a couple
// of bot-inflated accounts to demonstrate the authenticity component.
const VARIETY_OVERRIDES: Record<number, GrowthProfile> = {
  2: "viral", 9: "viral", 16: "viral", 23: "viral",
  5: "dormant", 12: "dormant", 19: "dormant",
  33: "bot", 47: "bot",
};
for (const [idx, profile] of Object.entries(VARIETY_OVERRIDES)) {
  CREATOR_SEEDS[Number(idx)].profile = profile;
}

function genSeries(
  rand: () => number,
  profile: GrowthProfile,
  baseFollowers: number,
): {
  snapshot_date: string;
  followers: number;
  total_views: number;
  avg_views: number;
  likes: number;
  comments: number;
  watch_hours: number;
  upload_count: number;
}[] {
  const days = 180;
  const today = new Date();
  const rows = [];

  let followers = baseFollowers;
  let totalViews = Math.round(baseFollowers * (8 + rand() * 12));
  let uploadCount = Math.round(20 + rand() * 200);

  const dailyGrowthRate =
    profile === "viral" ? 0.012 + rand() * 0.01 :
    profile === "steady" ? 0.002 + rand() * 0.003 :
    profile === "dormant" ? -0.0015 + rand() * 0.001 :
    0.02 + rand() * 0.015; // bot: implausibly fast

  const engagementRate =
    profile === "bot" ? 0.0005 + rand() * 0.001 :
    profile === "dormant" ? 0.01 + rand() * 0.01 :
    0.03 + rand() * 0.05;

  const commentShare = profile === "bot" ? 0.01 : 0.05 + rand() * 0.05;
  const uploadCadenceDays = profile === "dormant" ? 30 : Math.round(2 + rand() * 5);

  for (let day = 0; day < days; day++) {
    const date = new Date(today.getTime() - (days - day) * 86_400_000);
    followers = Math.max(100, Math.round(followers * (1 + dailyGrowthRate + (rand() - 0.5) * 0.002)));
    const dailyViews = Math.round(followers * (0.05 + rand() * 0.05));
    totalViews += dailyViews;

    const postedToday =
      profile !== "dormant"
        ? day % uploadCadenceDays === 0
        : day < 15 && day % 10 === 0; // dormant creators stopped posting ~5 months ago
    if (postedToday) uploadCount += 1;

    const avgViews = Math.round(followers * (profile === "bot" ? 0.9 + rand() * 0.3 : 0.15 + rand() * 0.25));
    const likes = Math.round(avgViews * engagementRate * (1 - commentShare));
    const comments = Math.round(avgViews * engagementRate * commentShare);
    const watchHours = Math.round((dailyViews * (2 + rand() * 6)) / 60);

    rows.push({
      snapshot_date: date.toISOString().slice(0, 10),
      followers,
      total_views: totalViews,
      avg_views: avgViews,
      likes,
      comments,
      watch_hours: watchHours,
      upload_count: uploadCount,
    });
  }

  return rows;
}

async function main() {
  console.log(`Seeding ${CREATOR_SEEDS.length} demo creators...`);

  const { data: categories } = await supabase.from("categories").select("id, slug");
  const { data: platforms } = await supabase.from("platforms").select("id, slug");
  if (!categories?.length || !platforms?.length) {
    console.error(
      "categories/platforms are empty — run supabase/schema.sql against this project first.",
    );
    process.exit(1);
  }
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c.id]));
  const youtubeId = platforms.find((p) => p.slug === "youtube")!.id;
  const instagramId = platforms.find((p) => p.slug === "instagram")!.id;
  const tiktokId = platforms.find((p) => p.slug === "tiktok")!.id;

  const createdCreatorIds: string[] = [];

  for (let i = 0; i < CREATOR_SEEDS.length; i++) {
    const seed = CREATOR_SEEDS[i];
    const rand = mulberry32(1000 + i * 7919);
    const slug = slugify(seed.name);
    const categoryId = categoryBySlug.get(seed.categorySlug);
    if (!categoryId) continue;

    const country = COUNTRIES[Math.floor(rand() * COUNTRIES.length)];
    const yearsActiveSince = new Date().getFullYear() - (1 + Math.floor(rand() * 8));
    const baseFollowers =
      seed.profile === "viral" ? 40_000 + rand() * 200_000 :
      seed.profile === "bot" ? 500_000 + rand() * 2_000_000 :
      seed.profile === "dormant" ? 20_000 + rand() * 80_000 :
      5_000 + rand() * 300_000;

    const { data: creator, error: creatorError } = await supabase
      .from("creators")
      .upsert(
        {
          slug,
          display_name: seed.name,
          headline: `${seed.categorySlug[0].toUpperCase()}${seed.categorySlug.slice(1)} creator`,
          bio: `${seed.name} makes ${seed.categorySlug} content for a growing audience. Demo profile — auto-generated for the platform seed dataset.`,
          avatar_url: `https://api.dicebear.com/9.x/thumbs/svg?seed=${slug}`,
          cover_url: `https://picsum.photos/seed/${slug}/1200/300`,
          country,
          language: LANGUAGES[country] ?? "en",
          years_active_since: yearsActiveSince,
          is_seed_data: true,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();

    if (creatorError || !creator) {
      console.error(`  ! failed to upsert ${seed.name}:`, creatorError?.message);
      continue;
    }
    createdCreatorIds.push(creator.id);

    await supabase
      .from("creator_categories")
      .upsert({ creator_id: creator.id, category_id: categoryId, confidence: 0.95 }, { onConflict: "creator_id,category_id" });

    await supabase.from("contact_preferences").upsert(
      { creator_id: creator.id, opt_out_at: null, deletion_requested_at: null },
      { onConflict: "creator_id" },
    );

    // ~70% of demo creators publish a business email; the rest simulate the
    // "no public contact available" state the UI needs to handle.
    if (rand() < 0.7) {
      await supabase.from("creator_contacts").upsert(
        {
          creator_id: creator.id,
          email: `business@${slug.replace(/-/g, "")}.example`,
          source: "public_profile",
        },
        { onConflict: "creator_id" },
      );
    }

    // Primary platform: YouTube for everyone (that's what we can ingest for
    // real); a subset also get a seeded Instagram/TikTok account so
    // multi-platform aggregation has something to aggregate.
    const platformChoices = [
      { platformId: youtubeId, slug: "youtube" },
      ...(rand() < 0.5 ? [{ platformId: instagramId, slug: "instagram" }] : []),
      ...(rand() < 0.35 ? [{ platformId: tiktokId, slug: "tiktok" }] : []),
    ];

    for (const [pIdx, { platformId, slug: platformSlug }] of platformChoices.entries()) {
      const handle = `${slug}${pIdx > 0 ? `-${platformSlug}` : ""}`;
      const { data: account, error: accountError } = await supabase
        .from("creator_accounts")
        .upsert(
          {
            creator_id: creator.id,
            platform_id: platformId,
            handle,
            external_id: `seed-${platformSlug}-${slug}`,
            url: `https://${platformSlug}.example/${handle}`,
            is_primary: pIdx === 0,
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: "platform_id,external_id" },
        )
        .select("id")
        .single();

      if (accountError || !account) {
        console.error(`  ! failed to upsert account for ${seed.name}/${platformSlug}:`, accountError?.message);
        continue;
      }

      // Split the follower base across platforms so multi-platform creators
      // don't just triple their reach.
      const share = pIdx === 0 ? 0.6 : 0.4 / Math.max(1, platformChoices.length - 1);
      const series = genSeries(rand, seed.profile, Math.round(baseFollowers * share));

      const rowsWithAccount = series.map((row) => ({ ...row, creator_account_id: account.id }));
      // Insert in chunks — 180 rows per account is fine in one call, but
      // batch defensively in case a platform has many accounts.
      const { error: metricsError } = await supabase
        .from("account_metrics")
        .upsert(rowsWithAccount, { onConflict: "creator_account_id,snapshot_date" });
      if (metricsError) {
        console.error(`  ! failed to insert metrics for ${seed.name}/${platformSlug}:`, metricsError.message);
      }
    }

    console.log(`  ✓ ${seed.name} (${seed.categorySlug}, ${seed.profile})`);
  }

  console.log("Recomputing ROI scores...");
  const summary = await recomputeRoiScores(supabase, { creatorIds: createdCreatorIds });
  console.log(`  scored ${summary.scored}, skipped ${summary.skipped} (insufficient history)`);

  console.log(`Done. Seeded ${createdCreatorIds.length} creators.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
