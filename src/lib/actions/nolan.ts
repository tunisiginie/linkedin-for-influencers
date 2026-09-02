"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyClaimedCreator, requireCreator } from "@/lib/auth";

/** Starts a new Nolan thread for the calling creator and navigates into it.
 * Requires an actual claimed creator profile — Nolan's context (ROI
 * breakdown, metrics) is grounded in real creator data, so there's nothing
 * useful to talk about without one. */
export async function createNolanThread(): Promise<void> {
  await requireCreator();
  const myCreator = await getMyClaimedCreator();
  if (!myCreator) throw new Error("Claim your creator profile before talking to Nolan.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("nolan_threads")
    .insert({ creator_id: myCreator.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/nolan");
  redirect(`/nolan/${data.id}`);
}
