"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyClaimedCreator, requireUser } from "@/lib/auth";
import { getOrgIdForUser } from "@/lib/queries";

/** Sets the caller's declared role. This is the only place in the app that
 * writes `profiles.account_type` after signup — the signup trigger sets it
 * once with `on conflict do nothing`, so without this the value is
 * permanent even when wrong (e.g. an OAuth user who never passed signup
 * metadata, silently defaulted to "sponsor"). Deliberately can't set
 * "admin" — that's a manual operator action, not a self-service choice. */
export async function setAccountType(formData: FormData): Promise<void> {
  const user = await requireUser();
  const accountType = String(formData.get("account_type") ?? "");
  if (accountType !== "creator" && accountType !== "sponsor") {
    throw new Error("Invalid account type.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ account_type: accountType })
    .eq("id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/", "layout");
}

export async function updateProfile(formData: FormData): Promise<void> {
  const user = await requireUser();
  const fullName = String(formData.get("full_name") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName || null })
    .eq("id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/settings");
}

export async function updateCreatorProfile(formData: FormData): Promise<void> {
  const myCreator = await getMyClaimedCreator();
  if (!myCreator) throw new Error("No claimed profile to edit.");

  const headline = String(formData.get("headline") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim().toUpperCase();

  const supabase = await createClient();
  const { error } = await supabase
    .from("creators")
    .update({
      headline: headline || null,
      bio: bio || null,
      country: country || null,
    })
    .eq("id", myCreator.id);
  if (error) throw new Error(error.message);

  revalidatePath("/settings");
  revalidatePath(`/creators/${myCreator.slug}`);
}

/** Splits a comma-separated textarea value into a trimmed, non-empty string
 * array — the storage shape for creator_preferences' text[] columns. */
function parseTagList(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** What a creator is open to for sponsorships — surfaced on their public
 * profile so sponsors can see fit at a glance (see creator_preferences RLS:
 * public-read, writable only by the claimant). */
export async function updateCreatorPreferences(formData: FormData): Promise<void> {
  const myCreator = await getMyClaimedCreator();
  if (!myCreator) throw new Error("No claimed profile to edit.");

  const openToSponsorships = formData.get("open_to_sponsorships") === "true";
  const productTypes = parseTagList(formData.get("product_types"));
  const productsIUse = parseTagList(formData.get("products_i_use"));
  const dreamBrands = parseTagList(formData.get("dream_brands"));
  const excludedTopics = parseTagList(formData.get("excluded_topics"));
  const contentFormats = parseTagList(formData.get("content_formats"));
  const minRateRaw = String(formData.get("min_rate_dollars") ?? "").trim();
  const minRateCents = minRateRaw ? Math.round(Number(minRateRaw) * 100) : null;
  const rateNotes = String(formData.get("rate_notes") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase.from("creator_preferences").upsert(
    {
      creator_id: myCreator.id,
      open_to_sponsorships: openToSponsorships,
      product_types: productTypes,
      products_i_use: productsIUse,
      dream_brands: dreamBrands,
      excluded_topics: excludedTopics,
      content_formats: contentFormats,
      min_rate_cents: minRateCents !== null && !Number.isNaN(minRateCents) ? minRateCents : null,
      rate_notes: rateNotes || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "creator_id" },
  );
  if (error) throw new Error(error.message);

  revalidatePath("/settings");
  revalidatePath(`/creators/${myCreator.slug}`);
}

/** The creator-facing compliance toggle: opting out immediately blocks new
 * outreach (see sendMessage's contactability check). Toggling back on
 * clears deletion_requested_at too, since re-enabling contact implies the
 * creator no longer wants their data removed. */
export async function updateContactOptOut(formData: FormData): Promise<void> {
  const myCreator = await getMyClaimedCreator();
  if (!myCreator) throw new Error("No claimed profile.");

  const optOut = formData.get("opt_out") === "true";

  const supabase = await createClient();
  const { error } = await supabase.from("contact_preferences").upsert(
    {
      creator_id: myCreator.id,
      opt_out_at: optOut ? new Date().toISOString() : null,
      deletion_requested_at: optOut ? undefined : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "creator_id" },
  );
  if (error) throw new Error(error.message);

  revalidatePath("/settings");
}

export async function requestDataDeletion(): Promise<void> {
  const myCreator = await getMyClaimedCreator();
  if (!myCreator) throw new Error("No claimed profile.");

  const supabase = await createClient();
  const { error } = await supabase.from("contact_preferences").upsert(
    {
      creator_id: myCreator.id,
      opt_out_at: new Date().toISOString(),
      deletion_requested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "creator_id" },
  );
  if (error) throw new Error(error.message);

  revalidatePath("/settings");
}

export async function updateOrganization(formData: FormData): Promise<void> {
  const user = await requireUser();
  const orgId = await getOrgIdForUser(user.id);
  if (!orgId) throw new Error("No organization to edit.");

  const name = String(formData.get("name") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim();
  if (!name) throw new Error("Organization name is required.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ name, website: website || null })
    .eq("id", orgId);
  if (error) throw new Error(error.message);

  revalidatePath("/settings");
}
