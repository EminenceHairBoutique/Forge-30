import type {
  Compound,
  DoseEvent,
  ISODate,
  LabMarkerValue,
  ProtocolSchedule,
} from "@/lib/types";
import { PROTOCOL_SITES } from "@/lib/data/protocolReference";
import { addDays, daysBetween } from "@/lib/utils";

/**
 * Protocols engine (v3 Phase 6) — pure record-keeping math under the §6.0
 * rails. Everything here computes FROM what the user entered (their
 * prescription, their doses, their labs); nothing here ever produces a
 * recommendation about what to take. The single sanctioned unit conversion
 * is displaying the entered dose at the entered label concentration
 * (§6.0.2 — record-keeping, not guidance).
 */

// --- Schedule expansion ------------------------------------------------------------

/** Is a schedule due on `date`? Pure calendar math from the user's prescription. */
export function isDueOn(schedule: ProtocolSchedule, date: ISODate): boolean {
  if (schedule.paused) {
    if (!schedule.resumeDate || date < schedule.resumeDate) return false;
  }
  const offset = daysBetween(schedule.startDate, date);
  if (offset < 0) return false;
  switch (schedule.pattern) {
    case "daily":
      return true;
    case "eod":
      return offset % 2 === 0;
    case "e3_5d": {
      // Twice weekly on a 3.5-day rhythm: days 0 and 3(.5) of each week.
      const week = offset % 7;
      return week === 0 || week === 3;
    }
    case "weekly":
      return offset % 7 === 0;
    case "custom": {
      const weekday = (new Date(`${date}T12:00:00`).getDay() + 6) % 7; // 0=Mon
      return (schedule.customDays ?? []).includes(weekday);
    }
  }
}

export interface DueItem {
  schedule: ProtocolSchedule;
  compound: Compound;
  /** Already logged today (a dose event references this schedule today). */
  logged: boolean;
}

/** Today's due list with logged state — drives the one-tap dose buttons. */
export function dueToday(
  schedules: ProtocolSchedule[],
  compounds: Compound[],
  doses: DoseEvent[],
  today: ISODate
): DueItem[] {
  const byId = new Map(compounds.map((c) => [c.id, c]));
  return schedules
    .filter((s) => isDueOn(s, today))
    .flatMap((schedule) => {
      const compound = byId.get(schedule.compoundId);
      if (!compound) return [];
      const logged = doses.some(
        (d) => d.timestamp.slice(0, 10) === today && (d.scheduleId === schedule.id || d.compoundId === compound.id)
      );
      return [{ schedule, compound, logged }];
    });
}

// --- Site rotation ------------------------------------------------------------------

export interface SiteStatus {
  siteId: string;
  label: string;
  lastUsed: ISODate | null;
  daysSinceUse: number | null;
  /** 0–1: 1 = fully rested (≥ restDays since use or never used). */
  restLevel: number;
}

/** Rest status for every site from the dose history. Data, not judgment. */
export function siteStatuses(doses: DoseEvent[], today: ISODate): SiteStatus[] {
  return PROTOCOL_SITES.map((site) => {
    const used = doses
      .filter((d) => d.site === site.id)
      .map((d) => d.timestamp.slice(0, 10))
      .sort()
      .pop();
    if (!used) {
      return { siteId: site.id, label: site.label, lastUsed: null, daysSinceUse: null, restLevel: 1 };
    }
    const days = Math.max(0, daysBetween(used, today));
    return {
      siteId: site.id,
      label: site.label,
      lastUsed: used,
      daysSinceUse: days,
      restLevel: Math.min(1, days / site.restDays),
    };
  });
}

/**
 * Rotation suggestion: the most-rested injectable site (ties broken by the
 * catalog order). Bookkeeping over the user's own history — where they
 * actually inject remains their and their provider's call.
 */
export function suggestNextSite(doses: DoseEvent[], today: ISODate): SiteStatus {
  const statuses = siteStatuses(doses, today);
  return statuses.reduce((best, s) => {
    const bestDays = best.daysSinceUse ?? Number.POSITIVE_INFINITY;
    const days = s.daysSinceUse ?? Number.POSITIVE_INFINITY;
    return days > bestDays ? s : best;
  });
}

// --- Vial inventory -----------------------------------------------------------------

export const LOW_SUPPLY_DOSES = 3;

export interface VialInventory {
  compoundId: string;
  /** Volume used so far, in mL, from logged doses at the label concentration. */
  usedMl: number | null;
  remainingMl: number | null;
  /** Doses left at the schedule's dose size. */
  dosesRemaining: number | null;
  lowSupply: boolean;
  /** Days until the entered expiry date (negative = past). */
  daysToExpiry: number | null;
}

/**
 * Inventory countdown from logged doses. The mL math is the §6.0.2-sanctioned
 * display conversion of ENTERED doses at the ENTERED label concentration —
 * it never proposes a dose.
 */
export function vialInventory(
  compound: Compound,
  schedule: ProtocolSchedule | null,
  doses: DoseEvent[],
  today: ISODate
): VialInventory {
  const daysToExpiry = compound.expiryDate ? daysBetween(today, compound.expiryDate) : null;
  if (!compound.labelConcentration || !compound.vialVolumeMl) {
    return {
      compoundId: compound.id,
      usedMl: null,
      remainingMl: null,
      dosesRemaining: null,
      lowSupply: false,
      daysToExpiry,
    };
  }
  const usedMl =
    doses
      .filter((d) => d.compoundId === compound.id)
      .reduce((sum, d) => sum + d.dose / compound.labelConcentration!, 0) || 0;
  const remainingMl = Math.max(0, compound.vialVolumeMl - usedMl);
  const doseMl = schedule && schedule.dose > 0 ? schedule.dose / compound.labelConcentration : null;
  const dosesRemaining = doseMl ? Math.floor(remainingMl / doseMl) : null;
  return {
    compoundId: compound.id,
    usedMl: Math.round(usedMl * 100) / 100,
    remainingMl: Math.round(remainingMl * 100) / 100,
    dosesRemaining,
    lowSupply: dosesRemaining !== null && dosesRemaining <= LOW_SUPPLY_DOSES,
    daysToExpiry,
  };
}

/** The entered dose as mL at the entered label concentration — display only. */
export function doseAsMl(dose: number, labelConcentration: number | null): number | null {
  if (!labelConcentration || labelConcentration <= 0 || dose <= 0) return null;
  return Math.round((dose / labelConcentration) * 100) / 100;
}

// --- Adherence (for the doctor report) ------------------------------------------------

export interface AdherenceSummary {
  scheduledCount: number;
  loggedCount: number;
  /** 0–100; null when nothing was scheduled. */
  percent: number | null;
}

/** Scheduled-vs-logged over a window — stated plainly, never judged. */
export function adherence(
  schedules: ProtocolSchedule[],
  doses: DoseEvent[],
  from: ISODate,
  to: ISODate
): AdherenceSummary {
  let scheduled = 0;
  let logged = 0;
  const doseDays = new Map<string, Set<string>>();
  for (const d of doses) {
    const day = d.timestamp.slice(0, 10);
    if (day < from || day > to) continue;
    const set = doseDays.get(d.compoundId) ?? new Set<string>();
    set.add(day);
    doseDays.set(d.compoundId, set);
  }
  const span = daysBetween(from, to);
  for (let i = 0; i <= span; i++) {
    const date = addDays(from, i);
    for (const s of schedules) {
      if (!isDueOn(s, date)) continue;
      scheduled += 1;
      if (doseDays.get(s.compoundId)?.has(date)) logged += 1;
    }
  }
  return {
    scheduledCount: scheduled,
    loggedCount: logged,
    percent: scheduled > 0 ? Math.round((logged / scheduled) * 100) : null,
  };
}

// --- Estimated-level curve -----------------------------------------------------------

export interface CurvePoint {
  date: ISODate;
  /** Relative estimated level in dose units — an ESTIMATE, labeled as such. */
  level: number;
}

/**
 * Exponential-decay superposition of the user's LOGGED doses using the
 * compound's published/entered half-life. Educational sketch of published
 * pharmacokinetics — prominently labeled an estimate, never a measurement,
 * never an input to any suggestion.
 */
export function estimatedLevelCurve(
  compound: Compound,
  doses: DoseEvent[],
  from: ISODate,
  to: ISODate
): CurvePoint[] {
  if (!compound.halfLifeHours || compound.halfLifeHours <= 0) return [];
  const halfLifeDays = compound.halfLifeHours / 24;
  const events = doses
    .filter((d) => d.compoundId === compound.id)
    .map((d) => ({ day: d.timestamp.slice(0, 10), dose: d.dose }));
  if (events.length === 0) return [];
  const span = daysBetween(from, to);
  const points: CurvePoint[] = [];
  for (let i = 0; i <= span; i++) {
    const date = addDays(from, i);
    let level = 0;
    for (const e of events) {
      const age = daysBetween(e.day, date);
      if (age < 0) continue;
      level += e.dose * Math.pow(0.5, age / halfLifeDays);
    }
    points.push({ date, level: Math.round(level * 10) / 10 });
  }
  return points;
}

// --- Lab status ----------------------------------------------------------------------

export type LabStatus = "in" | "borderline" | "out" | "noRange";

/** Borderline = within 5% of either edge. Visibility only, never interpretation. */
export function labStatus(marker: LabMarkerValue): LabStatus {
  const { value, refLow, refHigh } = marker;
  if (refLow === null && refHigh === null) return "noRange";
  const belowLow = refLow !== null && value < refLow;
  const aboveHigh = refHigh !== null && value > refHigh;
  if (belowLow || aboveHigh) return "out";
  const span =
    refLow !== null && refHigh !== null ? refHigh - refLow : Math.abs(refHigh ?? refLow ?? 0);
  const margin = span * 0.05;
  if (refLow !== null && value <= refLow + margin) return "borderline";
  if (refHigh !== null && value >= refHigh - margin) return "borderline";
  return "in";
}
