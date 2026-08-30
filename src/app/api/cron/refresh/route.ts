import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshStaleAccounts } from "@/lib/ingest/run";

// Vercel Cron target (configure in vercel.json → crons[]). Vercel sends
// `authorization: Bearer $CRON_SECRET` automatically when CRON_SECRET is set
// as an env var on the project; we re-check it here so the endpoint can't be
// triggered by anyone who finds the URL.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return NextResponse.json(
      { error: "Supabase is not configured on this deployment." },
      { status: 501 },
    );
  }

  try {
    const supabase = createAdminClient();
    const summary = await refreshStaleAccounts(supabase);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("cron/refresh failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
