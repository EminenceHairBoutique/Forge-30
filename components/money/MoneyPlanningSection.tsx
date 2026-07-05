"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Download,
  Hourglass,
  PiggyBank,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import {
  calculateSafeToSpend,
  cashFlowSummary,
  categoryCapStatus,
  debtSummary,
  monthlyAmount,
  monthlyRecurringTotal,
  pauseHoursLeft,
  spendingCsv,
  stressSpendingPattern,
} from "@/lib/engine/moneyRules";
import { toISODate, uid, formatMoney, cn } from "@/lib/utils";
import type {
  DebtItem,
  MoneySettings,
  PendingPurchase,
  RecurringCadence,
  RecurringExpense,
  SavingsGoal,
  SpendingCategory,
  SpendingEntry,
} from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const CATEGORIES: { value: SpendingCategory; label: string }[] = [
  { value: "food", label: "Food" },
  { value: "bills", label: "Bills" },
  { value: "transport", label: "Transport" },
  { value: "business", label: "Business" },
  { value: "health", label: "Health" },
  { value: "entertainment", label: "Entertainment" },
  { value: "shopping", label: "Shopping" },
  { value: "subscriptions", label: "Subscriptions" },
  { value: "debt", label: "Debt" },
  { value: "other", label: "Other" },
];

const CADENCES: { value: RecurringCadence; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "yearly", label: "Yearly" },
];

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

/**
 * E13 money planning: safe-to-spend, cash flow, recurring bills, debts,
 * savings goals + emergency fund, category caps, the 24-hour impulse pause,
 * and CSV export. All math lives in lib/engine/moneyRules.ts; this component
 * only loads, renders, and writes through the adapter.
 */
export function MoneyPlanningSection() {
  const { adapter, revision, touch } = useStorage();
  const today = toISODate();
  const monthStart = `${today.slice(0, 8)}01`;

  const [settings, setSettings] = useState<MoneySettings | null>(null);
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [pending, setPending] = useState<PendingPurchase[]>([]);
  const [monthEntries, setMonthEntries] = useState<SpendingEntry[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState<"recurring" | "debt" | "goal" | "pause" | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      adapter.getMoneySettings(),
      adapter.listRecurringExpenses(),
      adapter.listDebts(),
      adapter.listSavingsGoals(),
      adapter.listPendingPurchases(),
      adapter.listSpendingRange(monthStart, today),
    ]).then(([s, r, d, g, p, m]) => {
      if (cancelled) return;
      setSettings(s);
      setRecurring(r.sort((a, b) => monthlyAmount(b) - monthlyAmount(a)));
      setDebts(d.sort((a, b) => b.aprPct - a.aprPct));
      setGoals(g);
      setPending(p);
      setMonthEntries(m);
    });
    return () => {
      cancelled = true;
    };
  }, [adapter, monthStart, today, revision]);

  // `revision` is the deliberate trigger: a fresh timestamp after each write.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nowIso = useMemo(() => new Date().toISOString(), [revision]);

  if (!settings) return null;

  const sts = calculateSafeToSpend({ settings, recurring, debts, monthEntries, today });
  const flow = cashFlowSummary({ settings, recurring, debts, monthEntries });
  const caps = categoryCapStatus(monthEntries, settings.categoryCaps);
  const stress = stressSpendingPattern(monthEntries);
  const debtTotals = debtSummary(debts);
  const waiting = pending.filter((p) => p.status === "waiting");
  const decided = pending.filter((p) => p.status !== "waiting");
  const hasIncome = settings.monthlyIncome > 0;

  const decide = async (p: PendingPurchase, status: "bought" | "skipped") => {
    await adapter.savePendingPurchase({ ...p, status });
    touch();
  };

  const exportCsv = async () => {
    const all = await adapter.listSpendingRange("2000-01-01", today);
    const blob = new Blob([spendingCsv(all)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `forge30-spending-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Safe to spend */}
      <Card className={cn("notch-corner", hasIncome && sts.remaining >= 0 && "border-gold/30")}>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Safe to spend this month</CardTitle>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Money settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 className="size-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {hasIncome ? (
            <>
              <p className="display-num text-3xl">
                <span className={sts.remaining < 0 ? "text-danger" : "text-ivory"}>
                  {formatMoney(sts.remaining)}
                </span>
                {sts.perDay !== null && sts.remaining >= 0 && (
                  <span className="text-base font-semibold text-muted">
                    {" "}
                    · {formatMoney(sts.perDay)}/day × {sts.daysLeft} days
                  </span>
                )}
              </p>
              <p className="text-xs leading-relaxed text-muted">
                {formatMoney(settings.monthlyIncome)} income − {formatMoney(monthlyRecurringTotal(recurring))}{" "}
                recurring − {formatMoney(debtTotals.totalMinimums)} debt minimums −{" "}
                {formatMoney(settings.monthlySavingsContribution)} savings −{" "}
                {formatMoney(sts.spentSoFar)} spent so far. A visibility number, not permission.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">
              Set your monthly income in money settings and this becomes a live safe-to-spend
              number: income minus bills, debt minimums, and savings, spread over the days left.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Stress pattern observation — neutral gold, an observation not a verdict */}
      {stress.line && (
        <Card className="border-gold/30 bg-gold/5">
          <CardContent className="pt-4">
            <p className="text-sm leading-relaxed text-ivory">{stress.line}</p>
          </CardContent>
        </Card>
      )}

      {/* 24-hour pause */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Hourglass className="size-4 text-gold" />
            <CardTitle>24-hour pause</CardTitle>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setAddOpen("pause")}>
            <Plus className="size-4" /> Park a purchase
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {waiting.length === 0 && (
            <p className="text-sm text-muted">
              Want something you didn&apos;t plan to buy? Park it here. If you still want it
              tomorrow, buy it with a clear head — most parked purchases don&apos;t survive the
              night.
            </p>
          )}
          {waiting.map((p) => {
            const hours = pauseHoursLeft(p, nowIso);
            const ready = hours === 0;
            return (
              <div
                key={p.id}
                className="flex min-h-11 items-center gap-2 rounded-(--radius-control) bg-elevated px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ivory">
                    {p.item}
                    <span className="font-normal text-muted"> · {formatMoney(p.amount)}</span>
                  </p>
                  <p className="text-xs text-muted">
                    {ready ? "Pause over — your call, made calmly." : `${hours}h left on the pause`}
                  </p>
                </div>
                {ready && (
                  <Button size="sm" variant="secondary" onClick={() => decide(p, "bought")}>
                    Still want it
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => decide(p, "skipped")}>
                  Skip it
                </Button>
              </div>
            );
          })}
          {decided.length > 0 && (
            <p className="text-xs text-muted">
              Decided so far: {decided.filter((p) => p.status === "skipped").length} skipped ·{" "}
              {decided.filter((p) => p.status === "bought").length} bought —{" "}
              {formatMoney(
                decided.filter((p) => p.status === "skipped").reduce((s, p) => s + p.amount, 0)
              )}{" "}
              stayed in your pocket.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Cash flow */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Cash flow this month</CardTitle>
            {hasIncome && (
              <Badge variant={flow.risk === "negative" ? "danger" : flow.risk === "healthy" ? "success" : "default"}>
                {flow.risk === "negative" ? "spending exceeds income" : flow.risk}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <span className="text-muted">In</span>
              <span className="text-right text-ivory tabular">{formatMoney(flow.incomeIn)}</span>
              <span className="text-muted">Fixed out</span>
              <span className="text-right text-ivory tabular">{formatMoney(flow.fixedOut)}</span>
              <span className="text-muted">Variable out</span>
              <span className="text-right text-ivory tabular">{formatMoney(flow.variableOut)}</span>
              <span className="text-muted">Savings set aside</span>
              <span className="text-right text-ivory tabular">
                {formatMoney(settings.monthlySavingsContribution)}
              </span>
              <span className="font-semibold text-ivory">Net</span>
              <span
                className={cn(
                  "text-right font-semibold tabular",
                  flow.net < 0 ? "text-danger" : "text-ivory"
                )}
              >
                {formatMoney(flow.net)}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-muted">{flow.line}</p>
          </CardContent>
        </Card>

        {/* Category caps */}
        <Card>
          <CardHeader>
            <CardTitle>Your category caps</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {caps.length === 0 && (
              <p className="text-sm text-muted">
                Set monthly caps on the categories you want to keep an eye on (money settings).
                Only over-your-own-line gets flagged — everything else stays neutral.
              </p>
            )}
            {caps.map((c) => (
              <div key={c.category} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="capitalize text-ivory">{c.category}</span>
                  <span className={cn("tabular", c.over ? "font-semibold text-danger" : "text-muted")}>
                    {formatMoney(c.spent)} / {formatMoney(c.cap)}
                    {c.over && " — over your cap"}
                  </span>
                </div>
                <Progress value={c.spent} max={c.cap} barClassName={c.over ? "bg-danger" : undefined} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recurring */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Recurring</CardTitle>
              <p className="mt-0.5 text-xs text-muted">
                {formatMoney(monthlyRecurringTotal(recurring))}/month all-in
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setAddOpen("recurring")}>
              <Plus className="size-4" /> Add
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {recurring.length === 0 && (
              <p className="text-sm text-muted">
                Rent, subscriptions, insurance — list them once and safe-to-spend accounts for
                them automatically. Weekly and yearly amounts are normalized to monthly.
              </p>
            )}
            {recurring.map((e) => (
              <div
                key={e.id}
                className="flex min-h-11 items-center gap-2 rounded-(--radius-control) bg-elevated px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ivory">
                    {e.name}
                    <span className="font-normal text-muted">
                      {" "}
                      · {formatMoney(e.amount)}/{e.cadence.slice(0, e.cadence === "monthly" ? 2 : 4)}
                    </span>
                  </p>
                  <div className="mt-0.5 flex gap-1">
                    <Badge>{e.essential ? "essential" : "cancellable"}</Badge>
                    {e.cadence !== "monthly" && (
                      <Badge variant="gold">{formatMoney(Math.round(monthlyAmount(e)))}/mo</Badge>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`Delete ${e.name}`}
                  onClick={async () => {
                    await adapter.deleteRecurringExpense(e.id);
                    touch();
                  }}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted active:text-danger lg:hover:text-danger"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Debts */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Debts</CardTitle>
              {debts.length > 0 && (
                <p className="mt-0.5 text-xs text-muted">
                  {formatMoney(debtTotals.totalBalance)} total · {formatMoney(debtTotals.totalMinimums)}
                  /mo minimums
                </p>
              )}
            </div>
            <Button size="sm" variant="secondary" onClick={() => setAddOpen("debt")}>
              <Plus className="size-4" /> Add
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {debts.length === 0 && (
              <p className="text-sm text-muted">
                Track balances and minimums here so they&apos;re part of the same picture as
                everything else. No judgment — just the numbers, updated by you.
              </p>
            )}
            {debts.map((d) => (
              <div
                key={d.id}
                className="flex min-h-11 items-center gap-2 rounded-(--radius-control) bg-elevated px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ivory">
                    {d.name}
                    <span className="font-normal text-muted"> · {formatMoney(d.balance)}</span>
                  </p>
                  <p className="text-xs text-muted">
                    {d.aprPct}% APR · {formatMoney(d.minimumPayment)}/mo minimum
                    {debtTotals.highestApr?.id === d.id && debts.length > 1 && (
                      <span className="text-gold"> · highest rate — extra dollars work hardest here</span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Delete ${d.name}`}
                  onClick={async () => {
                    await adapter.deleteDebt(d.id);
                    touch();
                  }}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted active:text-danger lg:hover:text-danger"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Savings + emergency fund */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <PiggyBank className="size-4 text-gold" />
            <CardTitle>Savings</CardTitle>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setAddOpen("goal")}>
            <Plus className="size-4" /> Add goal
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {settings.emergencyFundTarget > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-ivory">Emergency fund</span>
                <span className="tabular text-muted">
                  {formatMoney(settings.emergencyFundSaved)} / {formatMoney(settings.emergencyFundTarget)}
                </span>
              </div>
              <Progress value={settings.emergencyFundSaved} max={settings.emergencyFundTarget} />
            </div>
          )}
          {goals.map((g) => (
            <div key={g.id} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-ivory">{g.name}</span>
                <span className="tabular text-muted">
                  {formatMoney(g.saved)} / {formatMoney(g.target)}
                </span>
                <button
                  type="button"
                  aria-label={`Add $50 to ${g.name}`}
                  onClick={async () => {
                    await adapter.saveSavingsGoal({ ...g, saved: g.saved + 50 });
                    touch();
                  }}
                  className="rounded-(--radius-control) bg-elevated px-2 py-1 text-xs font-semibold text-gold"
                >
                  +$50
                </button>
                <button
                  type="button"
                  aria-label={`Delete goal ${g.name}`}
                  onClick={async () => {
                    await adapter.deleteSavingsGoal(g.id);
                    touch();
                  }}
                  className="flex size-8 items-center justify-center rounded-full text-muted active:text-danger lg:hover:text-danger"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <Progress value={g.saved} max={g.target} />
            </div>
          ))}
          {goals.length === 0 && settings.emergencyFundTarget === 0 && (
            <p className="text-sm text-muted">
              An emergency fund target (money settings) and named goals turn &ldquo;save
              more&rdquo; into a bar that fills up.
            </p>
          )}
        </CardContent>
      </Card>

      <Button variant="secondary" onClick={exportCsv} className="w-full">
        <Download className="size-4 text-gold" /> Export spending log (CSV)
      </Button>

      <MoneySettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
      />
      <AddItemSheet kind={addOpen} onOpenChange={(o) => !o && setAddOpen(null)} />
    </>
  );
}

// -- Settings sheet ----------------------------------------------------------

function MoneySettingsSheet({
  open,
  onOpenChange,
  settings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: MoneySettings;
}) {
  const { adapter, touch } = useStorage();
  const [income, setIncome] = useState("");
  const [contribution, setContribution] = useState("");
  const [efTarget, setEfTarget] = useState("");
  const [efSaved, setEfSaved] = useState("");
  const [caps, setCaps] = useState<Partial<Record<SpendingCategory, string>>>({});

  useEffect(() => {
    if (!open) return;
    setIncome(settings.monthlyIncome ? String(settings.monthlyIncome) : "");
    setContribution(settings.monthlySavingsContribution ? String(settings.monthlySavingsContribution) : "");
    setEfTarget(settings.emergencyFundTarget ? String(settings.emergencyFundTarget) : "");
    setEfSaved(settings.emergencyFundSaved ? String(settings.emergencyFundSaved) : "");
    setCaps(
      Object.fromEntries(
        Object.entries(settings.categoryCaps).map(([k, v]) => [k, v ? String(v) : ""])
      )
    );
  }, [open, settings]);

  const save = async () => {
    const categoryCaps: Partial<Record<SpendingCategory, number>> = {};
    for (const [k, v] of Object.entries(caps)) {
      const n = num(v ?? "");
      if (n > 0) categoryCaps[k as SpendingCategory] = n;
    }
    await adapter.saveMoneySettings({
      monthlyIncome: num(income),
      monthlySavingsContribution: num(contribution),
      emergencyFundTarget: num(efTarget),
      emergencyFundSaved: num(efSaved),
      categoryCaps,
    });
    touch();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Money settings">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ms-income">Monthly income (take-home)</Label>
            <Input
              id="ms-income"
              type="number"
              inputMode="decimal"
              min="0"
              placeholder="0"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ms-contrib">Monthly savings contribution</Label>
            <Input
              id="ms-contrib"
              type="number"
              inputMode="decimal"
              min="0"
              placeholder="0"
              value={contribution}
              onChange={(e) => setContribution(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ms-eft">Emergency fund target</Label>
              <Input
                id="ms-eft"
                type="number"
                inputMode="decimal"
                min="0"
                placeholder="0"
                value={efTarget}
                onChange={(e) => setEfTarget(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ms-efs">Saved so far</Label>
              <Input
                id="ms-efs"
                type="number"
                inputMode="decimal"
                min="0"
                placeholder="0"
                value={efSaved}
                onChange={(e) => setEfSaved(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Monthly category caps (blank = no cap)</Label>
            <div className="flex flex-col gap-2 rounded-(--radius-control) border border-line bg-elevated p-3">
              {CATEGORIES.map((c) => (
                <div key={c.value} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-ivory">{c.label}</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    placeholder="—"
                    aria-label={`${c.label} monthly cap`}
                    className="w-28"
                    value={caps[c.value] ?? ""}
                    onChange={(e) => setCaps({ ...caps, [c.value]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>
          <Button size="lg" onClick={save}>
            Save settings
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// -- Add sheets (recurring / debt / goal / pause) ------------------------------

function AddItemSheet({
  kind,
  onOpenChange,
}: {
  kind: "recurring" | "debt" | "goal" | "pause" | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { adapter, touch } = useStorage();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [extra, setExtra] = useState(""); // APR / target / (unused)
  const [extra2, setExtra2] = useState(""); // minimum payment / saved
  const [cadence, setCadence] = useState<RecurringCadence>("monthly");
  const [category, setCategory] = useState<SpendingCategory>("bills");
  const [essential, setEssential] = useState(true);

  useEffect(() => {
    if (kind) {
      setName("");
      setAmount("");
      setExtra("");
      setExtra2("");
      setCadence("monthly");
      setCategory(kind === "recurring" ? "bills" : "shopping");
      setEssential(true);
    }
  }, [kind]);

  const titles = {
    recurring: "Add recurring expense",
    debt: "Add debt",
    goal: "Add savings goal",
    pause: "Park a purchase — decide tomorrow",
  } as const;

  const save = async () => {
    if (!kind || !name.trim() || num(amount) <= 0) return;
    if (kind === "recurring") {
      await adapter.saveRecurringExpense({
        id: uid(),
        name: name.trim(),
        amount: num(amount),
        cadence,
        category,
        essential,
      });
    } else if (kind === "debt") {
      await adapter.saveDebt({
        id: uid(),
        name: name.trim(),
        balance: num(amount),
        aprPct: num(extra),
        minimumPayment: num(extra2),
      });
    } else if (kind === "goal") {
      await adapter.saveSavingsGoal({
        id: uid(),
        name: name.trim(),
        target: num(amount),
        saved: num(extra2),
      });
    } else {
      const now = new Date();
      await adapter.savePendingPurchase({
        id: uid(),
        item: name.trim(),
        amount: num(amount),
        createdAt: now.toISOString(),
        decideAfter: new Date(now.getTime() + 24 * 3600000).toISOString(),
        status: "waiting",
      });
    }
    touch();
    onOpenChange(false);
  };

  return (
    <Sheet open={!!kind} onOpenChange={onOpenChange}>
      <SheetContent title={kind ? titles[kind] : ""}>
        {kind && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ai-name">{kind === "pause" ? "What is it?" : "Name"}</Label>
              <Input
                id="ai-name"
                placeholder={
                  kind === "recurring"
                    ? "Rent, Netflix, insurance…"
                    : kind === "debt"
                      ? "Card, loan…"
                      : kind === "goal"
                        ? "Trip, laptop…"
                        : "The thing you want right now"
                }
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ai-amount">
                {kind === "debt" ? "Current balance" : kind === "goal" ? "Target amount" : "Amount"}
              </Label>
              <Input
                id="ai-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            {kind === "recurring" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ai-cad">Cadence</Label>
                    <Select
                      id="ai-cad"
                      value={cadence}
                      onChange={(e) => setCadence(e.target.value as RecurringCadence)}
                    >
                      {CADENCES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ai-cat">Category</Label>
                    <Select
                      id="ai-cat"
                      value={category}
                      onChange={(e) => setCategory(e.target.value as SpendingCategory)}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-(--radius-control) border border-line bg-elevated px-3 py-2">
                  <span className="text-sm text-ivory">Essential (can&apos;t cancel)</span>
                  <Switch checked={essential} onCheckedChange={setEssential} aria-label="Essential" />
                </div>
              </>
            )}
            {kind === "debt" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ai-apr">APR %</Label>
                  <Input
                    id="ai-apr"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.1"
                    placeholder="0"
                    value={extra}
                    onChange={(e) => setExtra(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ai-min">Minimum / month</Label>
                  <Input
                    id="ai-min"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    placeholder="0"
                    value={extra2}
                    onChange={(e) => setExtra2(e.target.value)}
                  />
                </div>
              </div>
            )}
            {kind === "goal" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ai-saved">Saved so far (optional)</Label>
                <Input
                  id="ai-saved"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  placeholder="0"
                  value={extra2}
                  onChange={(e) => setExtra2(e.target.value)}
                />
              </div>
            )}
            {kind === "pause" && (
              <p className="text-xs leading-relaxed text-muted">
                <Banknote className="mr-1 inline size-3.5 text-gold" />
                It stays parked for 24 hours. Tomorrow you decide with a clear head — no
                judgment either way.
              </p>
            )}
            <Button size="lg" onClick={save} disabled={!name.trim() || num(amount) <= 0}>
              {kind === "pause" ? "Park it for 24 hours" : "Save"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
