import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgIdForUser, getTalentLists } from "@/lib/queries";

/** Lightweight read used by the "save to list" dropdown on creator cards —
 * a plain server action isn't a great fit for a read, so this is a small
 * GET route instead. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ lists: [] });

  const orgId = await getOrgIdForUser(user.id);
  if (!orgId) return NextResponse.json({ lists: [] });

  const lists = await getTalentLists(orgId);
  return NextResponse.json({ lists });
}
