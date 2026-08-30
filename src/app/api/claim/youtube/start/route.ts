import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Kicks off the Google OAuth flow for YouTube-ownership claim
 * verification. The `state` param carries the creator id — the callback
 * still verifies actual channel ownership (the OAuth'd channel id must
 * match that creator's stored YouTube external_id), so a tampered state
 * can't let someone claim a channel they don't own. */
export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "Google OAuth isn't configured on this deployment." },
      { status: 501 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { searchParams, origin } = new URL(request.url);
  const creatorId = searchParams.get("creator_id");
  const slug = searchParams.get("slug");
  if (!creatorId || !slug) {
    return NextResponse.json({ error: "Missing creator_id/slug" }, { status: 400 });
  }

  const redirectUri = `${origin}/api/claim/youtube/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/youtube.readonly",
    access_type: "online",
    prompt: "consent",
    state: JSON.stringify({ creatorId, slug }),
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
}
