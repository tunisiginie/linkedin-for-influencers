"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrEnsureOrgId, requireUser } from "@/lib/auth";

/** Finds or creates the (org, creator) conversation thread, then redirects
 * the sponsor into it. Creating an empty thread is harmless — the opt-out /
 * contactability guard lives on the first actual message send, not here. */
export async function startConversation(formData: FormData) {
  await requireUser();
  const creatorId = String(formData.get("creator_id"));
  if (!creatorId) throw new Error("Missing creator_id");

  const orgId = await getOrEnsureOrgId();
  if (!orgId) throw new Error("Could not resolve an organization for this account.");

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("org_id", orgId)
    .eq("creator_id", creatorId)
    .maybeSingle();

  if (existing) {
    redirect(`/messages/${existing.id}`);
  }

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({ org_id: orgId, creator_id: creatorId })
    .select("id")
    .single();

  if (error || !created) {
    throw new Error(error?.message ?? "Failed to start conversation.");
  }

  redirect(`/messages/${created.id}`);
}
