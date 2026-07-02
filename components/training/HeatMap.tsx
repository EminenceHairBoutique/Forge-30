import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MuscleGroup } from "@/lib/types";
import { cn } from "@/lib/utils";

const GROUPS: { id: MuscleGroup; label: string }[] = [
  { id: "chest", label: "Chest" },
  { id: "back", label: "Back" },
  { id: "shoulders", label: "Shoulders" },
  { id: "biceps", label: "Biceps" },
  { id: "triceps", label: "Triceps" },
  { id: "core", label: "Core" },
  { id: "quads", label: "Quads" },
  { id: "hamstrings", label: "Hams" },
  { id: "glutes", label: "Glutes" },
  { id: "calves", label: "Calves" },
];

/**
 * Weekly muscle-group heat map: single-hue (gold) sequential fill scaled to
 * this week's max set count, with the set count printed in each cell so the
 * value is never encoded by color alone.
 */
export function MuscleHeatMap({ volume }: { volume: Record<string, number> }) {
  const max = Math.max(1, ...Object.values(volume));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly volume — sets per muscle</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-2">
          {GROUPS.map((g) => {
            const sets = volume[g.id] ?? 0;
            const intensity = sets / max;
            return (
              <div
                key={g.id}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center rounded-lg border",
                  sets > 0 ? "border-gold/30" : "border-line"
                )}
                style={{
                  backgroundColor:
                    sets > 0 ? `rgba(201, 169, 97, ${0.12 + intensity * 0.45})` : "var(--bg-elevated)",
                }}
              >
                <span className="display-num text-base text-ivory">{sets}</span>
                <span className="text-[10px] font-semibold text-muted">{g.label}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
