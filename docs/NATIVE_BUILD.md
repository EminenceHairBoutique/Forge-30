# NATIVE_BUILD.md — the Capacitor/HealthKit path (v3 Phase 3)

Two build targets, one codebase. The PWA (Vercel) stays the primary distribution; the native
shell exists because HealthKit requires it, and as the future App Store path.

## Web build (unchanged)
`npm run build` — API routes, headers, service worker. Nothing in this doc affects it.

## Native web assets
```bash
NEXT_PUBLIC_API_ORIGIN=https://<deployed-origin> npm run build:native
```
Static export can't contain API route handlers, so the script moves `app/api` aside, runs
`BUILD_TARGET=capacitor next build` (`output: "export"` → `out-native/`), and restores it in
a `finally`. `/api/*` calls go to the deployed origin via `lib/api.ts#apiUrl`, baked at this
build.

## iOS project (operator machine with Xcode)
```bash
npx cap add ios
npx cap sync ios
npx cap open ios
```
Then:
1. **HealthKit plugin** — pinned candidate `@perfood/capacitor-healthkit`; RE-VERIFY its
   maintenance status before installing (`npm i @perfood/capacitor-healthkit && npx cap sync`).
   The app talks to it through a `registerPlugin("CapacitorHealthkit")` bridge
   (`lib/health/healthkit.ts`), so swapping plugins means matching that bridge surface, not
   touching app code.
2. Xcode → Signing & Capabilities → add **HealthKit**.
3. `Info.plist`: `NSHealthShareUsageDescription` — "Forge30 reads steps, sleep, workouts and
   weight to pre-fill your daily log. You confirm every value before it counts."
4. Build to a device (HealthKit doesn't work in the simulator for most types).

## Behavior contract
- Web bundle ships zero HealthKit code (dynamic import behind the Capacitor bridge check).
- Detected steps/sleep appear as tap-to-accept chips in the Daily check sheet; manual entry
  always wins; permission denial = plain manual entry, no error states.
- HealthKit weight feeds the existing 7-day trend engine (`lib/engine/trends.ts`) —
  wire-up lands with the weight surface in Phase 4's adaptive targets.
