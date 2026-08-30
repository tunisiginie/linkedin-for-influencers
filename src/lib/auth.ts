import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { Creator, Profile } from "@/lib/types";

/** The current auth user, or null. */
export async function getUser() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** The current user's profile row, or null when signed out. */
export async function getProfile(): Promise<Profile | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return (data as Profile) ?? null;
}

/** The creator profile the signed-in user has claimed, or null. */
export async function getMyClaimedCreator(): Promise<Creator | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("creators")
    .select("*")
    .eq("claimed_by", user.id)
    .maybeSingle();
  return (data as Creator) ?? null;
}

/** The org id the signed-in user belongs to, or null. Creates one on first
 * sponsor login if they don't have one yet (auto-provisioning keeps the
 * sponsor onboarding flow to a single step). */
export async function getOrEnsureOrgId(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: existing } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (existing) return existing.org_id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: org, error } = await supabase
    .from("organizations")
    .insert({
      name: profile?.full_name ? `${profile.full_name}'s Team` : "My Organization",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !org) return null;

  await supabase.from("org_members").insert({ org_id: org.id, user_id: user.id, role: "owner" });
  return org.id;
}

/** Redirects to /login unless signed in. Returns the user when present. */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/** Redirects unless the signed-in user is an admin. */
export async function requireAdmin() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.is_admin) redirect("/");
  return profile;
}
