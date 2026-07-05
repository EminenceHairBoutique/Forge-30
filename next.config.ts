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
