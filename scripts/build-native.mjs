#!/usr/bin/env node
/**
 * Native (Capacitor) build — v3 Phase 3. Static export can't contain API
 * route handlers, so this script:
 *   1. moves app/api aside,
 *   2. runs `BUILD_TARGET=capacitor next build` (output: export → out-native/),
 *   3. restores app/api no matter what happened.
 * The native webview calls the deployed origin for /api/* — pass it as
 * NEXT_PUBLIC_API_ORIGIN (baked into the client bundle at this build).
 *
 *   NEXT_PUBLIC_API_ORIGIN=https://forge30.example npm run build:native
 */
import { execSync } from "node:child_process";
import { existsSync, renameSync } from "node:fs";

const API_DIR = "app/api";
const HIDDEN = ".api-excluded";

if (!process.env.NEXT_PUBLIC_API_ORIGIN) {
  console.error(
    "NEXT_PUBLIC_API_ORIGIN is required for the native build (the deployed origin serving /api/*)."
  );
  process.exit(1);
}

if (existsSync(HIDDEN)) {
  console.error(`${HIDDEN} already exists — a previous build crashed mid-run. Restore it first.`);
  process.exit(1);
}

renameSync(API_DIR, HIDDEN);
try {
  execSync("next build", {
    stdio: "inherit",
    env: { ...process.env, BUILD_TARGET: "capacitor" },
  });
  console.log("\nNative web assets in out-native/ — next: npx cap sync ios");
} finally {
  renameSync(HIDDEN, API_DIR);
}
