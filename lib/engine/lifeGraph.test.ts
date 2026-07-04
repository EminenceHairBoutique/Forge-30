import { describe, expect, it } from "vitest";
import {
  MIN_QUALIFYING_DAYS,
  PATTERN_DEFS,
  buildDays,
  detectPatterns,
  type LifeGraphDay,
  type LifeGraphInputs,
} from "./lifeGraph";
import { checkSafetyCopy } from "./safetyCopy";
import type { DailyLog, ISODate } from "@/lib/types";

const TODAY = "2026-07-30";

function iso(dayOfMonth: number): ISODate {
  return `2026-07-${String(dayOfMonth).padStart(2, "0")}`;
}

function day(date: ISODate, flags: LifeGraphDay["flags"]): LifeGraphDay {
  return { date, flags };
}

/** N same-day A→B days: A true every day, B true on `hits` of them. */
function pairDays(n: number, hits: number): LifeGraphDay[] {
  return Array.from({ length: n }, (_, i) =>
    day(iso(i + 1), { highStress: true, stressSpend: i < hits })
  );
}

describe("minimum sample-size guard", () => {
  it("4 qualifying days at 100% co-occurrence → nothing surfaces", () => {
    expect(detectPatterns(pairDays(4, 4), TODAY)).toEqual([]);
  });

  it("5 qualifying days is the floor", () => {
    const found = detectPatterns(pairDays(5, 5), TODAY);
    expect(found).toHaveLength(1);
    expect(found[0]!.qualifyingDays).toBe(MIN_QUALIFYING_DAYS);
  });

  it("days where B was never measured do not count as qualifying", () => {
    // A true on 6 days but B only measurable on 4 → guard holds.
    const days = Array.from({ length: 6 }, (_, i) =>
      day(iso(i + 1), { highStress: true, ...(i < 4 ? { stressSpend: true } : {}) })
    );
    expect(detectPatterns(days, TODAY)).toEqual([]);
  });
});

describe("co-occurrence threshold", () => {
  it("59% stays silent, 60% fires", () => {
    // 10 qualifying days: 5 hits = 50% → silent; 6 hits = 60% → fires.
    expect(detectPatterns(pairDays(10, 5), TODAY)).toEqual([]);
    const found = detectPatterns(pairDays(10, 6), TODAY);
    expect(found).toHaveLength(1);
    expect(found[0]!.share).toBe(0.6);
    expect(found[0]!.hits).toBe(6);
  });
});

describe("lagged pairs", () => {
  it("sleep→next-day stress counts B on day+1, not the same day", () => {
    // Poor sleep on days 1..5; high stress on days 2..6 → 5/5 lagged hits
    // even though same-day stress is low on every poor-sleep day.
    const days: LifeGraphDay[] = [];
    for (let i = 1; i <= 6; i++) {
      days.push(
        day(iso(i), {
          poorSleep: i <= 5,
          highStress: i >= 2,
        })
      );
    }
    const found = detectPatterns(days, TODAY);
    const lagged = found.find((p) => p.id === "sleep-stress");
    expect(lagged).toBeDefined();
    expect(lagged!.qualifyingDays).toBe(5);
    expect(lagged!.hits).toBe(5);
  });

  it("a lagged pair needs the NEXT day measured — trailing day drops out", () => {
    // Poor sleep on 5 days but the day after the last one has no data:
    // only 4 qualifying → guard blocks it.
    const days: LifeGraphDay[] = [];
    for (let i = 1; i <= 5; i++) days.push(day(iso(i), { poorSleep: true, highStress: true }));
    // days 2..5 have next-day stress data; day 5's next day (6) is absent.
    expect(detectPatterns(days, TODAY).find((p) => p.id === "sleep-stress")).toBeUndefined();
  });
});

describe("windows", () => {
  it("a recent pattern diluted by older data fires on the 7-day window", () => {
    // Early July: 8 high-stress days with NO stress purchase → 30-day share
    // is 5/13 ≈ 38%, silent. Last week: 5/5 → the 7-day window catches it.
    const days = [
      ...Array.from({ length: 8 }, (_, i) =>
        day(iso(1 + i), { highStress: true, stressSpend: false })
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        day(iso(24 + i), { highStress: true, stressSpend: true })
      ),
    ];
    const found = detectPatterns(days, TODAY);
    expect(found).toHaveLength(1);
    expect(found[0]!.window).toBe(7);
    expect(found[0]!.qualifyingDays).toBe(5);
  });

  it("with 30 days of data the 30-day read wins over the 7-day read", () => {
    const days = Array.from({ length: 28 }, (_, i) =>
      day(iso(i + 1), { highStress: true, stressSpend: true })
    );
    const found = detectPatterns(days, TODAY);
    expect(found[0]!.window).toBe(30);
    expect(found[0]!.qualifyingDays).toBe(28);
  });
});

describe("determinism + register", () => {
  it("same input twice → byte-identical output, strongest first", () => {
    const days = [
      ...pairDays(10, 7),
      ...Array.from({ length: 6 }, (_, i) =>
        day(iso(20 + i), { highPain: true, highStress: true })
      ),
    ];
    const a = detectPatterns(days, TODAY);
    const b = detectPatterns(days, TODAY);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(2);
    expect(a[0]!.share).toBeGreaterThanOrEqual(a[a.length - 1]!.share);
  });

  it("every possible fired line passes the safety-copy check and the register", () => {
    for (const def of PATTERN_DEFS) {
      const days = Array.from({ length: 8 }, (_, i) =>
        day(iso(i + 1), { [def.a]: true, [def.b]: true })
      );
      const found = detectPatterns(days, TODAY, [def]);
      expect(found, def.id).toHaveLength(1);
      const line = found[0]!.line;
      expect(line).toMatch(/^Possible pattern:/);
      expect(checkSafetyCopy(line).violations).toEqual([]);
      expect(line.toLowerCase()).not.toMatch(/caused|because of|proves|will make you/);
    }
  });

  it("journal-derived pairs carry journalInformed for attribution", () => {
    const days = Array.from({ length: 6 }, (_, i) =>
      day(iso(i + 1), { lonelyDay: true, lowMood: true })
    );
    const found = detectPatterns(days, TODAY);
    expect(found[0]!.id).toBe("lonely-mood");
    expect(found[0]!.journalInformed).toBe(true);
    expect(detectPatterns(pairDays(6, 6), TODAY)[0]!.journalInformed).toBe(false);
  });
});

describe("buildDays flag extraction", () => {
  function log(date: ISODate, overrides: Partial<DailyLog>): DailyLog {
    return {
      date,
      forgeScore: 70,
      calories: 0,
      protein: 0,
      carbs: 0,
      fats: 0,
      waterMl: 0,
      workoutStatus: "notStarted",
      steps: 0,
      sleepHours: 0,
      mobilityDone: false,
      spendingChecked: false,
      mood: 0,
      stress: 0,
      painScore: 0,
      skillMinutes: 0,
      journalDone: false,
      calendarState: "partial",
      ...overrides,
    };
  }

  const base: LifeGraphInputs = {
    logs: [],
    spending: [],
    bloodPressure: [],
    plans: [],
    journals: [],
    consentedNotes: [],
    dailySpendingLimit: 50,
    calorieTarget: 2400,
  };

  it("unlogged metrics stay absent (tri-state), logged ones resolve", () => {
    const days = buildDays({
      ...base,
      logs: [log("2026-07-10", { stress: 8, sleepHours: 6, mood: 0 })],
    });
    const flags = days[0]!.flags;
    expect(flags.highStress).toBe(true);
    expect(flags.poorSleep).toBe(true);
    expect(flags.lowMood).toBeUndefined(); // mood 0 = not logged
    expect(flags.elevatedSpend).toBeUndefined(); // no spend data, not checked
    expect(flags.highBp).toBeUndefined(); // no readings
  });

  it("spend flags resolve from entries; BP from readings; plan from plans", () => {
    const days = buildDays({
      ...base,
      logs: [log("2026-07-10", {})],
      spending: [
        {
          id: "s1",
          date: "2026-07-10",
          amount: 80,
          category: "shopping",
          necessary: false,
          business: false,
          stressPurchase: true,
          note: "",
          loggedAt: "2026-07-10T12:00:00.000Z",
        },
      ],
      bloodPressure: [
        {
          id: "b1",
          date: "2026-07-10",
          time: "08:00",
          systolic: 136,
          diastolic: 78,
          pulse: 60,
          position: "seated",
          cuffLocation: "leftArm",
          caffeine: false,
          exercise: false,
          stress: false,
          notes: "",
          createdAt: "2026-07-10T08:00:00.000Z",
        },
      ],
      plans: [
        {
          date: "2026-07-10",
          focus: "protein early",
          intendedMeals: [],
          spendingIntention: null,
          createdAt: "2026-07-09T21:00:00.000Z",
        },
      ],
    });
    const flags = days[0]!.flags;
    expect(flags.elevatedSpend).toBe(true); // 80 unnecessary > 50 limit
    expect(flags.stressSpend).toBe(true);
    expect(flags.highBp).toBe(true); // systolic 136
    expect(flags.noPlan).toBe(false);
  });

  it("lonelyDay comes only from the consented notes it was given", () => {
    const days = buildDays({
      ...base,
      logs: [log("2026-07-10", {})],
      consentedNotes: [
        {
          id: "n1",
          date: "2026-07-10",
          kind: "freewrite",
          text: "felt pretty lonely tonight, everyone was busy",
          tags: [],
          private: false,
          createdAt: "2026-07-10T22:00:00.000Z",
        },
      ],
    });
    expect(days[0]!.flags.lonelyDay).toBe(true);
    // Empty consented list (no consent / all private) → flag never exists.
    const gated = buildDays({ ...base, logs: [log("2026-07-10", {})] });
    expect(gated[0]!.flags.lonelyDay).toBeUndefined();
  });
});
