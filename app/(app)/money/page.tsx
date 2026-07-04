"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, CalendarCheck, HandCoins } from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import { DISCLAIMERS } from "@/lib/engine/safetyCopy";
import { useDay } from "@/lib/hooks/useDay";
import { toISODate, addDays, formatMoney, mondayWeekday, cn } from "@/lib/utils";
import { calculateSpendingBreakdown } from "@/lib/engine/trends";
import type { SpendingEntry } from "@/lib/types";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/cards/StatCard";
import { SpendLogSheet } from "@/components/forms/SpendLogSheet";
import { SundayReviewSheet } from "@/components/forms/SundayReviewSheet";
import { TimelineRow } from "@/components/ui/TimelineRow";
import { MoneyPlanningSection } from "@/components/money/MoneyPlanningSection";

export default function MoneyPage() {
  const { adapter, profile, revision, touch } = useStorage();
  const today = toISODate();
  const { snapshot, updateLog } = useDay(today);
  const [todayEntries, setTodayEntries] = useState<SpendingEntry[]>([]);
  const [weekEntries, setWeekEntries] = useState<SpendingEntry[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      adapter.listSpending(today),
      adapter.listSpendingRange(addDays(today, -6), today),
    ]).then(([t, w]) => {
      if (cancelled) return;
      setTodayEntries(t.sort((a, b) => b.loggedAt.localeCompare(a.loggedAt)));
      setWeekEntries(w);
    });
    return () => {
      cancelled = true;
    };
  }, [adapter, today, revision]);

  // Deep link: /money?add=1 opens the log sheet.
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("add")) {
      setLogOpen(true);
      window.history.replaceState(null, "", "/money");
    }
  }, []);

  if (!profile) return null;

  const day = calculateSpendingBreakdown(todayEntries);
  const week = calculateSpendingBreakdown(weekEntries);
  const limit = profile.dailySpendingLimit;
  const overLimit = day.unnecessary > limit;
  const isSunday = mondayWeekday(today) === 6;
  const checked = snapshot?.log.spendingChecked ?? false;

  const remove = async (id: string) => {
    await adapter.deleteSpending(id);
    touch();
  };

  return (
    <div data-wide className="flex flex-col gap-4 pb-4">
      <PageHeader
        title="Money"
        subtitle="Visible before it becomes damage."
        action={
          <Button size="sm" onClick={() => setLogOpen(true)}>
            <Plus className="size-4" /> Log spending
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          {/* Daily limit status */}
          <Card className={cn(overLimit && "border-danger/40")}>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Unnecessary today vs limit</CardTitle>
              <Badge variant={overLimit ? "danger" : "success"}>
                {overLimit ? "over limit" : "within limit"}
              </Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <p className="display-num text-3xl">
                <span className={overLimit ? "text-danger" : "text-ivory"}>
                  {formatMoney(day.unnecessary)}
                </span>
                <span className="text-base font-semibold text-muted"> / {formatMoney(limit)}</span>
              </p>
              <Progress
                value={day.unnecessary}
                max={limit}
                barClassName={overLimit ? "bg-danger" : undefined}
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Spent today" value={formatMoney(day.total)} />
            <StatCard
              label="This week"
              value={formatMoney(week.total)}
              sub={`${formatMoney(week.unnecessary)} unnecessary`}
            />
            <StatCard
              label="Business / personal"
              value={
                <>
                  {formatMoney(week.business)}
                  <span className="text-sm text-muted"> / {formatMoney(week.personal)}</span>
                </>
              }
              sub="this week — keep them separated"
            />
            <StatCard
              label="Stress purchases"
              value={week.stressPurchaseCount}
              tone={week.stressPurchaseCount > 0 ? "warning" : "default"}
              sub="this week"
            />
          </div>

          {!checked && todayEntries.length === 0 && (
            <Button variant="secondary" onClick={() => updateLog({ spendingChecked: true })}>
              <HandCoins className="size-4 text-gold" /> No spending today — mark checked
            </Button>
          )}

          <Button
            variant={isSunday ? "default" : "secondary"}
            onClick={() => setReviewOpen(true)}
            className="w-full"
          >
            <CalendarCheck className={cn("size-4", !isSunday && "text-gold")} />
            Sunday budget review {isSunday && "— it's Sunday"}
          </Button>
        </div>

        {/* Today's entries */}
        <Card className="lg:self-start">
          <CardHeader>
            <CardTitle>Today's entries</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {todayEntries.length === 0 && (
              <div className="flex flex-col gap-2 py-4 text-center">
                <p className="text-sm text-muted">Nothing logged yet.</p>
                <p className="text-xs leading-relaxed text-muted">
                  The philosophy: business and personal stay separated. Stress purchases get
                  named. No &ldquo;I&apos;ll make it back later&rdquo; thinking. Make spending
                  visible before it becomes damage.
                </p>
              </div>
            )}
            {todayEntries.map((e) => (
              <TimelineRow key={e.id} time={e.loggedAt.slice(11, 16)}>
              <div
                className="flex min-h-11 items-center gap-2 rounded-(--radius-control) bg-elevated px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ivory tabular">
                    {formatMoney(e.amount)}{" "}
                    <span className="font-normal text-muted capitalize">· {e.category}</span>
                  </p>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {/* Category label the user chose, not a safety signal —
                        orange stays reserved for genuine safety colors. */}
                    <Badge variant={e.necessary ? "default" : "gold"}>
                      {e.necessary ? "necessary" : "unnecessary"}
                    </Badge>
                    <Badge>{e.business ? "business" : "personal"}</Badge>
                    {e.stressPurchase && <Badge variant="danger">stress</Badge>}
                  </div>
                  {e.note && <p className="mt-0.5 text-xs text-muted">{e.note}</p>}
                </div>
                <button
                  type="button"
                  aria-label={`Delete ${formatMoney(e.amount)} entry`}
                  onClick={() => remove(e.id)}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted active:text-danger lg:hover:text-danger"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              </TimelineRow>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Money planning (E13): safe-to-spend, cash flow, recurring, debts,
          savings, caps, 24-hour pause, export. */}
      <MoneyPlanningSection />

      <p className="px-2 pb-2 text-center text-xs leading-relaxed text-muted">{DISCLAIMERS.finance}</p>

      <SpendLogSheet open={logOpen} onOpenChange={setLogOpen} />
      <SundayReviewSheet open={reviewOpen} onOpenChange={setReviewOpen} />
    </div>
  );
}
