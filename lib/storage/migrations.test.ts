import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  UnsupportedSchemaError,
  buildExport,
  runMigrations,
  validateExport,
  type CollectionSnapshot,
} from "./migrations";

/**
 * Realistic v1 data — one entry per collection, mirroring the exact shapes
 * the shipped v1 app writes (maps keyed by date for daily collections,
 * arrays for append collections). If a future migration reshapes anything,
 * this fixture proves existing users' data survives the upgrade.
 */
function v1Fixture(): CollectionSnapshot {
  return {
    profile: {
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
    },
    dailyLogs: {
      "2026-07-01": {
        date: "2026-07-01",
        forgeScore: 82,
        calories: 2640,
        protein: 142,
        carbs: 260,
        fats: 90,
        waterMl: 3000,
        workoutStatus: "complete",
        steps: 8000,
        sleepHours: 7.5,
        mobilityDone: true,
        spendingChecked: true,
        mood: 6,
        stress: 4,
        painScore: 0,
        skillMinutes: 15,
        journalDone: true,
        calendarState: "complete",
        prepChecklist: ["proteins", "carbs"],
      },
    },
    meals: [
      {
        id: "m1",
        date: "2026-07-01",
        slot: "meal1",
        name: "Chicken rice bowl",
        calories: 1150,
        protein: 65,
        carbs: 120,
        fats: 38,
        loggedAt: "2026-07-01T12:00:00.000Z",
      },
    ],
    savedMeals: [
      { id: "sm1", name: "My bowl", calories: 800, protein: 50, carbs: 80, fats: 25, createdAt: "2026-07-01T10:00:00.000Z" },
    ],
    workouts: {
      "2026-07-01": {
        id: "w1",
        date: "2026-07-01",
        splitLabel: "Upper Push + Shoulders",
        status: "complete",
        warmupDone: true,
        exercises: [
          {
            exerciseId: "incline-db-press",
            name: "Incline DB press",
            muscleGroup: "chest",
            sets: [{ exerciseId: "incline-db-press", weight: 70, reps: 10, rpe: 8, painScore: 0, note: "" }],
          },
        ],
        startedAt: "2026-07-01T17:00:00.000Z",
        completedAt: "2026-07-01T18:00:00.000Z",
        sessionPainScore: 0,
        note: "",
      },
    },
    journals: {
      "2026-07-01": {
        id: "j1",
        date: "2026-07-01",
        mood: 6,
        stress: 4,
        anxietyAnger: 3,
        relationshipStress: false,
        mainTrigger: "",
        whatIControlled: "",
        whatToLetGo: "",
        boundaryPracticed: "",
        resetDone: true,
        windDownDone: false,
        thoughtDump: "",
        nightReflection: "",
        loggedAt: "2026-07-01T21:00:00.000Z",
      },
    },
    spending: [
      {
        id: "s1",
        date: "2026-07-01",
        amount: 18,
        category: "food",
        necessary: false,
        business: false,
        stressPurchase: false,
        note: "",
        loggedAt: "2026-07-01T13:00:00.000Z",
      },
    ],
    sundayReviews: [
      {
        id: "sr1",
        date: "2026-06-28",
        incomeExpected: 1200,
        billsDue: 400,
        foodBudget: 150,
        debtPayment: 100,
        businessBudget: 50,
        emergencyBuffer: 100,
        thingToCut: "a subscription",
        thingToSell: "",
        tomorrowLimit: 50,
      },
    ],
    skillTasks: [
      {
        id: "sk1",
        trackId: "finance",
        date: "2026-07-01",
        taskLabel: "Track every dollar you spent today",
        minutes: 15,
        note: "",
        completedAt: "2026-07-01T20:00:00.000Z",
      },
    ],
    books: [1, 2],
    bodyMetrics: {
      "2026-07-01": {
        id: "bm1",
        date: "2026-07-01",
        weightLb: 176.5,
        waistIn: 33,
        chestIn: 0,
        armsIn: 0,
        legsIn: 0,
        energy: 7,
        soreness: 3,
        photoUrl: "",
      },
    },
    aiReviews: {
      "2026-07-01": {
        id: "ar1",
        date: "2026-07-01",
        source: "mock",
        scoreExplanation: "Today was a 82/100 on day 1.",
        wentWell: "You finished Upper Push + Shoulders.",
        slipped: "Calories came in 410 short.",
        physicalAdjustment: "Keep loads where they are.",
        nutritionAdjustment: "Add the whey shake.",
        moneyAdjustment: "Money stayed visible.",
        mentalAdjustment: "Head was steady.",
        tomorrowPriority: "Repeat today.",
        createdAt: "2026-07-01T22:00:00.000Z",
      },
    },
  };
}

describe("runMigrations", () => {
  it("v1 → v2 leaves every non-profile collection byte-identical", () => {
    const fixture = v1Fixture();
    const pristine = structuredClone(fixture);
    const result = runMigrations(fixture, 1);
    for (const key of Object.keys(pristine)) {
      if (key === "profile") continue;
      expect(result.collections[key], key).toEqual(pristine[key]);
    }
    expect(result.version).toBe(SCHEMA_VERSION);
  });

  it("v1 → v2 keeps every existing profile field and adds only the new trio", () => {
    const pristineProfile = structuredClone(v1Fixture().profile) as Record<string, unknown>;
    const result = runMigrations(v1Fixture(), 1);
    const migrated = result.collections.profile as Record<string, unknown>;
    // Every v1 field survives with its exact value (the user's own targets).
    for (const [key, value] of Object.entries(pristineProfile)) {
      expect(migrated[key], key).toEqual(value);
    }
    // The new structured fields arrive with defaults.
    expect(migrated.domains).toMatchObject({ nutrition: true, relationships: true });
    expect(migrated.mvd).toEqual({ meal: true, checkIn: true, water: false, movement: false });
    expect(migrated.notifications).toMatchObject({ morningPlan: true });
  });

  it("v1 → v2 is idempotent: re-running never overwrites user customization", () => {
    const once = runMigrations(v1Fixture(), 1).collections;
    const profile = once.profile as Record<string, unknown>;
    // Simulate the user turning a domain off, then an interrupted re-migration.
    (profile.domains as Record<string, boolean>).relationships = false;
    const twice = runMigrations(structuredClone(once), 1).collections;
    expect((twice.profile as Record<string, unknown>).domains).toMatchObject({
      relationships: false,
    });
  });

  it("v2 → v3 drops the removed recordingJurisdiction field and nothing else", () => {
    const withField = {
      profile: { name: "T", onboardingComplete: true, recordingJurisdiction: "TX" },
      meals: [{ id: "m1" }],
    };
    const { collections, version } = runMigrations(withField, 2);
    expect(version).toBe(SCHEMA_VERSION);
    expect(collections.profile).toEqual({ name: "T", onboardingComplete: true });
    expect(collections.meals).toEqual([{ id: "m1" }]);
  });

  it("v2 → v3 is idempotent when the field is already absent", () => {
    const clean = { profile: { name: "T", onboardingComplete: true } };
    const { collections } = runMigrations(clean, 2);
    expect(collections.profile).toEqual(clean.profile);
  });

  it("migrates an empty snapshot (fresh install) cleanly", () => {
    const result = runMigrations({}, 1);
    expect(result.collections).toEqual({});
    expect(result.version).toBe(SCHEMA_VERSION);
  });

  it("is identity when already at the current version", () => {
    const fixture = v1Fixture();
    const result = runMigrations(fixture, SCHEMA_VERSION);
    expect(result.collections).toBe(fixture);
    expect(result.version).toBe(SCHEMA_VERSION);
  });

  it("refuses to downgrade data from a newer schema", () => {
    expect(() => runMigrations(v1Fixture(), SCHEMA_VERSION + 1)).toThrow(UnsupportedSchemaError);
  });
});

describe("validateExport", () => {
  it("accepts a well-formed export file", () => {
    const file = buildExport(v1Fixture(), "2026-07-03T00:00:00.000Z");
    const valid = validateExport(JSON.parse(JSON.stringify(file)));
    expect(valid.schemaVersion).toBe(SCHEMA_VERSION);
    expect(valid.collections).toEqual(v1Fixture());
  });

  it("rejects files that aren't Forge30 exports", () => {
    expect(() => validateExport(null)).toThrow(/isn't a Forge30 export/);
    expect(() => validateExport("nope")).toThrow(/isn't a Forge30 export/);
    expect(() => validateExport({ app: "other", schemaVersion: 1, collections: {} })).toThrow(
      /isn't a Forge30 export/
    );
  });

  it("rejects files missing a valid schema version or collections", () => {
    expect(() => validateExport({ app: "forge30", collections: {} })).toThrow(/schema version/);
    expect(() =>
      validateExport({ app: "forge30", schemaVersion: 0.5, collections: {} })
    ).toThrow(/schema version/);
    expect(() => validateExport({ app: "forge30", schemaVersion: 1 })).toThrow(/collections/);
    expect(() =>
      validateExport({ app: "forge30", schemaVersion: 1, collections: [] })
    ).toThrow(/collections/);
  });

  it("rejects exports from a newer app version with a clear message", () => {
    expect(() =>
      validateExport({ app: "forge30", schemaVersion: SCHEMA_VERSION + 1, collections: {} })
    ).toThrow(/newer version of Forge30/);
  });
});

describe("export → import round trip", () => {
  it("is lossless: validate + migrate returns byte-equal data", () => {
    const original = v1Fixture();
    const file = buildExport(original, new Date(0).toISOString());
    // Simulate the real path: serialize to disk, parse, validate, migrate.
    const parsed = validateExport(JSON.parse(JSON.stringify(file)));
    const { collections, version } = runMigrations(parsed.collections, parsed.schemaVersion);
    expect(collections).toEqual(original);
    expect(version).toBe(SCHEMA_VERSION);
  });
});
