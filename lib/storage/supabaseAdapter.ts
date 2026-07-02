import type { StorageAdapter } from "./adapter";

/**
 * Supabase upgrade path — NOT wired in the MVP.
 *
 * When multi-device sync is needed:
 *   1. `npm install @supabase/supabase-js`
 *   2. Create tables mirroring the collections in lib/types.ts
 *      (profiles, daily_logs, meals, saved_meals, workouts, journals,
 *       spending, sunday_reviews, skill_tasks, body_metrics, ai_reviews),
 *      each keyed by user_id + date (or id for append collections),
 *      with row-level security scoping rows to auth.uid().
 *   3. Implement every StorageAdapter method against those tables.
 *   4. Swap the adapter in lib/storage/provider.tsx — no UI changes needed,
 *      because components only ever talk to the StorageAdapter interface.
 *
 * The class below exists so the contract is scaffolded and type-checked now.
 */
export class SupabaseAdapter implements Partial<StorageAdapter> {
  constructor() {
    throw new Error(
      "SupabaseAdapter is a scaffold for the post-MVP upgrade path and is not implemented yet. Use LocalStorageAdapter."
    );
  }
}
