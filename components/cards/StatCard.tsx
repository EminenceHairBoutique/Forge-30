"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useCountUp } from "@/lib/hooks/useCountUp";
import { cn } from "@/lib/utils";

/**
 * HUD data-readout tile: microlabel header, one big number (300ms count-up
 * when numeric), optional progress bar, status tint, and an optional delta
 * chip vs yesterday. Delta stays success-green/neutral — never red for
 * ordinary variance (adherence-neutral rule survives the restyle).
 */
export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  href,
  progress,
  tone = "default",
  delta,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon?: LucideIcon;
  href?: string;
  progress?: { value: number; max: number };
  tone?: "default" | "success" | "danger" | "gold";
  /** Signed change vs yesterday; renders ▲ (success) / ▼ (neutral). */
  delta?: { value: number; unit?: string };
  className?: string;
}) {
  const toneText = {
    default: "text-ivory",
    success: "text-success",
    danger: "text-danger",
    gold: "text-gold",
  }[tone];

  const numeric = typeof value === "number" ? value : null;
  const counted = useCountUp(numeric ?? 0, numeric !== null, 300);

  const body = (
    <Card
      className={cn(
        "focus-brackets flex h-full flex-col gap-1.5 p-4 transition-colors",
        href && "active:border-(--stroke-active) lg:hover:border-(--stroke-active)",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="microlabel truncate text-muted">{label}</span>
        {Icon && <Icon className="size-4 shrink-0 text-muted" />}
      </div>
      <span className={cn("display-num text-2xl leading-tight", toneText)}>
        {numeric !== null ? counted.toLocaleString() : value}
        {delta && delta.value !== 0 && (
          <span
            className={cn(
              "microlabel ml-2 align-middle",
              delta.value > 0 ? "text-success" : "text-muted"
            )}
          >
            {delta.value > 0 ? "▲" : "▼"}
            {Math.abs(delta.value).toLocaleString()}
            {delta.unit ?? ""}
          </span>
        )}
      </span>
      {progress && <Progress value={progress.value} max={progress.max} className="h-1.5" />}
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </Card>
  );

  return href ? (
    <Link href={href} className="block h-full min-h-11">
      {body}
    </Link>
  ) : (
    body
  );
}
