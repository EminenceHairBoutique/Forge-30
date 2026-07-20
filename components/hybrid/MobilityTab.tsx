"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Play, Square } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useStorage } from "@/lib/storage/provider";
import { uid, toISODate, cn } from "@/lib/utils";
import { MOBILITY_CATEGORIES, MOBILITY_LIBRARY } from "@/lib/data/mobilityLibrary";
import type { MobilityDrill } from "@/lib/types";

/**
 * Mobility + prehab library (HT Phase 3 UI): categorized drills with the full
 * field spec, per-drill hold countdown for timed work, and one-tap session
 * logging (select drills → log minutes). Placement chips show where each
 * drill fits (daily / pre / post / recovery).
 */

const PLACEMENT_LABEL: Record<string, string> = {
  daily: "daily",
  preWorkout: "pre-workout",
  postWorkout: "post-workout",
  recoveryDay: "recovery day",
};

function HoldTimer({ seconds }: { seconds: number }) {
  const [left, setLeft] = useState<number | null>(null);
  const endRef = useRef(0);

  useEffect(() => {
    if (left === null) return;
    const t = setInterval(() => {
      const l = Math.max(0, Math.round((endRef.current - Date.now()) / 1000));
      setLeft(l);
      if (l <= 0) {
        clearInterval(t);
        try {
          navigator.vibrate?.(150);
        } catch {
          // Best-effort haptic; no fallback needed.
        }
      }
    }, 200);
    return () => clearInterval(t);
  }, [left]);

  if (left === null || left <= 0) {
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          endRef.current = Date.now() + seconds * 1000;
          setLeft(seconds);
        }}
      >
        <Play className="size-4" /> {seconds}s hold timer
      </Button>
    );
  }
  return (
    <Button variant="secondary" size="sm" onClick={() => setLeft(null)} aria-live="polite">
      <Square className="size-4" /> {left}s
    </Button>
  );
}

function DrillCard({
  drill,
  selected,
  onToggle,
}: {
  drill: MobilityDrill;
  selected: boolean;
  onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("rounded-(--radius-control) border p-3", selected ? "border-gold/50 bg-gold/5" : "border-line")}>
      <div className="flex items-start justify-between gap-2">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ivory">
            {drill.name}
            <ChevronDown className={cn("size-4 text-muted transition-transform", open && "rotate-180")} aria-hidden />
          </p>
          <p className="text-xs text-muted">
            {drill.sets} × {drill.reps}
            {drill.holdSeconds ? ` · ${drill.holdSeconds}s hold` : ""} · rest {drill.restSeconds}s
          </p>
        </button>
        <label className="flex min-h-9 shrink-0 items-center gap-1.5 text-xs text-muted">
          <input type="checkbox" checked={selected} onChange={onToggle} className="size-4 accent-[var(--color-gold)]" />
          did it
        </label>
      </div>

      {open && (
        <div className="mt-2 space-y-2 border-t border-line/60 pt-2">
          <p className="text-xs text-muted">
            {drill.region} · {drill.purpose}
          </p>
          <p className="text-sm leading-relaxed text-ivory">{drill.explanation}</p>
          <ol className="list-decimal space-y-0.5 pl-5 text-sm text-ivory">
            {drill.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <p className="text-xs text-muted">
            <strong>Avoid:</strong> {drill.mistakes.join("; ")}
          </p>
          <p className="text-xs text-muted">
            <strong>Easier:</strong> {drill.regression} · <strong>Harder:</strong> {drill.progression}
          </p>
          <p className="text-xs text-muted">
            <strong>Equipment:</strong> {drill.equipment} · <strong>Frequency:</strong> {drill.frequency}
          </p>
          {drill.cautions.length > 0 && (
            <p className="text-xs text-danger">{drill.cautions.join(" ")}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            {drill.placement.map((p) => (
              <Badge key={p} variant="default">
                {PLACEMENT_LABEL[p]}
              </Badge>
            ))}
            {drill.holdSeconds && <HoldTimer seconds={drill.holdSeconds} />}
          </div>
        </div>
      )}
    </div>
  );
}

export function MobilityTab() {
  const { adapter, touch, revision } = useStorage();
  const [selected, setSelected] = useState<string[]>([]);
  const [minutes, setMinutes] = useState("10");
  const [weekCount, setWeekCount] = useState(0);

  useEffect(() => {
    const to = toISODate();
    const from = toISODate(new Date(Date.now() - 6 * 86400000));
    void adapter.listMobilitySessions(from, to).then((s) => setWeekCount(s.length));
  }, [adapter, revision]);

  const toggle = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const log = async () => {
    await adapter.saveMobilitySession({
      id: uid(),
      date: toISODate(),
      drillIds: selected,
      minutes: Number(minutes) || 0,
      completedAt: new Date().toISOString(),
    });
    touch();
    setSelected([]);
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        {weekCount} mobility session{weekCount === 1 ? "" : "s"} logged this week.
      </p>

      {MOBILITY_CATEGORIES.map((cat) => (
        <Card key={cat.id}>
          <CardHeader>
            <CardTitle>{cat.label}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {MOBILITY_LIBRARY.filter((d) => d.category === cat.id).map((d) => (
              <DrillCard key={d.id} drill={d} selected={selected.includes(d.id)} onToggle={() => toggle(d.id)} />
            ))}
          </CardContent>
        </Card>
      ))}

      {selected.length > 0 && (
        <div className="sticky bottom-24 z-30 flex items-center gap-2 rounded-(--radius-card) border border-gold/40 bg-elevated/95 p-3 backdrop-blur">
          <label className="block w-24 shrink-0">
            <span className="microlabel text-muted">Minutes</span>
            <Input inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} className="mt-1" />
          </label>
          <Button className="flex-1" onClick={log}>
            Log {selected.length} drill{selected.length > 1 ? "s" : ""}
          </Button>
        </div>
      )}
    </div>
  );
}
