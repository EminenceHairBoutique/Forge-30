import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor shell (v3 Phase 3). Exists because HealthKit requires a native
 * container; the PWA stays the primary distribution. Web assets come from
 * the static export (`npm run build:native` → out-native/); API calls go to
 * the deployed origin via NEXT_PUBLIC_API_ORIGIN baked at build time.
 */
const config: CapacitorConfig = {
  appId: "app.forge30",
  appName: "Forge30",
  webDir: "out-native",
  ios: {
    contentInset: "always",
  },
};

export default config;
