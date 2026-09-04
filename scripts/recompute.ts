// Recomputes ROI scores for every creator from data already in the database
// — no platform fetches, no Claude calls. Use after changing the scoring
// algorithm (src/lib/roi/score.ts) or after content signals land out of band,
// when a full `npm run seed` or `npm run ingest` would be overkill.
//
// Usage: npm run recompute   (reads .env.local; needs SUPABASE_SERVICE_ROLE_KEY)

import "dotenv/config";
import { config as loadEnvLocal } from "dotenv";
loadEnvLocal({ path: ".env.local", override: true });

import { createClient } from "@supabase/supabase-js";
import { recomputeRoiScores } from "../src/lib/roi/recompute";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local — nothing to recompute.",
  );
  process.exit(1);
}

async function main() {
  const supabase = createClient(SUPABASE_URL as string, SERVICE_ROLE_KEY as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("Recomputing ROI scores for every creator...");
  const summary = await recomputeRoiScores(supabase);
  console.log(`  scored ${summary.scored}, skipped ${summary.skipped} (insufficient history)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
