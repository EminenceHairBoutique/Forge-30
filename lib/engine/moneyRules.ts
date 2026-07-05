import type {
  DebtItem,
  ISODate,
  MoneySettings,
  PendingPurchase,
  RecurringExpense,
  SpendingCategory,
  SpendingEntry,
} from "@/lib/types";
import { round1 } from "@/lib/utils";
import { possiblePattern } from "./safetyCopy";

/**
 * Money planning rules (E13) — pure. Visibility, limits, and habits with the
 * user's own numbers; never financial, tax, legal, or investment advice.
 * Warning/danger tones downstream are reserved for genuinely user-set limits
 * (a blown category cap, negative cash flow) per the adherence-neutral rule.
 */

/** Normalize any cadence to a monthly figure. */
export function monthlyAmount(e: RecurringExpense): number {
  switch (e.cadence) {
    case "weekly":
      return (e.amount * 52) / 12;
    case "yearly":
      return e.amount / 12;
    default:
      return e.amount;
  }
}

export function monthlyRecurringTotal(expenses: RecurringExpense[]): number {
  return round1(expenses.reduce((sum, e) => sum + monthlyAmount(e), 0));
}

export interface DebtSummary {
  totalBalance: number;
  totalMinimums: number;
  /** Highest-APR debt — where extra dollars do the most, educationally. */
  highestApr: DebtItem | null;
}

export function debtSummary(debts: DebtItem[]): DebtSummary {
  return {
    totalBalance: round1(debts.reduce((s, d) => s + d.balance, 0)),
    totalMinimums: round1(debts.reduce((s, d) => s + d.minimumPayment, 0)),
    highestApr: debts.length
      ? [...debts].sort((a, b) => b.aprPct - a.aprPct)[0]!
      : null,
  };
}

export interface SafeToSpend {
  /** Income minus fixed commitments — the month's discretionary pool. */
  discretionaryMonthly: number;
  spentSoFar: number;
  remaining: number;
  daysLeft: number;
  /** Remaining spread over the days left; null when income isn't set. */
  perDay: number | null;
}

/**
 * Safe-to-spend: income − recurring − debt minimums − savings contribution −
 * what's already spent this month (non-recurring log entries), spread over
 * the days left. A visibility number, not permission or advice.
 */
export function calculateSafeToSpend(args: {
  settings: MoneySettings;
  recurring: RecurringExpense[];
  debts: DebtItem[];
  /** This month's logged spending entries. */
  monthEntries: SpendingEntry[];
  today: ISODate;
}): SafeToSpend {
  const { settings, recurring, debts, monthEntries, today } = args;
  const fixed =
    monthlyRecurringTotal(recurring) +
    debtSummary(debts).totalMinimums +
    settings.monthlySavingsContribution;
  const discretionaryMonthly = round1(settings.monthlyIncome - fixed);
  const spentSoFar = round1(monthEntries.reduce((s, e) => s + e.amount, 0));
  const remaining = round1(discretionaryMonthly - spentSoFar);

  const d = new Date(`${today}T00:00:00`);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(1, lastDay - d.getDate() + 1);

  return {
    discretionaryMonthly,
    spentSoFar,
    remaining,
    daysLeft,
    perDay: settings.monthlyIncome > 0 ? round1(remaining / daysLeft) : null,
  };
}

export interface CashFlow {
  incomeIn: number;
  fixedOut: number;
  variableOut: number;
  net: number;
  risk: "healthy" | "tight" | "negative";
  line: string;
}

/** Month-to-date cash flow with a plain-language risk read. */
export function cashFlowSummary(args: {
  settings: MoneySettings;
  recurring: RecurringExpense[];
  debts: DebtItem[];
  monthEntries: SpendingEntry[];
}): CashFlow {
  const { settings, recurring, debts, monthEntries } = args;
  const fixedOut = round1(
    monthlyRecurringTotal(recurring) + debtSummary(debts).totalMinimums
  );
  const variableOut = round1(monthEntries.reduce((s, e) => s + e.amount, 0));
  const net = round1(settings.monthlyIncome - fixedOut - variableOut - settings.monthlySavingsContribution);
  const ratio = settings.monthlyIncome > 0 ? net / settings.monthlyIncome : 0;

  let risk: CashFlow["risk"];
  let line: string;
  if (settings.monthlyIncome <= 0) {
    risk = "tight";
    line = "Add your expected monthly income and the cash-flow picture fills in.";
  } else if (net < 0) {
    risk = "negative";
    line = "This month is currently spending more than it brings in — worth a look at the biggest line below before it compounds.";
  } else if (ratio < 0.1) {
    risk = "tight";
    line = "The month clears, but thinly — one surprise would flip it. The recurring list is the usual place slack hides.";
  } else {
    risk = "healthy";
    line = "Money in comfortably covers money out this month. The system is working.";
  }
  return { incomeIn: settings.monthlyIncome, fixedOut, variableOut, net, risk, line };
}

export interface CategoryCapStatus {
  category: SpendingCategory;
  spent: number;
  cap: number;
  over: boolean;
}

/** Month spend vs. the user's own caps — only categories with a cap set. */
export function categoryCapStatus(
  monthEntries: SpendingEntry[],
  caps: MoneySettings["categoryCaps"]
): CategoryCapStatus[] {
  const spent = new Map<string, number>();
  for (const e of monthEntries) {
    spent.set(e.category, (spent.get(e.category) ?? 0) + e.amount);
  }
  return (Object.entries(caps) as [SpendingCategory, number][])
    .filter(([, cap]) => cap > 0)
    .map(([category, cap]) => {
      const s = round1(spent.get(category) ?? 0);
      return { category, spent: s, cap, over: s > cap };
    })
    .sort((a, b) => b.spent / b.cap - a.spent / a.cap);
}

export interface StressSpendingPattern {
  count: number;
  total: number;
  /** Share of unnecessary spending that was stress-flagged (0–1). */
  share: number;
  /** Possible-pattern line when the signal is strong enough; else null. */
  line: string | null;
}

/** Stress-spending detection — feeds LifeGraph (E14). Observation, not verdict. */
export function stressSpendingPattern(entries: SpendingEntry[]): StressSpendingPattern {
  const stress = entries.filter((e) => e.stressPurchase);
  const unnecessary = entries.filter((e) => !e.necessary);
  const unnecessaryTotal = unnecessary.reduce((s, e) => s + e.amount, 0);
  const total = round1(stress.reduce((s, e) => s + e.amount, 0));
  const share = unnecessaryTotal > 0 ? total / unnecessaryTotal : 0;

  const line =
    stress.length >= 3 && share >= 0.3
      ? possiblePattern(
          `${stress.length} stress-flagged purchases lately, carrying ${Math.round(share * 100)}% of your unnecessary spending.`,
          "The 24-hour pause below exists for exactly these — park the next one and decide tomorrow."
        )
      : null;
  return { count: stress.length, total, share: round1(share * 100) / 100, line };
}

/** Hours left on a parked purchase; 0 = ready to decide. */
export function pauseHoursLeft(p: PendingPurchase, nowIso: string): number {
  const ms = new Date(p.decideAfter).getTime() - new Date(nowIso).getTime();
  return Math.max(0, Math.ceil(ms / 3600000));
}

/** CSV of spending entries — the E13 export. */
export function spendingCsv(entries: SpendingEntry[]): string {
  const header = "date,amount,category,necessary,business,stressPurchase,note";
  const rows = entries.map((e) =>
    [
      e.date,
      e.amount,
      e.category,
      e.necessary,
      e.business,
      e.stressPurchase,
      `"${e.note.replace(/"/g, '""')}"`,
    ].join(",")
  );
  return [header, ...rows].join("\n");
}
