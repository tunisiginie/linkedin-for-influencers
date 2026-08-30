import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { finalizeYoutubeClaim } from "@/lib/actions/claim";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state");

  let creatorId: string | undefined;
  let slug: string | undefined;
  try {
    const state = stateRaw ? JSON.parse(stateRaw) : {};
    creatorId = state.creatorId;
    slug = state.slug;
  } catch {
    // fall through — handled by the missing-creatorId check below
  }

  if (!code || !creatorId || !slug) {
    return NextResponse.redirect(`${origin}/claim?error=invalid_state`);
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}/claim/${slug}?error=not_configured`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: `${origin}/api/claim/youtube/callback`,
      }),
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) throw new Error("No access token returned");

    const channelRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=id&mine=true",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const channelData = await channelRes.json();
    const channelId = channelData.items?.[0]?.id;
    if (!channelId) {
      return NextResponse.redirect(`${origin}/claim/${slug}?error=no_channel`);
    }

    const { data: account } = await supabase
      .from("creator_accounts")
      .select("id")
      .eq("creator_id", creatorId)
      .eq("external_id", channelId)
      .maybeSingle();

    if (!account) {
      return NextResponse.redirect(`${origin}/claim/${slug}?error=mismatch`);
    }

    await finalizeYoutubeClaim(creatorId, user.id);
    return NextResponse.redirect(`${origin}/settings?claimed=1`);
  } catch (err) {
    console.error("claim/youtube/callback failed:", err);
    return NextResponse.redirect(`${origin}/claim/${slug}?error=failed`);
  }
}
