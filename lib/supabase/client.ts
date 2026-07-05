import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client (v3 Phase 1). Null when the environment isn't
 * configured — the app then runs exactly as before: signed-out, local-only.
 * Only the public URL + anon key ever reach the client; the service-role key
 * exists solely in server routes.
 */

let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client =
    url && anonKey
      ? createClient(url, anonKey, {
          auth: { persistSession: true, autoRefreshToken: true },
        })
      : null;
  return client;
}

/** True when this build has a Supabase project configured at all. */
export function syncConfigured(): boolean {
  return getSupabase() !== null;
}
