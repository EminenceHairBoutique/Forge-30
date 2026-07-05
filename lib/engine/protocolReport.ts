import type { Compound, DoseEvent, ISODate, LabPanel, ProtocolSchedule } from "@/lib/types";
import { PROTOCOL_DISCLAIMER } from "@/lib/data/protocolReference";
import { adherence, labStatus, siteStatuses } from "./protocols";

/**
 * Doctor report assembly (v3 Phase 6, pure). One artifact with everything a
 * provider wants at a glance: protocol history, adherence, site rotation,
 * labs with trends, symptom summary. Free at every tier — it's the safety
 * story in one file. Pure data assembly here; the page renders it into the
 * same print-window pattern the bloodwork export uses.
 */

export interface DoctorReport {
  generatedAt: string;
  windowFrom: ISODate;
  windowTo: ISODate;
  protocol: Array<{
    compound: string;
    category: string;
    schedule: string;
    prescriberNote: string;
  }>;
  adherencePercent: number | null;
  scheduledCount: number;
  loggedCount: number;
  doses: Array<{ date: string; compound: string; dose: string; site: string }>;
  rotation: Array<{ site: string; lastUsed: string; uses: number }>;
  labs: Array<{
    date: ISODate;
    source: string;
    markers: Array<{ name: string; value: string; range: string; status: string }>;
  }>;
  symptoms: Array<{ tag: string; days: number; avgSeverity: number }>;
  disclaimer: string;
}

const PATTERN_LABEL: Record<string, string> = {
  daily: "daily",
  eod: "every other day",
  e3_5d: "twice weekly (3.5-day)",
  weekly: "weekly",
  custom: "custom days",
};

export function buildDoctorReport(args: {
  compounds: Compound[];
  schedules: ProtocolSchedule[];
  doses: DoseEvent[];
  labs: LabPanel[];
  symptoms: Array<{ date: ISODate; tag: string; severity: number }>;
  from: ISODate;
  to: ISODate;
  generatedAt: string;
}): DoctorReport {
  const { compounds, schedules, doses, labs, symptoms, from, to } = args;
  const byId = new Map(compounds.map((c) => [c.id, c]));
  const a = adherence(schedules, doses, from, to);

  const doseRows = [...doses]
    .sort((x, y) => y.timestamp.localeCompare(x.timestamp))
    .map((d) => ({
      date: d.timestamp.slice(0, 10),
      compound: byId.get(d.compoundId)?.name ?? "—",
      dose: `${d.dose} ${d.doseUnit}`,
      site: d.site || "—",
    }));

  const useCounts = new Map<string, number>();
  for (const d of doses) {
    if (d.site) useCounts.set(d.site, (useCounts.get(d.site) ?? 0) + 1);
  }
  const rotation = siteStatuses(doses, to)
    .filter((s) => s.lastUsed !== null)
    .map((s) => ({
      site: s.label,
      lastUsed: s.lastUsed ?? "—",
      uses: useCounts.get(s.siteId) ?? 0,
    }));

  const symptomAgg = new Map<string, { days: number; total: number }>();
  for (const s of symptoms) {
    const agg = symptomAgg.get(s.tag) ?? { days: 0, total: 0 };
    agg.days += 1;
    agg.total += s.severity;
    symptomAgg.set(s.tag, agg);
  }

  return {
    generatedAt: args.generatedAt,
    windowFrom: from,
    windowTo: to,
    protocol: compounds.map((c) => {
      const s = schedules.find((x) => x.compoundId === c.id);
      return {
        compound: `${c.name}${c.labelConcentration ? ` (${c.labelConcentration} ${c.concentrationUnit})` : ""}`,
        category: c.category.toUpperCase(),
        schedule: s
          ? `${s.dose} ${s.doseUnit} ${PATTERN_LABEL[s.pattern] ?? s.pattern}${s.paused ? " — paused" : ""}`
          : "no schedule on record",
        prescriberNote: c.prescriberNote,
      };
    }),
    adherencePercent: a.percent,
    scheduledCount: a.scheduledCount,
    loggedCount: a.loggedCount,
    doses: doseRows,
    rotation,
    labs: [...labs]
      .sort((x, y) => y.date.localeCompare(x.date))
      .map((p) => ({
        date: p.date,
        source: p.source,
        markers: p.markers.map((m) => ({
          name: m.name,
          value: `${m.value} ${m.unit}`,
          range: m.refLow !== null || m.refHigh !== null ? `${m.refLow ?? "—"}–${m.refHigh ?? "—"}` : "—",
          status: labStatus(m),
        })),
      })),
    symptoms: [...symptomAgg.entries()].map(([tag, agg]) => ({
      tag,
      days: agg.days,
      avgSeverity: Math.round((agg.total / agg.days) * 10) / 10,
    })),
    disclaimer: PROTOCOL_DISCLAIMER,
  };
}
