import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. BYPASSES Row Level Security.
 * Use ONLY in trusted server contexts (webhooks, admin actions) and never
 * expose the service-role key to the browser.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
