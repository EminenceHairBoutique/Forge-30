"use client";

import { PROTOCOL_SITES } from "@/lib/data/protocolReference";
import type { SiteStatus } from "@/lib/engine/protocols";
import { cn } from "@/lib/utils";

/**
 * Injection-site rotation map (v3 Phase 6). Schematic and quiet — a medical
 * record, not an instrument hero. Rest level renders as neutral→gold tint
 * (freshness is data, never judgment; the danger family stays reserved for
 * genuine safety states). Every site is a ≥44pt button with its rest state
 * in the accessible name.
 */
export function BodyMap({
  statuses,
  suggestedSiteId,
  selectedSiteId,
  onSelect,
}: {
  statuses: SiteStatus[];
  suggestedSiteId: string | null;
  selectedSiteId: string | null;
  onSelect: (siteId: string) => void;
}) {
  const byId = new Map(statuses.map((s) => [s.siteId, s]));
  const regions: { label: string; ids: string[] }[] = [
    { label: "Shoulders", ids: ["deltL", "deltR"] },
    { label: "Chest", ids: ["pecL", "pecR"] },
    { label: "Abdomen", ids: ["abdomen"] },
    { label: "Hips / glutes", ids: ["gluteL", "gluteR", "vgluteL", "vgluteR"] },
    { label: "Thighs", ids: ["quadL", "quadR"] },
  ];

  return (
    <div className="flex flex-col gap-3">
      {regions.map((region) => (
        <div key={region.label}>
          <p className="microlabel mb-1.5 text-muted">{region.label}</p>
          <div className="grid grid-cols-2 gap-2">
            {region.ids.map((id) => {
              const site = PROTOCOL_SITES.find((s) => s.id === id)!;
              const status = byId.get(id);
              const rest = status?.restLevel ?? 1;
              const suggested = suggestedSiteId === id;
              const selected = selectedSiteId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelect(id)}
                  aria-label={`${site.label} — ${
                    status?.daysSinceUse === null || status?.daysSinceUse === undefined
                      ? "not used yet"
                      : `used ${status.daysSinceUse} day${status.daysSinceUse === 1 ? "" : "s"} ago`
                  }${suggested ? ", most rested" : ""}`}
                  aria-pressed={selected}
                  className={cn(
                    "flex min-h-11 items-center justify-between rounded-(--radius-control) border px-3 py-2 text-left transition-colors",
                    selected
                      ? "border-(--stroke-active) bg-gold/10"
                      : suggested
                        ? "border-gold/40 bg-elevated"
                        : "border-line bg-elevated"
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ivory">{site.label}</span>
                    <span className="block text-xs text-muted tabular">
                      {status?.lastUsed
                        ? `${status.daysSinceUse}d ago`
                        : "not used yet"}
                      {suggested ? " · most rested" : ""}
                    </span>
                  </span>
                  {/* Rest gauge: neutral→gold as the site rests. */}
                  <span
                    aria-hidden
                    className="ml-2 h-1.5 w-10 shrink-0 overflow-hidden rounded-full bg-(--ring-track)"
                  >
                    <span
                      className="block h-full rounded-full bg-gold/70"
                      style={{ width: `${Math.round(rest * 100)}%` }}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
