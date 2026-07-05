import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalStorageAdapter } from "@/lib/storage/localStorageAdapter";
import type { CustomWorkoutPlan, UserProfile, WorkoutEntry } from "@/lib/types";

/**
 * §3.2 acceptance: switching programs mid-cycle is non-destructive. The
 * program only shapes FUTURE builder defaults (programBuilderDefaults); the
 * saved plan and logged workouts must come back byte-identical after the
 * profile's program changes.
 */

function fakeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
}

beforeEach(() => {
  (globalThis as { window?: unknown }).window = { localStorage: fakeLocalStorage() };
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("program switch is non-destructive", () => {
  it("changing profile.program leaves the saved plan and logged workouts untouched", async () => {
    const adapter = new LocalStorageAdapter();
    const profile = {
      name: "T",
      startDate: "2026-07-01",
      calorieTarget: 2400,
      proteinTarget: 150,
      waterTarget: 3000,
      weightGoal: "maintain",
      painFlags: {
        thoracic: false,
        rib: false,
        scapular: false,
        upperTrapDominant: false,
        leftArmAggravation: false,
      },
      dailySpendingLimit: 50,
      program: "first30",
      onboardingComplete: true,
    } as UserProfile;
    await adapter.saveProfile(profile);

    const plan: CustomWorkoutPlan = {
      id: "plan-1",
      name: "Build Muscle · 4 days",
      days: [],
      createdAt: "2026-07-01T10:00:00.000Z",
    };
    await adapter.saveCustomWorkoutPlan(plan);
    const workout: WorkoutEntry = {
      id: "w-1",
      date: "2026-07-03",
      splitLabel: "Push",
      status: "complete",
      exercises: [],
      sessionPainScore: 0,
    } as unknown as WorkoutEntry;
    await adapter.saveWorkout(workout);

    const planBefore = JSON.stringify(await adapter.getCustomWorkoutPlan());
    const workoutBefore = JSON.stringify(await adapter.getWorkout("2026-07-03"));

    await adapter.saveProfile({ ...profile, program: "busy30" });

    expect(JSON.stringify(await adapter.getCustomWorkoutPlan())).toBe(planBefore);
    expect(JSON.stringify(await adapter.getWorkout("2026-07-03"))).toBe(workoutBefore);
    expect((await adapter.getProfile())?.program).toBe("busy30");
  });
});
