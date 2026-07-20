import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalStorageAdapter } from "./localStorageAdapter";
import { SCHEMA_VERSION, VERSION_KEY } from "./migrations";
import type { UserProfile } from "@/lib/types";

/**
 * Integration tests for the adapter's version-detection branches — the exact
 * paths future migrations are most likely to regress. Runs in Node against a
 * minimal in-memory localStorage stood up on globalThis.window.
 */

function fakeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    _dump: () => Object.fromEntries(store),
  };
}

const profileFixture: UserProfile = {
  name: "Alex",
  startDate: "2026-07-01",
  calorieTarget: 3050,
  proteinTarget: 170,
  waterTarget: 3000,
  weightGoal: "Gain 4–8 lb (lean-mass focus)",
  painFlags: {
    thoracic: true,
    rib: true,
    scapular: true,
    upperTrapDominant: true,
    leftArmAggravation: true,
  },
  dailySpendingLimit: 50,
  onboardingComplete: true,
};

let storage: ReturnType<typeof fakeLocalStorage>;
let adapter: LocalStorageAdapter;

beforeEach(async () => {
  storage = fakeLocalStorage();
  (globalThis as Record<string, unknown>).window = { localStorage: storage };
  adapter = new LocalStorageAdapter();
  // Clears keys AND re-arms the module-level migration check between tests.
  await adapter.resetAll();
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

describe("LocalStorageAdapter schema detection", () => {
  it("treats pre-versioning data (no version key) as version 1 and stamps it", async () => {
    storage.setItem("forge30:profile", JSON.stringify(profileFixture));

    const profile = await adapter.getProfile(); // first access triggers ensureMigrated
    // Every v1 field survives; the v2 migration adds the structured trio.
    expect(profile).toMatchObject(profileFixture);
    expect(profile?.domains?.nutrition).toBe(true);
    expect(profile?.mvd).toEqual({ meal: true, checkIn: true, water: false, movement: false });
    expect(storage.getItem(VERSION_KEY)).toBe(String(SCHEMA_VERSION));
  });

  it("stamps a fresh install (no data, no version) as current without inventing data", async () => {
    expect(await adapter.getProfile()).toBeNull();
    expect(storage.getItem(VERSION_KEY)).toBe(String(SCHEMA_VERSION));
    expect(storage.getItem("forge30:profile")).toBeNull();
  });

  it("leaves newer-schema data completely untouched (no writes, no re-stamp)", async () => {
    const newer = String(SCHEMA_VERSION + 5);
    storage.setItem(VERSION_KEY, newer);
    storage.setItem("forge30:profile", JSON.stringify({ ...profileFixture, futureField: 1 }));
    const before = JSON.stringify(storage._dump());

    await adapter.getProfile(); // triggers the check
    expect(storage.getItem(VERSION_KEY)).toBe(newer);
    // Only reads happened — every stored byte identical.
    expect(JSON.stringify(storage._dump())).toBe(before);
  });

  it("recovers a garbage version value with data present as version 1", async () => {
    storage.setItem(VERSION_KEY, "banana");
    storage.setItem("forge30:profile", JSON.stringify(profileFixture));

    expect(await adapter.getProfile()).toMatchObject(profileFixture);
    expect(storage.getItem(VERSION_KEY)).toBe(String(SCHEMA_VERSION));
  });
});

describe("LocalStorageAdapter export → import through storage", () => {
  it("round-trips all collections and drops keys absent from the file", async () => {
    await adapter.saveProfile(profileFixture);
    await adapter.saveMeal({
      id: "m1",
      date: "2026-07-01",
      slot: "meal1",
      name: "Chicken rice bowl",
      calories: 1150,
      protein: 65,
      carbs: 120,
      fats: 38,
      loggedAt: "2026-07-01T12:00:00.000Z",
    });
    await adapter.saveCheckedBooks([1, 2]);
    const file = await adapter.exportAll();

    // Fresh device: wipe, then add a stray collection the file doesn't have.
    await adapter.resetAll();
    await adapter.saveCheckedBooks([5]);

    await adapter.importAll(file);
    expect(await adapter.getProfile()).toEqual(profileFixture);
    expect(await adapter.listMeals("2026-07-01")).toHaveLength(1);
    // Books came from the file (1,2), not the stray pre-import state (5).
    expect(await adapter.getCheckedBooks()).toEqual([1, 2]);
    expect(storage.getItem(VERSION_KEY)).toBe(String(SCHEMA_VERSION));
  });

  it("rejects importing a newer-schema file without touching stored data", async () => {
    await adapter.saveProfile(profileFixture);
    const before = JSON.stringify(storage._dump());

    const futureFile = {
      app: "forge30" as const,
      schemaVersion: SCHEMA_VERSION + 1,
      exportedAt: "2027-01-01T00:00:00.000Z",
      collections: {},
    };
    await expect(adapter.importAll(futureFile)).rejects.toThrow(/newer version/);
    expect(JSON.stringify(storage._dump())).toBe(before);
  });
});

describe("hybrid training persistence (HT-2)", () => {
  it("settings default sensibly and merge stored partials over defaults", async () => {
    const fresh = await adapter.getHybridSettings();
    expect(fresh.enabled).toBe(false);
    expect(fresh.thresholds).toEqual({ yellowPain: 3, orangePain: 5, redPain: 7 });
    await adapter.saveHybridSettings({ ...fresh, enabled: true, daysPerWeek: 4 });
    const saved = await adapter.getHybridSettings();
    expect(saved.enabled).toBe(true);
    expect(saved.daysPerWeek).toBe(4);
    expect(saved.mesoWeeks).toBe(4); // untouched default survives
  });

  it("readiness check-ins persist per date and list by range", async () => {
    await adapter.saveHybridReadiness({
      id: "r1",
      date: "2026-07-20",
      painScore: 3,
      painLocations: ["Shoulder"],
      sleepHours: 7,
      sleepQuality: 3,
      energy: 3,
      soreness: 2,
      stress: 2,
      motivation: 4,
      neuroSymptoms: [],
      warmupResponse: "better",
      band: "yellow",
      loggedAt: "2026-07-20T08:00:00.000Z",
    });
    expect((await adapter.getHybridReadiness("2026-07-20"))?.band).toBe("yellow");
    expect(await adapter.getHybridReadiness("2026-07-21")).toBeNull();
    expect(await adapter.listHybridReadiness("2026-07-14", "2026-07-20")).toHaveLength(1);
  });

  it("boxing + mobility sessions upsert, list, and delete", async () => {
    const boxing = {
      id: "b1",
      date: "2026-07-18",
      type: "technical" as const,
      roundsPlanned: 5,
      roundsCompleted: 4,
      workSeconds: 180,
      restSeconds: 60,
      note: "",
      completedAt: "2026-07-18T18:30:00.000Z",
    };
    await adapter.saveBoxingSession(boxing);
    await adapter.saveBoxingSession({ ...boxing, roundsCompleted: 5 }); // upsert
    const sessions = await adapter.listBoxingSessions("2026-07-14", "2026-07-20");
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.roundsCompleted).toBe(5);
    await adapter.deleteBoxingSession("b1");
    expect(await adapter.listBoxingSessions("2026-07-14", "2026-07-20")).toHaveLength(0);

    await adapter.saveMobilitySession({
      id: "m1",
      date: "2026-07-19",
      drillIds: ["dead-bug", "open-book"],
      minutes: 12,
      completedAt: "2026-07-19T09:00:00.000Z",
    });
    expect(await adapter.listMobilitySessions("2026-07-19", "2026-07-19")).toHaveLength(1);
  });

  it("in-flight session state survives an adapter re-instantiation (refresh) and clears", async () => {
    const state = {
      date: "2026-07-20",
      dayId: "upper-a",
      startedAt: "2026-07-20T10:00:00.000Z",
      readinessBand: "green" as const,
      currentIndex: 2,
      substitutions: { "bb-bench-press": "floor-press" },
      setLogs: {
        "bb-bench-press": [
          {
            setNumber: 1,
            reps: 6,
            weight: 80,
            rpe: 8,
            painBefore: 0,
            painAfter: 1,
            isWarmup: false,
            failed: false,
            note: "",
          },
        ],
      },
      setAdjustments: {},
      skipped: [],
      painFlagged: [],
      stopReasons: {},
      aiModifications: [],
    };
    await adapter.saveHybridSessionState(state);

    const reloaded = new LocalStorageAdapter(); // same storage → same data
    const resumed = await reloaded.getHybridSessionState();
    expect(resumed?.currentIndex).toBe(2);
    expect(resumed?.setLogs["bb-bench-press"]).toHaveLength(1);

    await adapter.saveHybridSessionState(null);
    expect(await adapter.getHybridSessionState()).toBeNull();
  });

  it("hybrid collections ride exportAll/importAll", async () => {
    const settings = await adapter.getHybridSettings();
    await adapter.saveHybridSettings({ ...settings, enabled: true });
    await adapter.saveBoxingSession({
      id: "b2",
      date: "2026-07-18",
      type: "power",
      roundsPlanned: 4,
      roundsCompleted: 4,
      workSeconds: 120,
      restSeconds: 90,
      note: "",
      completedAt: null,
    });
    const file = await adapter.exportAll();
    await adapter.resetAll();
    expect((await adapter.getHybridSettings()).enabled).toBe(false);
    await adapter.importAll(file);
    expect((await adapter.getHybridSettings()).enabled).toBe(true);
    expect(await adapter.listBoxingSessions("2026-07-18", "2026-07-18")).toHaveLength(1);
  });
});
