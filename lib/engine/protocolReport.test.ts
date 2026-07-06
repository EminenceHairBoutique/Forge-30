import { describe, expect, it } from "vitest";
import { buildDoctorReport } from "./protocolReport";
import { buildDays, detectPatterns } from "./lifeGraph";
import { checkSafetyCopy } from "./safetyCopy";
import { addDays } from "@/lib/utils";
import type { Compound, DailyLog, DoseEvent, LabPanel, ProtocolSchedule } from "@/lib/types";

/**
 * Phase 6-3: the 90-day seeded fixture the spec's acceptance names — the
 * doctor report assembles correctly, and the protocol LifeGraph signals stay
 * behavioral with prescriber framing.
 */

const FROM = "2026-04-07";
const TO = "2026-07-05";

const compound: Compound = {
  id: "c1",
  name: "Testosterone Cypionate",
  category: "trt",
  form: "injection",
  labelConcentration: 200,
  concentrationUnit: "mg/mL",
  vialVolumeMl: 10,
  halfLifeHours: 192,
  expiryDate: null,
  prescriberNote: "100 mg IM twice weekly as directed",
  createdAt: "2026-04-01T10:00:00.000Z",
};

const schedule: ProtocolSchedule = {
  id: "s1",
  compoundId: "c1",
  pattern: "e3_5d",
  timeOfDay: "08:00",
  dose: 100,
  doseUnit: "mg",
  startDate: FROM,
  paused: false,
  resumeDate: null,
};

/** 90 days of doses on schedule days 0+3 weekly, alternating glutes, one week skipped. */
function seededDoses(): DoseEvent[] {
  const out: DoseEvent[] = [];
  for (let week = 0; week < 13; week++) {
    if (week === 6) continue; // one traveling week without logs
    for (const dayInWeek of [0, 3]) {
      const date = addDays(FROM, week * 7 + dayInWeek);
      if (date > TO) continue;
      out.push({
        id: `d-${date}`,
        compoundId: "c1",
        scheduleId: "s1",
        dose: 100,
        doseUnit: "mg",
        route: "IM",
        site: out.length % 2 === 0 ? "gluteL" : "gluteR",
        timestamp: `${date}T08:05:00.000Z`,
        note: "",
      });
    }
  }
  return out;
}

const labs: LabPanel[] = [
  {
    id: "l1",
    date: "2026-05-01",
    source: "Quest",
    markers: [
      { name: "Total Testosterone", value: 650, unit: "ng/dL", refLow: 300, refHigh: 1000 },
      { name: "Hematocrit", value: 49.5, unit: "%", refLow: 38.3, refHigh: 48.6 },
    ],
    createdAt: "2026-05-01T10:00:00.000Z",
  },
  {
    id: "l2",
    date: "2026-06-20",
    source: "Quest",
    markers: [
      { name: "Total Testosterone", value: 710, unit: "ng/dL", refLow: 300, refHigh: 1000 },
      { name: "Hematocrit", value: 47.9, unit: "%", refLow: 38.3, refHigh: 48.6 },
    ],
    createdAt: "2026-06-20T10:00:00.000Z",
  },
];

describe("doctor report — 90-day fixture", () => {
  const report = buildDoctorReport({
    compounds: [compound],
    schedules: [schedule],
    doses: seededDoses(),
    labs,
    symptoms: [
      { date: "2026-05-10", tag: "nightSweats", severity: 3 },
      { date: "2026-05-12", tag: "nightSweats", severity: 2 },
      { date: "2026-06-02", tag: "acne", severity: 2 },
    ],
    from: FROM,
    to: TO,
    generatedAt: "2026-07-05T12:00:00.000Z",
  });

  it("assembles protocol, adherence, rotation, labs, and symptoms", () => {
    expect(report.protocol[0]?.compound).toContain("Testosterone Cypionate (200 mg/mL)");
    expect(report.protocol[0]?.schedule).toBe("100 mg twice weekly (3.5-day)");
    // 26 scheduled twice-weekly slots in 13 weeks; one week unlogged → 24.
    expect(report.scheduledCount).toBe(26);
    expect(report.loggedCount).toBe(24);
    expect(report.adherencePercent).toBe(92);
    expect(report.rotation.map((r) => r.site).sort()).toEqual(["Left glute", "Right glute"]);
    expect(report.rotation.reduce((a, r) => a + r.uses, 0)).toBe(24);
    // Labs newest first; the out-of-range hematocrit is flagged for visibility.
    expect(report.labs[0]?.date).toBe("2026-06-20");
    expect(report.labs[1]?.markers.find((m) => m.name === "Hematocrit")?.status).toBe("out");
    expect(report.symptoms.find((s) => s.tag === "nightSweats")).toEqual({
      tag: "nightSweats",
      days: 2,
      avgSeverity: 2.5,
    });
  });

  it("carries the record-keeping disclaimer and no advice", () => {
    expect(report.disclaimer).toContain("never suggests, calculates, or adjusts");
    expect(checkSafetyCopy(report.disclaimer).violations).toEqual([]);
  });
});

describe("protocol LifeGraph signals (behavioral, prescriber-framed)", () => {
  const log = (date: string, over: Partial<DailyLog>): DailyLog => ({
    date,
    forgeScore: 70,
    calories: 2200,
    protein: 135,
    carbs: 200,
    fats: 70,
    waterMl: 2500,
    workoutStatus: "complete",
    steps: 8000,
    sleepHours: 7.5,
    mobilityDone: true,
    spendingChecked: true,
    mood: 7,
    stress: 4,
    painScore: 1,
    skillMinutes: 15,
    journalDone: true,
    calendarState: "complete",
    ...over,
  });

  it("dose-day → short-sleep pattern fires with prescriber framing", () => {
    // 12 dose days over 24 days; the night after each runs short.
    const logs: DailyLog[] = [];
    const doseDates: string[] = [];
    for (let i = 0; i < 24; i++) {
      const date = addDays("2026-06-01", i);
      const isDose = i % 2 === 0;
      if (isDose) doseDates.push(date);
      // Sleep logged for the night FOLLOWING a dose day runs short.
      const afterDose = i > 0 && (i - 1) % 2 === 0;
      logs.push(log(date, { sleepHours: afterDose ? 5.5 : 7.5 }));
    }
    const days = buildDays({
      logs,
      spending: [],
      bloodPressure: [],
      plans: logs.map((l) => ({ date: l.date }) as never),
      journals: [],
      consentedNotes: [],
      dailySpendingLimit: 50,
      calorieTarget: 2400,
      doseDates,
      protocolsEnabled: true,
    });
    const patterns = detectPatterns(days, "2026-06-24");
    const doseSleep = patterns.find((p) => p.id === "dose-sleep");
    expect(doseSleep).toBeDefined();
    expect(doseSleep?.line).toContain("prescriber");
    expect(doseSleep?.line.toLowerCase()).not.toMatch(/caus|because of|due to/);
  });

  it("disabled tab hides protocol flags even when historical symptom data exists", () => {
    const logs = [
      log("2026-06-01", { protocolSymptoms: [{ tag: "acne", severity: 4 }] }),
      log("2026-06-02", { protocolSymptoms: [{ tag: "gi", severity: 5 }] }),
    ];
    const days = buildDays({
      logs,
      spending: [],
      bloodPressure: [],
      plans: [],
      journals: [],
      consentedNotes: [],
      dailySpendingLimit: 50,
      calorieTarget: 2400,
    });
    for (const d of days) {
      expect(d.flags.doseDay).toBeUndefined();
      expect(d.flags.protocolSymptomDay).toBeUndefined();
    }
  });
});
