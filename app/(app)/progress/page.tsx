"use client";

import { useEffect, useMemo, useState } from "react";
import { Ruler, Stethoscope } from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import { toISODate, addDays, daysBetween, mondayWeekday, formatMoney, cn } from "@/lib/utils";
import { PROGRAM_LENGTH_DAYS } from "@/lib/data/defaults";
import { calculateWeeklySummary, summarizeWeek } from "@/lib/engine/weeklySummary";
import { getBodyRecommendations } from "@/lib/engine/bodyRules";
import { computePersonalRecords } from "@/lib/engine/trainingRules";
import { calculateSmoothedWeightTrend } from "@/lib/engine/trends";
import { estimateExpenditure } from "@/lib/engine/expenditure";
import type {
  BodyMetric,
  CalendarState,
  DailyLog,
  SpendingEntry,
  WorkoutEntry,
} from "@/lib/types";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { TrendChart, type TrendPoint } from "@/components/charts/TrendChart";
import { PatternsCard } from "@/components/cards/PatternsCard";
import { BodyMetricSheet } from "@/components/forms/BodyMetricSheet";

const STATE_STYLE: Record<CalendarState, { label: string; className: string }> = {
  complete: { label: "Complete", className: "border-success/50 bg-success/15 text-success" },
  partial: { label: "Partial", className: "border-gold/50 bg-gold/15 text-gold" },
  missed: { label: "Missed", className: "border-line bg-elevated text-muted" },
  recovery: { label: "Recovery", className: "border-[#4C86D8]/50 bg-[#4C86D8]/15 text-[#8FB7EA]" },
  highStress: { label: "High stress", className: "border-gold/40 bg-gold/10 text-gold" },
  highPain: { label: "High pain", className: "border-danger/50 bg-danger/15 text-danger" },
};

type Metric =
  | "forge"
  | "weight"
  | "expenditure"
  | "calories"
  | "protein"
  | "workout"
  | "spending"
  | "moodStress"
  | "pain"
  | "sleep";

const METRIC_OPTIONS: { value: Metric; label: string }[] = [
  { value: "forge", label: "Forge Score" },
  { value: "weight", label: "Weight (lb)" },
  { value: "expenditure", label: "Expenditure (est. kcal)" },
  { value: "calories", label: "Calories" },
  { value: "protein", label: "Protein (g)" },
  { value: "workout", label: "Workout completion %" },
  { value: "spending", label: "Spending ($/day)" },
  { value: "moodStress", label: "Mood & stress" },
  { value: "pain", label: "Pain" },
  { value: "sleep", label: "Sleep (h)" },
];

/** Fixed y-ranges for bounded metrics; unbounded ones (weight, kcal) auto-fit. */
const METRIC_Y_DOMAIN: Partial<Record<Metric, [number, number]>> = {
  forge: [0, 100],
  workout: [0, 100],
  moodStress: [0, 10],
  pain: [0, 10],
  sleep: [0, 12],
};

export default function ProgressPage() {
  const { adapter, profile, revision } = useStorage();
  const today = toISODate();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutEntry[]>([]);
  const [spending, setSpending] = useState<SpendingEntry[]>([]);
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [metric, setMetric] = useState<Metric>("forge");
  const [dayDetail, setDayDetail] = useState<string | null>(null);
  const [bodyOpen, setBodyOpen] = useState(false);

  const start = profile?.startDate ?? today;
  const end = addDays(start, PROGRAM_LENGTH_DAYS - 1);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    Promise.all([
      adapter.listDailyLogs(start, end),
      adapter.listWorkouts(start, end),
      adapter.listSpendingRange(start, end),
      adapter.listBodyMetrics(addDays(start, -7), end),
    ]).then(([l, w, s, m]) => {
      if (cancelled) return;
      setLogs(l);
      setWorkouts(w);
      setSpending(s);
      setMetrics(m);
    });
    return () => {
      cancelled = true;
    };
  }, [adapter, profile, start, end, revision]);

  const logByDate = useMemo(() => new Map(logs.map((l) => [l.date, l])), [logs]);
  const workoutByDate = useMemo(() => new Map(workouts.map((w) => [w.date, w])), [workouts]);
  const prs = useMemo(() => computePersonalRecords(workouts), [workouts]);

  // Current week (Mon–Sun) report card.
  const weekStart = addDays(today, -mondayWeekday(today));
  const weekEnd = addDays(weekStart, 6);
  const weekSummary = useMemo(() => {
    if (!profile) return null;
    return calculateWeeklySummary({
      weekStart,
      weekEnd,
      logs: logs.filter((l) => l.date >= weekStart && l.date <= weekEnd),
      workouts: workouts.filter((w) => w.date >= weekStart && w.date <= weekEnd),
      spending: spending.filter((s) => s.date >= weekStart && s.date <= weekEnd),
      metrics: metrics.filter((m) => m.date >= weekStart && m.date <= weekEnd),
      prs,
      profile,
      expectedDays: daysBetween(weekStart, today) + 1,
    });
  }, [profile, logs, workouts, spending, metrics, prs, weekStart, weekEnd, today]);

  const recommendations = useMemo(() => {
    if (!profile) return [];
    return getBodyRecommendations({
      metrics: metrics.filter((m) => m.date >= addDays(today, -13)),
      logs: logs.filter((l) => l.date >= addDays(today, -6)),
      profile,
    });
  }, [profile, metrics, logs, today]);

  const chartData: TrendPoint[] = useMemo(() => {
    if (!profile) return [];
    const points: TrendPoint[] = [];
    const spendByDate = new Map<string, number>();
    for (const s of spending)
      spendByDate.set(s.date, (spendByDate.get(s.date) ?? 0) + s.amount);
    const metricByDate = new Map(metrics.map((m) => [m.date, m]));
    const trendByDate = new Map(
      calculateSmoothedWeightTrend(metrics).map((p) => [p.date, p.trendLb])
    );
    let workoutsDone = 0;

    const lastDay = Math.min(daysBetween(start, today) + 1, PROGRAM_LENGTH_DAYS);
    for (let i = 0; i < lastDay; i++) {
      const date = addDays(start, i);
      const log = logByDate.get(date);
      const bm = metricByDate.get(date);
      const label = `D${i + 1}`;
      if (log && (log.workoutStatus === "complete" || log.workoutStatus === "rest")) workoutsDone++;
      switch (metric) {
        case "forge":
          points.push({ label, a: log ? log.forgeScore : null });
          break;
        case "weight":
          points.push({
            label,
            a: bm && bm.weightLb > 0 ? bm.weightLb : null,
            b: trendByDate.get(date) ?? null,
          });
          break;
        case "expenditure":
          // Rolling estimate: what the engine would have said on that day.
          points.push({
            label,
            a: estimateExpenditure({ logs, metrics, today: date }).tdee,
          });
          break;
        case "calories":
          points.push({ label, a: log && log.calories > 0 ? log.calories : null });
          break;
        case "protein":
          points.push({ label, a: log && log.protein > 0 ? Math.round(log.protein) : null });
          break;
        case "workout":
          points.push({ label, a: Math.round((workoutsDone / (i + 1)) * 100) });
          break;
        case "spending":
          points.push({ label, a: spendByDate.get(date) ?? 0 });
          break;
        case "moodStress":
          points.push({
            label,
            a: log && log.mood > 0 ? log.mood : null,
            b: log && log.stress > 0 ? log.stress : null,
          });
          break;
        case "pain":
          points.push({ label, a: log ? log.painScore : null });
          break;
        case "sleep":
          points.push({ label, a: log && log.sleepHours > 0 ? log.sleepHours : null });
          break;
      }
    }
    return points;
  }, [profile, metric, spending, metrics, logs, logByDate, start, today]);

  if (!profile) return null;

  const chartPointCount = chartData.filter((p) => p.a !== null || (p.b ?? null) !== null).length;
  const latestChartPoint = [...chartData].reverse().find((p) => p.a !== null || (p.b ?? null) !== null);
  const latestChartValue = latestChartPoint?.a ?? latestChartPoint?.b ?? null;

  const detailLog = dayDetail ? logByDate.get(dayDetail) : undefined;
  const detailWorkout = dayDetail ? workoutByDate.get(dayDetail) : undefined;

  const target =
    metric === "calories"
      ? profile.calorieTarget
      : metric === "protein"
        ? profile.proteinTarget
        : undefined;

  return (
    <div data-wide className="flex flex-col gap-4 pb-4">
      <PageHeader
        title="Progress"
        subtitle="The 30-day picture"
        action={
          <Button size="sm" variant="secondary" onClick={() => setBodyOpen(true)}>
            <Ruler className="size-4 text-gold" /> Body metrics
          </Button>
        }
      />

      {recommendations.length > 0 && (
        <Card className="border-gold/30 bg-gold/5 p-4">
          <p className="flex items-center gap-2 microlabel text-gold">
            <Stethoscope className="size-4" /> Coach recommendations
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {recommendations.map((r, i) => (
              <li key={i} className="text-sm text-ivory">
                {r}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 30-day calendar */}
        <Card>
          <CardHeader>
            <CardTitle>30-day calendar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-6 gap-1.5">
              {Array.from({ length: PROGRAM_LENGTH_DAYS }, (_, i) => {
                const date = addDays(start, i);
                const log = logByDate.get(date);
                const isFuture = date > today;
                const isToday = date === today;
                const style = log ? STATE_STYLE[log.calendarState] : null;
                return (
                  <button
                    key={date}
                    type="button"
                    disabled={isFuture}
                    onClick={() => setDayDetail(date)}
                    aria-label={`Day ${i + 1}, ${log ? STATE_STYLE[log.calendarState].label : isFuture ? "upcoming" : "no data"}`}
                    className={cn(
                      "flex aspect-square min-h-11 flex-col items-center justify-center rounded-lg border text-center transition-colors",
                      style?.className ?? "border-line bg-elevated text-muted",
                      isFuture && "opacity-35",
                      isToday && "ring-2 ring-gold/70"
                    )}
                  >
                    <span className="display-num text-sm leading-none">{i + 1}</span>
                    {log && <span className="mt-0.5 text-[9px] leading-none">{log.forgeScore}</span>}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {Object.entries(STATE_STYLE).map(([key, s]) => (
                <span
                  key={key}
                  className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", s.className)}
                >
                  {s.label}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Weekly report card */}
        {weekSummary && (
          <Card>
            <CardHeader>
              <CardTitle>
                Weekly report — {weekStart.slice(5)} → {weekEnd.slice(5)}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="display-num text-xl text-ivory">{weekSummary.avgForgeScore}</p>
                  <p className="text-xs text-muted">avg score</p>
                </div>
                <div>
                  <p className="display-num text-xl text-ivory">
                    {weekSummary.avgCalories.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted">avg kcal</p>
                </div>
                <div>
                  <p className="display-num text-xl text-ivory">{weekSummary.avgProtein}g</p>
                  <p className="text-xs text-muted">avg protein</p>
                </div>
                <div>
                  <p className="display-num text-xl text-ivory">
                    {weekSummary.weightTrendLb === null
                      ? "—"
                      : `${weekSummary.weightTrendLb > 0 ? "+" : ""}${weekSummary.weightTrendLb}`}
                  </p>
                  <p className="text-xs text-muted">lb this week</p>
                </div>
                <div>
                  <p className="display-num text-xl text-ivory">{weekSummary.workoutCompletionPct}%</p>
                  <p className="text-xs text-muted">workouts</p>
                </div>
                <div>
                  <p className="display-num text-xl text-ivory">{weekSummary.prCount}</p>
                  <p className="text-xs text-muted">PRs</p>
                </div>
                <div>
                  <p className="display-num text-xl text-ivory">
                    {formatMoney(weekSummary.spendingTotal)}
                  </p>
                  <p className="text-xs text-muted">spent</p>
                </div>
                <div>
                  <p className="display-num text-xl text-ivory">
                    {weekSummary.avgStress || "—"}
                  </p>
                  <p className="text-xs text-muted">avg stress</p>
                </div>
                <div>
                  <p className="display-num text-xl text-ivory">{weekSummary.avgSleep || "—"}</p>
                  <p className="text-xs text-muted">avg sleep</p>
                </div>
              </div>
              <div className="rounded-(--radius-control) bg-elevated px-3 py-2">
                <p className="text-xs text-muted">
                  Most-missed habit:{" "}
                  <span className="font-semibold text-ivory">{weekSummary.mostMissedHabit}</span>
                </p>
              </div>
              <p className="text-sm leading-relaxed text-ivory">
                {summarizeWeek(weekSummary, profile)}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* LifeGraph patterns in the weekly report (E14) */}
      <PatternsCard title="Patterns in your data" limit={3} />

      {/* Trends */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>Trends</CardTitle>
          <Select
            aria-label="Chart metric"
            value={metric}
            onChange={(e) => setMetric(e.target.value as Metric)}
            className="w-52"
          >
            {METRIC_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </CardHeader>
        <CardContent>
          {chartPointCount >= 2 ? (
            <TrendChart
              data={chartData}
              seriesA={
                metric === "moodStress"
                  ? "Mood"
                  : metric === "weight"
                    ? "Scale weight"
                    : (METRIC_OPTIONS.find((o) => o.value === metric)?.label ?? "")
              }
              seriesB={
                metric === "moodStress" ? "Stress" : metric === "weight" ? "Trend weight" : undefined
              }
              target={target}
              yDomain={METRIC_Y_DOMAIN[metric]}
            />
          ) : (
            <div className="flex flex-col items-center gap-1.5 py-10 text-center">
              <p className="display-num text-2xl text-ivory">
                {chartPointCount === 1 ? latestChartValue : "—"}
              </p>
              <p className="text-sm text-muted">
                {chartPointCount === 1
                  ? "One day logged. A trend line starts at two — tomorrow's log draws it."
                  : "No data yet for this metric. It fills in as you log."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent body metrics + photos */}
      {metrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Body log</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {metrics.some((m) => m.photoUrl) && (
              <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {metrics
                  .filter((m) => m.photoUrl)
                  .slice(-8)
                  .map((m) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={m.id}
                      src={m.photoUrl}
                      alt={`Progress photo ${m.date}`}
                      className="h-28 w-20 shrink-0 rounded-(--radius-control) border border-line object-cover"
                    />
                  ))}
              </div>
            )}
            {metrics
              .slice(-7)
              .reverse()
              .map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted">{m.date}</span>
                  <span className="tabular text-ivory">
                    {m.weightLb > 0 ? `${m.weightLb} lb` : "—"}
                    {m.waistIn > 0 ? ` · waist ${m.waistIn}"` : ""}
                    {m.soreness > 0 ? ` · soreness ${m.soreness}/10` : ""}
                  </span>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Day detail sheet */}
      <Sheet open={!!dayDetail} onOpenChange={(o) => !o && setDayDetail(null)}>
        <SheetContent
          title={
            dayDetail
              ? `Day ${daysBetween(start, dayDetail) + 1} — ${dayDetail}`
              : "Day detail"
          }
        >
          {detailLog ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="display-num text-4xl text-ivory">{detailLog.forgeScore}</span>
                <Badge className={cn("border", STATE_STYLE[detailLog.calendarState].className)}>
                  {STATE_STYLE[detailLog.calendarState].label}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <span className="text-muted">Workout</span>
                <span className="text-ivory">
                  {detailWorkout ? `${detailWorkout.splitLabel} — ${detailWorkout.status}` : detailLog.workoutStatus}
                </span>
                <span className="text-muted">Calories</span>
                <span className="tabular text-ivory">{detailLog.calories.toLocaleString()}</span>
                <span className="text-muted">Protein</span>
                <span className="tabular text-ivory">{Math.round(detailLog.protein)}g</span>
                <span className="text-muted">Meals logged</span>
                <span className="text-ivory">{detailLog.calories > 0 ? "Yes" : "No"}</span>
                <span className="text-muted">Spending checked</span>
                <span className="text-ivory">{detailLog.spendingChecked ? "Yes" : "No"}</span>
                <span className="text-muted">Journal</span>
                <span className="text-ivory">{detailLog.journalDone ? "Done" : "—"}</span>
                <span className="text-muted">Skill minutes</span>
                <span className="tabular text-ivory">{detailLog.skillMinutes}</span>
                <span className="text-muted">Sleep</span>
                <span className="tabular text-ivory">
                  {detailLog.sleepHours > 0 ? `${detailLog.sleepHours}h` : "—"}
                </span>
                <span className="text-muted">Pain</span>
                <span className="tabular text-ivory">
                  {detailLog.painScore > 0 ? `${detailLog.painScore}/10` : "none"}
                </span>
                <span className="text-muted">Mood / stress</span>
                <span className="tabular text-ivory">
                  {detailLog.mood > 0 ? `${detailLog.mood} / ${detailLog.stress}` : "—"}
                </span>
              </div>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted">Nothing logged this day.</p>
          )}
        </SheetContent>
      </Sheet>

      <BodyMetricSheet open={bodyOpen} onOpenChange={setBodyOpen} />
    </div>
  );
}
