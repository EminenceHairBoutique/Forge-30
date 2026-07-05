/**
 * API origin resolution (v3 Phase 3). On the web build, /api/* is same-
 * origin and this is a pass-through. In the Capacitor build the webview
 * runs from capacitor://localhost, so API calls target the deployed origin
 * baked in at native-build time via NEXT_PUBLIC_API_ORIGIN.
 */
export function apiUrl(path: string): string {
  const origin = process.env.NEXT_PUBLIC_API_ORIGIN ?? "";
  return `${origin}${path}`;
}

/**
 * Bearer auth headers for API calls when signed in (v3 Phase 7) — the
 * server resolves entitlements from this token. Signed-out/unconfigured
 * builds return {} and routes fall back per their graceful rules.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const { getSupabase } = await import("@/lib/supabase/client");
  const supabase = getSupabase();
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
