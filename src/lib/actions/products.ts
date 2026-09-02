"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrEnsureOrgId, requireUser } from "@/lib/auth";

function parseTopics(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createOrgProduct(formData: FormData): Promise<{ id: string } | null> {
  await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Product name is required.");

  const description = String(formData.get("description") ?? "").trim();
  const categoryId = String(formData.get("category_id") ?? "").trim();
  const topics = parseTopics(formData.get("topics"));
  const targetAudience = String(formData.get("target_audience") ?? "").trim();

  const orgId = await getOrEnsureOrgId();
  if (!orgId) throw new Error("Could not resolve an organization for this account.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("org_products")
    .insert({
      org_id: orgId,
      name,
      description: description || null,
      category_id: categoryId || null,
      topics,
      target_audience: targetAudience || null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/products");
  return data;
}

/** Used by the /products "new product" form — creates it, then navigates
 * straight into its matched-creators feed. */
export async function createOrgProductAndRedirect(formData: FormData): Promise<void> {
  const created = await createOrgProduct(formData);
  if (created) redirect(`/products/${created.id}`);
}

export async function updateOrgProduct(formData: FormData): Promise<void> {
  await requireUser();
  const productId = String(formData.get("product_id") ?? "");
  if (!productId) throw new Error("Missing product_id");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Product name is required.");
  const description = String(formData.get("description") ?? "").trim();
  const categoryId = String(formData.get("category_id") ?? "").trim();
  const topics = parseTopics(formData.get("topics"));
  const targetAudience = String(formData.get("target_audience") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase
    .from("org_products")
    .update({
      name,
      description: description || null,
      category_id: categoryId || null,
      topics,
      target_audience: targetAudience || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId);
  if (error) throw new Error(error.message);

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
}

export async function deleteOrgProduct(formData: FormData): Promise<void> {
  await requireUser();
  const productId = String(formData.get("product_id") ?? "");
  if (!productId) throw new Error("Missing product_id");

  const supabase = await createClient();
  const { error } = await supabase.from("org_products").delete().eq("id", productId);
  if (error) throw new Error(error.message);

  revalidatePath("/products");
}
