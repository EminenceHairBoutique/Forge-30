import type { NextConfig } from "next";

/**
 * Two build targets, one codebase (v3 Phase 3):
 * - default: the Vercel-served PWA (API routes, headers, service worker).
 * - BUILD_TARGET=capacitor: static export for the native shell (HealthKit
 *   path). API routes can't exist in an export build, so the native build
 *   script (scripts/build-native.mjs) sets NEXT_PUBLIC_API_ORIGIN to the
 *   deployed origin and temporarily excludes app/api — see
 *   docs/NATIVE_BUILD.md. `headers()` is a server feature and is skipped in
 *   export mode.
 */
const isCapacitor = process.env.BUILD_TARGET === "capacitor";

const nextConfig: NextConfig = {
  ...(isCapacitor
    ? {
        output: "export" as const,
        distDir: "out-native",
        images: { unoptimized: true },
      }
    : {
        headers: async () => [
          {
            // Security headers (v3.3 §1.5) on every response. CSP notes:
            // - script-src needs 'unsafe-inline' for Next's hydration
            //   bootstrap (and 'unsafe-eval' only in dev for react-refresh).
            // - style-src 'unsafe-inline' for Tailwind's injected styles.
            // - connect-src https: covers Supabase + Open Food Facts, which
            //   are per-deployment origins; ws(s) is dev HMR.
            // API routes additionally reject cross-origin browser requests
            // via lib/server/origin.ts (Stripe webhook + cron exempt — they
            // authenticate by signature/secret).
            source: "/(.*)",
            headers: [
              { key: "X-Content-Type-Options", value: "nosniff" },
              { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
              { key: "X-Frame-Options", value: "DENY" },
              {
                key: "Permissions-Policy",
                value: "camera=(self), microphone=(self), geolocation=()",
              },
              {
                key: "Content-Security-Policy",
                value: [
                  "default-src 'self'",
                  process.env.NODE_ENV === "development"
                    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
                    : "script-src 'self' 'unsafe-inline'",
                  "style-src 'self' 'unsafe-inline'",
                  "img-src 'self' data: blob:",
                  "font-src 'self' data:",
                  "connect-src 'self' https: wss: ws:",
                  "media-src 'self' blob:",
                  "worker-src 'self'",
                  "frame-ancestors 'none'",
                  "base-uri 'self'",
                  "form-action 'self'",
                  "object-src 'none'",
                ].join("; "),
              },
            ],
          },
          {
            source: "/sw.js",
            headers: [
              { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
              { key: "Service-Worker-Allowed", value: "/" },
            ],
          },
          {
            source: "/manifest.json",
            headers: [{ key: "Content-Type", value: "application/manifest+json" }],
          },
        ],
      }),
};

export default nextConfig;
