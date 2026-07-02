import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/**
 * Dashboard stat tile: label, one big number, optional progress bar and
 * status tint. Tapping navigates to the owning section.
 */
export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  href,
  progress,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon?: LucideIcon;
  href?: string;
  progress?: { value: number; max: number };
  tone?: "default" | "success" | "warning" | "danger" | "gold";
  className?: string;
}) {
  const toneText = {
    default: "text-ivory",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
    gold: "text-gold",
  }[tone];

  const body = (
    <Card
      className={cn(
        "flex h-full flex-col gap-1.5 p-4 transition-colors",
        href && "active:border-gold/40 lg:hover:border-gold/40",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-semibold uppercase tracking-widest text-muted">
          {label}
        </span>
        {Icon && <Icon className="size-4 shrink-0 text-muted" />}
      </div>
      <span className={cn("display-num text-2xl leading-tight", toneText)}>{value}</span>
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
