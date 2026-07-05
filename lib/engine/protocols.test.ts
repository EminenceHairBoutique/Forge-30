import { describe, expect, it } from "vitest";
import {
  adherence,
  doseAsMl,
  dueToday,
  estimatedLevelCurve,
  isDueOn,
  labStatus,
  LOW_SUPPLY_DOSES,
  siteStatuses,
  suggestNextSite,
  vialInventory,
} from "./protocols";
import {
  CURVE_DISCLAIMER,
  LAB_MARKER_CATALOG,
  LAB_RANGE_DISCLAIMER,
  PROTOCOL_DISCLAIMER,
  PROTOCOL_SITES,
  publishedHalfLife,
} from "@/lib/data/protocolReference";
import { checkSafetyCopy } from "./safetyCopy";
import type { Compound, DoseEvent, ProtocolSchedule } from "@/lib/types";

const compound = (over: Partial<Compound>): Compound => ({
  id: "c1",
  name: "Testosterone Cypionate",
  category: "trt",
  form: "injection",
  labelConcentration: 200,
  concentrationUnit: "mg/mL",
  vialVolumeMl: 10,
  halfLifeHours: 192,
  expiryDate: null,
  prescriberNote: "",
  createdAt: "2026-06-01T10:00:00.000Z",
  ...over,
});

const schedule = (over: Partial<ProtocolSchedule>): ProtocolSchedule => ({
  id: "s1",
  compoundId: "c1",
  pattern: "e3_5d",
  timeOfDay: "08:00",
  dose: 100,
  doseUnit: "mg",
  startDate: "2026-06-01",
  paused: false,
  resumeDate: null,
  ...over,
});

const dose = (ts: string, over: Partial<DoseEvent> = {}): DoseEvent => ({
  id: `d-${ts}`,
  compoundId: "c1",
  scheduleId: "s1",
  dose: 100,
  doseUnit: "mg",
  route: "IM",
  site: "gluteL",
  timestamp: ts,
  note: "",
  ...over,
});

describe("schedule expansion", () => {
  it("expands every pattern from the user's prescription", () => {
    expect(isDueOn(schedule({ pattern: "daily" }), "2026-06-05")).toBe(true);
    expect(isDueOn(schedule({ pattern: "eod" }), "2026-06-03")).toBe(true); // day 2
    expect(isDueOn(schedule({ pattern: "eod" }), "2026-06-04")).toBe(false); // day 3
    // e3_5d: days 0 and 3 of each week from the anchor
    expect(isDueOn(schedule({}), "2026-06-01")).toBe(true);
    expect(isDueOn(schedule({}), "2026-06-04")).toBe(true);
    expect(isDueOn(schedule({}), "2026-06-06")).toBe(false);
    expect(isDueOn(schedule({}), "2026-06-08")).toBe(true);
    expect(isDueOn(schedule({ pattern: "weekly" }), "2026-06-08")).toBe(true);
    // custom: Mon(0) + Thu(3); 2026-06-04 is a Thursday
    expect(isDueOn(schedule({ pattern: "custom", customDays: [0, 3] }), "2026-06-04")).toBe(true);
    expect(isDueOn(schedule({ pattern: "custom", customDays: [0, 3] }), "2026-06-05")).toBe(false);
  });

  it("pause silences until the auto-resume date", () => {
    const paused = schedule({ pattern: "daily", paused: true, resumeDate: "2026-06-10" });
    expect(isDueOn(paused, "2026-06-08")).toBe(false);
    expect(isDueOn(paused, "2026-06-10")).toBe(true);
    expect(isDueOn(schedule({ pattern: "daily", paused: true, resumeDate: null }), "2026-06-08")).toBe(false);
  });

  it("dueToday marks already-logged items", () => {
    const items = dueToday([schedule({})], [compound({})], [dose("2026-06-08T08:10:00.000Z")], "2026-06-08");
    expect(items).toHaveLength(1);
    expect(items[0]?.logged).toBe(true);
  });
});

describe("site rotation", () => {
  it("tracks rest levels per site and suggests the most rested", () => {
    const doses = [
      dose("2026-06-07T08:00:00.000Z", { site: "gluteL" }),
      dose("2026-06-01T08:00:00.000Z", { site: "gluteR" }),
    ];
    const statuses = siteStatuses(doses, "2026-06-08");
    const gluteL = statuses.find((s) => s.siteId === "gluteL");
    expect(gluteL?.daysSinceUse).toBe(1);
    expect(gluteL?.restLevel).toBeLessThan(0.2);
    // Never-used sites are fully rested and win the suggestion.
    const next = suggestNextSite(doses, "2026-06-08");
    expect(next.lastUsed).toBeNull();
    expect(PROTOCOL_SITES.map((s) => s.id)).toContain(next.siteId);
  });
});

describe("vial inventory (§6.0.2 display math only)", () => {
  it("decrements from logged doses at the entered label concentration", () => {
    const doses = Array.from({ length: 4 }, (_, i) => dose(`2026-06-0${i + 1}T08:00:00.000Z`));
    const inv = vialInventory(compound({}), schedule({}), doses, "2026-06-08");
    // 4 × 100mg at 200mg/mL = 2 mL used of 10.
    expect(inv.usedMl).toBe(2);
    expect(inv.remainingMl).toBe(8);
    expect(inv.dosesRemaining).toBe(16);
    expect(inv.lowSupply).toBe(false);
  });

  it("flags low supply at the threshold and counts expiry days", () => {
    const many = Array.from({ length: 18 }, (_, i) =>
      dose(`2026-06-${String(i + 1).padStart(2, "0")}T08:00:00.000Z`, { id: `d${i}` })
    );
    const inv = vialInventory(compound({ expiryDate: "2026-06-25" }), schedule({}), many, "2026-06-20");
    expect(inv.dosesRemaining).toBeLessThanOrEqual(LOW_SUPPLY_DOSES);
    expect(inv.lowSupply).toBe(true);
    expect(inv.daysToExpiry).toBe(5);
  });

  it("doseAsMl converts only the entered dose and handles missing labels", () => {
    expect(doseAsMl(100, 200)).toBe(0.5);
    expect(doseAsMl(100, null)).toBeNull();
    expect(vialInventory(compound({ labelConcentration: null }), schedule({}), [], "2026-06-08").remainingMl).toBeNull();
  });
});

describe("adherence + level curve", () => {
  it("adherence counts scheduled vs logged, plainly", () => {
    const doses = [dose("2026-06-01T08:00:00.000Z"), dose("2026-06-08T08:00:00.000Z")];
    const a = adherence([schedule({})], doses, "2026-06-01", "2026-06-08");
    // e3_5d due on 1st, 4th, 8th → 3 scheduled, 2 logged.
    expect(a.scheduledCount).toBe(3);
    expect(a.loggedCount).toBe(2);
    expect(a.percent).toBe(67);
    expect(adherence([], [], "2026-06-01", "2026-06-08").percent).toBeNull();
  });

  it("level curve is decay superposition of LOGGED doses and needs a half-life", () => {
    const doses = [dose("2026-06-01T08:00:00.000Z")];
    const curve = estimatedLevelCurve(compound({}), doses, "2026-06-01", "2026-06-09");
    expect(curve[0]?.level).toBe(100);
    expect(curve[8]?.level).toBe(50); // one 8-day half-life later
    expect(estimatedLevelCurve(compound({ halfLifeHours: null }), doses, "2026-06-01", "2026-06-09")).toEqual([]);
    expect(publishedHalfLife("Testosterone Cypionate 200mg/mL")).toBe(192);
    expect(publishedHalfLife("unknown compound")).toBeNull();
  });
});

describe("lab status", () => {
  it("flags in/borderline/out for visibility only", () => {
    const m = (value: number) => ({ name: "Hematocrit", value, unit: "%", refLow: 38.3, refHigh: 48.6 });
    expect(labStatus(m(44))).toBe("in");
    expect(labStatus(m(48.4))).toBe("borderline");
    expect(labStatus(m(52))).toBe("out");
    expect(labStatus({ name: "X", value: 1, unit: "", refLow: null, refHigh: null })).toBe("noRange");
  });
});

describe("§6.0 copy register", () => {
  it("all protocol copy passes safetyCopy and contains zero dose guidance", () => {
    const copy = [
      PROTOCOL_DISCLAIMER,
      CURVE_DISCLAIMER,
      LAB_RANGE_DISCLAIMER,
      ...LAB_MARKER_CATALOG.map((mk) => mk.about),
    ].join(" ");
    expect(checkSafetyCopy(copy).violations).toEqual([]);
    // Patient-record register: no optimization-bro vocabulary anywhere.
    expect(copy.toLowerCase()).not.toMatch(/\b(cycle|stack|blast|cruise)\b/);
    // No imperative dosing language.
    expect(copy.toLowerCase()).not.toMatch(/\b(take|inject|increase|reduce) \d/);
  });
});
