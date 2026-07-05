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
