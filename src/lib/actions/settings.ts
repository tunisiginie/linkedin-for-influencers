"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyClaimedCreator, requireUser } from "@/lib/auth";
import { getOrgIdForUser } from "@/lib/queries";

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
