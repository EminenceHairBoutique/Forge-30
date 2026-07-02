import { Ring } from "./Ring";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { MacroSet } from "@/lib/types";

/**
 * Macro rings: calories hero ring + carb/fat rings, with the protein bar
 * given its own emphasized row. Carbs/fats have no hard target — rings show
 * progress against a derived split of the calorie target (informational).
 */
export function MacroRings({
  totals,
  calorieTarget,
  proteinTarget,
}: {
  totals: MacroSet;
  calorieTarget: number;
  proteinTarget: number;
}) {
  // Informational reference split for a lean-mass gain: 45% carbs / 30% fat.
  const carbRef = Math.round((calorieTarget * 0.45) / 4);
  const fatRef = Math.round((calorieTarget * 0.3) / 9);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-around gap-2">
        <Ring value={totals.calories} max={calorieTarget} size={116} stroke={9} label="Calories">
          <span className="display-num text-2xl leading-none">{totals.calories.toLocaleString()}</span>
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted">
            / {calorieTarget.toLocaleString()} kcal
          </span>
        </Ring>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <Ring value={totals.protein} max={proteinTarget} size={56} stroke={5} label="Protein">
              <span className="display-num text-sm">{Math.round(totals.protein)}</span>
            </Ring>
            <div>
              <p className="text-xs font-semibold text-ivory">Protein</p>
              <p className="text-xs text-muted tabular">
                {Math.round(totals.protein)} / {proteinTarget}g
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Ring value={totals.carbs} max={carbRef} size={56} stroke={5} label="Carbs" color="var(--accent-gold)">
              <span className="display-num text-sm">{Math.round(totals.carbs)}</span>
            </Ring>
            <div>
              <p className="text-xs font-semibold text-ivory">Carbs</p>
              <p className="text-xs text-muted tabular">~{carbRef}g ref</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Ring value={totals.fats} max={fatRef} size={56} stroke={5} label="Fats" color="var(--accent-gold)">
              <span className="display-num text-sm">{Math.round(totals.fats)}</span>
            </Ring>
            <div>
              <p className="text-xs font-semibold text-ivory">Fats</p>
              <p className="text-xs text-muted tabular">~{fatRef}g ref</p>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-semibold uppercase tracking-widest text-muted">Protein progress</span>
          <span className="tabular font-semibold text-ivory">
            {Math.round(totals.protein)} / {proteinTarget}g
          </span>
        </div>
        <Progress value={totals.protein} max={proteinTarget} />
      </div>
    </Card>
  );
}
