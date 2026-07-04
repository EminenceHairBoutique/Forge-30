"use client";

import { FileDown } from "lucide-react";
import {
  EVALUATION_PATHWAY,
  IMPRESSION_MANAGEMENT_NOTE,
  clinicianReportText,
  journalAnnotation,
  overlapView,
} from "@/lib/engine/assessments/clusterB";
import type { AssessmentResult } from "@/lib/types";
import { Button } from "@/components/ui/button";

/**
 * Cluster B result extras (B-3): overlap panel, impression-management line
 * on low confidence, consented journal annotation (read-only), the
 * when-to-pursue-evaluation pathway, and the clinician-report export — the
 * screening as a bridge to care, never a substitute.
 */
export function ClusterBResultExtras({
  result,
  journalThemes,
}: {
  result: AssessmentResult;
  journalThemes: string[];
}) {
  const overlap = overlapView(result);
  const annotation = journalAnnotation(result, journalThemes);

  const exportReport = () => {
    const blob = new Blob([clinicianReportText(result)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `forge30-clusterB-clinician-summary-${result.date}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-3">
      {overlap.show && (
        <div className="rounded-(--radius-control) border border-gold/30 bg-gold/5 px-3 py-2.5">
          <p className="microlabel text-gold">Where patterns overlap</p>
          <p className="mt-1 text-sm leading-relaxed text-ivory">{overlap.body}</p>
        </div>
      )}

      {result.validity.confidenceLevel === "low" && (
        <div className="rounded-(--radius-control) bg-elevated px-3 py-2.5">
          <p className="microlabel text-muted">How to read this result</p>
          <p className="mt-1 text-sm leading-relaxed text-ivory">{IMPRESSION_MANAGEMENT_NOTE}</p>
        </div>
      )}

      {annotation && <p className="text-xs leading-relaxed text-muted">{annotation}</p>}

      <div className="rounded-(--radius-control) bg-elevated px-3 py-2.5">
        <p className="microlabel text-muted">When a licensed evaluation is worth pursuing</p>
        <p className="mt-1 text-sm leading-relaxed text-ivory">{EVALUATION_PATHWAY}</p>
      </div>

      <Button variant="secondary" onClick={exportReport} className="w-full">
        <FileDown className="size-4 text-gold" /> Export clinician summary (for an intake visit)
      </Button>
    </div>
  );
}
