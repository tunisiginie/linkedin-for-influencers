import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { roleHome } from "@/lib/role";
import type { AccountType } from "@/lib/types";

/** Handles the email-confirmation / OAuth redirect: exchanges the code for a
 * session. An explicit `?next=` always wins; otherwise this sends the user
 * to their role home rather than always to "/". */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const explicitNext = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (explicitNext) return NextResponse.redirect(`${origin}${explicitNext}`);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      let destination = "/";
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("account_type")
          .eq("id", user.id)
          .maybeSingle();
        destination = roleHome((profile?.account_type as AccountType | undefined) ?? null);
      }
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }
  return NextResponse.redirect(`${origin}/login`);
}
