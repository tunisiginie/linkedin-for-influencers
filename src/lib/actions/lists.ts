"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrEnsureOrgId, requireUser } from "@/lib/auth";

export async function createTalentList(formData: FormData): Promise<{ id: string } | null> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("List name is required.");

  const orgId = await getOrEnsureOrgId();
  if (!orgId) throw new Error("Could not resolve an organization for this account.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("talent_lists")
    .insert({ org_id: orgId, name, created_by: user.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/lists");
  return data;
}

/** Used by the /lists page's "new list" form — creates the list, then
 * navigates straight into it. (SaveToListButton calls the plain
 * createTalentList above instead, since it must stay on the current page.) */
export async function createTalentListAndRedirect(formData: FormData): Promise<void> {
  const created = await createTalentList(formData);
  if (created) redirect(`/lists/${created.id}`);
}

export async function addCreatorToList(formData: FormData): Promise<void> {
  await requireUser();
  const listId = String(formData.get("list_id"));
  const creatorId = String(formData.get("creator_id"));
  if (!listId || !creatorId) throw new Error("Missing list_id/creator_id");

  const supabase = await createClient();
  const { error } = await supabase
    .from("talent_list_items")
    .upsert({ list_id: listId, creator_id: creatorId }, { onConflict: "list_id,creator_id" });
  if (error) throw new Error(error.message);

  revalidatePath(`/lists/${listId}`);
}

export async function removeCreatorFromList(formData: FormData): Promise<void> {
  await requireUser();
  const listId = String(formData.get("list_id"));
  const creatorId = String(formData.get("creator_id"));
  if (!listId || !creatorId) throw new Error("Missing list_id/creator_id");

  const supabase = await createClient();
  const { error } = await supabase
    .from("talent_list_items")
    .delete()
    .eq("list_id", listId)
    .eq("creator_id", creatorId);
  if (error) throw new Error(error.message);

  revalidatePath(`/lists/${listId}`);
}

export async function deleteTalentList(formData: FormData): Promise<void> {
  await requireUser();
  const listId = String(formData.get("list_id"));
  if (!listId) throw new Error("Missing list_id");

  const supabase = await createClient();
  const { error } = await supabase.from("talent_lists").delete().eq("id", listId);
  if (error) throw new Error(error.message);

  revalidatePath("/lists");
}
