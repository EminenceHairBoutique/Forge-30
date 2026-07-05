import { describe, expect, it } from "vitest";
import {
  calculateSafeToSpend,
  cashFlowSummary,
  categoryCapStatus,
  debtSummary,
  monthlyRecurringTotal,
  pauseHoursLeft,
  spendingCsv,
  stressSpendingPattern,
} from "./moneyRules";
import { checkSafetyCopy } from "./safetyCopy";
import type { MoneySettings, RecurringExpense, SpendingEntry } from "@/lib/types";

function expense(overrides: Partial<RecurringExpense>): RecurringExpense {
  return { id: "e", name: "x", amount: 0, cadence: "monthly", category: "bills", essential: true, ...overrides };
}

function entry(overrides: Partial<SpendingEntry>): SpendingEntry {
  return {
    id: Math.random().toString(36).slice(2), date: "2026-07-10", amount: 0, category: "shopping",
    necessary: false, business: false, stressPurchase: false, note: "", loggedAt: "2026-07-10T12:00:00.000Z",
    ...overrides,
  };
}

const settings: MoneySettings = {
  monthlyIncome: 4000,
  emergencyFundTarget: 6000,
  emergencyFundSaved: 1500,
  monthlySavingsContribution: 200,
  categoryCaps: { entertainment: 100, shopping: 150 },
};

describe("recurring + debt math", () => {
  it("normalizes cadences to monthly", () => {
    expect(
      monthlyRecurringTotal([
        expense({ amount: 100, cadence: "monthly" }),
        expense({ amount: 12, cadence: "weekly" }), // 52 → 52/12 ≈ 4.33/mo per $1
        expense({ amount: 120, cadence: "yearly" }),
      ])
    ).toBe(round(100 + (12 * 52) / 12 + 10));
    function round(n: number) {
      return Math.round(n * 10) / 10;
    }
  });

  it("summarizes debts and points at the highest APR", () => {
    const s = debtSummary([
      { id: "1", name: "Card A", balance: 2000, aprPct: 24.9, minimumPayment: 60 },
      { id: "2", name: "Car", balance: 8000, aprPct: 6.5, minimumPayment: 220 },
    ]);
    expect(s.totalBalance).toBe(10000);
    expect(s.totalMinimums).toBe(280);
    expect(s.highestApr?.name).toBe("Card A");
  });
});

describe("calculateSafeToSpend", () => {
  it("income minus fixed minus spent, spread over days left", () => {
    const s = calculateSafeToSpend({
      settings,
      recurring: [expense({ amount: 1500 })], // rent etc.
      debts: [{ id: "1", name: "Card", balance: 1000, aprPct: 20, minimumPayment: 50 }],
      monthEntries: [entry({ amount: 300 })],
      today: "2026-07-16", // July has 31 days → 16 left incl. today
    });
    // 4000 − 1500 − 50 − 200 = 2250 discretionary; minus 300 spent = 1950.
    expect(s.discretionaryMonthly).toBe(2250);
    expect(s.remaining).toBe(1950);
    expect(s.daysLeft).toBe(16);
    expect(s.perDay).toBe(Math.round((1950 / 16) * 10) / 10);
  });

  it("no income set → perDay null instead of a fake number", () => {
    const s = calculateSafeToSpend({
      settings: { ...settings, monthlyIncome: 0 },
      recurring: [],
      debts: [],
      monthEntries: [],
      today: "2026-07-16",
    });
    expect(s.perDay).toBeNull();
  });
});

describe("cashFlowSummary", () => {
  it("healthy, tight, and negative reads with plain-language lines", () => {
    const healthy = cashFlowSummary({ settings, recurring: [expense({ amount: 1000 })], debts: [], monthEntries: [entry({ amount: 500 })] });
    expect(healthy.risk).toBe("healthy");
    const negative = cashFlowSummary({ settings, recurring: [expense({ amount: 3000 })], debts: [], monthEntries: [entry({ amount: 1200 })] });
    expect(negative.risk).toBe("negative");
    expect(negative.net).toBeLessThan(0);
    const tight = cashFlowSummary({ settings, recurring: [expense({ amount: 3300 })], debts: [], monthEntries: [entry({ amount: 200 })] });
    expect(tight.risk).toBe("tight");
    for (const cf of [healthy, tight, negative]) {
      expect(checkSafetyCopy(cf.line).violations).toEqual([]);
      expect(cf.line.toLowerCase()).not.toMatch(/invest|tax advice|you should buy/);
    }
  });
});

describe("categoryCapStatus", () => {
  it("tracks only capped categories and flags overruns", () => {
    const status = categoryCapStatus(
      [entry({ category: "entertainment", amount: 120 }), entry({ category: "food", amount: 500 })],
      settings.categoryCaps
    );
    expect(status).toHaveLength(2); // entertainment + shopping (capped), food ignored
    const ent = status.find((s) => s.category === "entertainment")!;
    expect(ent.over).toBe(true);
    expect(status.find((s) => s.category === "shopping")!.over).toBe(false);
  });
});

describe("stressSpendingPattern", () => {
  it("stays quiet under threshold, fires the Possible-pattern line over it", () => {
    const quiet = stressSpendingPattern([entry({ stressPurchase: true, amount: 20 }), entry({ amount: 200 })]);
    expect(quiet.line).toBeNull();
    const loud = stressSpendingPattern([
      entry({ stressPurchase: true, amount: 40 }),
      entry({ stressPurchase: true, amount: 60 }),
      entry({ stressPurchase: true, amount: 50 }),
      entry({ amount: 100 }),
    ]);
    expect(loud.count).toBe(3);
    expect(loud.line).toMatch(/^Possible pattern:/);
    expect(loud.line).toMatch(/24-hour pause/);
    expect(checkSafetyCopy(loud.line!).violations).toEqual([]);
  });
});

describe("pause + export", () => {
  it("counts hours left on a parked purchase", () => {
    const p = {
      id: "p", item: "shoes", amount: 120, status: "waiting" as const,
      createdAt: "2026-07-10T12:00:00.000Z", decideAfter: "2026-07-11T12:00:00.000Z",
    };
    expect(pauseHoursLeft(p, "2026-07-10T18:00:00.000Z")).toBe(18);
    expect(pauseHoursLeft(p, "2026-07-11T13:00:00.000Z")).toBe(0);
  });

  it("emits well-formed CSV with quoted notes", () => {
    const csv = spendingCsv([entry({ amount: 12.5, note: 'said "treat"' })]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("date,amount,category,necessary,business,stressPurchase,note");
    expect(lines[1]).toContain('12.5,shopping,false,false,false,"said ""treat"""');
  });
});
