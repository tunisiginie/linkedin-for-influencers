"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";

/** Generates a one-time verification token and records a pending claim
 * request. The creator pastes the token into their channel description
 * temporarily; verifyBioTokenClaim re-reads the description to confirm it. */
export async function requestBioTokenClaim(formData: FormData): Promise<{ token: string }> {
  const user = await requireUser();
  const creatorId = String(formData.get("creator_id"));
  if (!creatorId) throw new Error("Missing creator_id");

  const token = `creatornetwork-verify-${randomBytes(6).toString("hex")}`;

  const supabase = await createClient();
  const { error } = await supabase.from("claim_requests").insert({
    creator_id: creatorId,
    user_id: user.id,
    method: "bio_token",
    verification_token: token,
    status: "pending",
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/claim/${creatorId}`);
  return { token };
}

export interface VerifyResult {
  ok: boolean;
  error?: string;
}

/** Re-fetches the creator's primary YouTube account's public description and
 * checks for the token. Uses the admin client for the final claimed_by
 * write since the RLS policy on `creators` only allows a claimant to update
 * a row they already own — a chicken-and-egg problem the first claim has to
 * cross once, under a server-verified condition. */
export async function verifyBioTokenClaim(formData: FormData): Promise<VerifyResult> {
  const user = await requireUser();
  const creatorId = String(formData.get("creator_id"));
  const token = String(formData.get("token"));
  if (!creatorId || !token) return { ok: false, error: "Missing claim details." };

  const supabase = await createClient();

  const { data: account } = await supabase
    .from("creator_accounts")
    .select("external_id, platforms(slug)")
    .eq("creator_id", creatorId)
    .eq("is_primary", true)
    .maybeSingle();

  if (!account?.external_id || (account.platforms as { slug?: string } | null)?.slug !== "youtube") {
    return { ok: false, error: "This creator's primary account isn't a verifiable YouTube channel." };
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return { ok: false, error: "YouTube verification isn't configured on this deployment." };

  try {
    const params = new URLSearchParams({ part: "snippet", id: account.external_id, key: apiKey });
    const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?${params}`);
    const data = await res.json();
    const description: string = data.items?.[0]?.snippet?.description ?? "";

    if (!description.includes(token)) {
      return { ok: false, error: "Token not found in the channel description yet." };
    }
  } catch {
    return { ok: false, error: "Verification failed — try again shortly." };
  }

  const admin = createAdminClient();
  const { error: claimError } = await admin
    .from("claim_requests")
    .update({ status: "verified", verified_at: new Date().toISOString() })
    .eq("creator_id", creatorId)
    .eq("user_id", user.id)
    .eq("verification_token", token);
  if (claimError) return { ok: false, error: claimError.message };

  const { error: creatorError } = await admin
    .from("creators")
    .update({ claimed_by: user.id, claimed_at: new Date().toISOString() })
    .eq("id", creatorId)
    .is("claimed_by", null);
  if (creatorError) return { ok: false, error: creatorError.message };

  // A successful claim is proof of being a creator — fix up account_type if
  // it's stale (e.g. defaulted to "sponsor" at signup). Never downgrades an
  // admin.
  await admin
    .from("profiles")
    .update({ account_type: "creator" })
    .eq("id", user.id)
    .eq("account_type", "sponsor");

  revalidatePath("/settings");
  revalidatePath(`/claim/${creatorId}`);
  return { ok: true };
}

/** Used after the OAuth callback confirms channel ownership (see
 * /api/claim/youtube/callback). Kept as a small server action so the
 * callback route doesn't need its own Supabase admin wiring duplicated. */
export async function finalizeYoutubeClaim(creatorId: string, userId: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("creators")
    .update({ claimed_by: userId, claimed_at: new Date().toISOString() })
    .eq("id", creatorId)
    .is("claimed_by", null);
  await admin
    .from("profiles")
    .update({ account_type: "creator" })
    .eq("id", userId)
    .eq("account_type", "sponsor");
  await admin.from("claim_requests").insert({
    creator_id: creatorId,
    user_id: userId,
    method: "oauth_youtube",
    status: "verified",
    verified_at: new Date().toISOString(),
  });
}
