import { describe, expect, it } from "vitest";
import {
  canUseLiveCoach,
  monthKey,
  photoQuotaRemaining,
  resolveTierFromRow,
  tierForPrice,
} from "./subscription";

const NOW = "2026-07-05T12:00:00.000Z";

describe("subscription tier resolution", () => {
  it("no row / unknown / inactive → free", () => {
    expect(resolveTierFromRow(null, NOW)).toBe("free");
    expect(resolveTierFromRow({ tier: "vip", status: "active", current_period_end: null }, NOW)).toBe("free");
    expect(resolveTierFromRow({ tier: "pro", status: "canceled", current_period_end: null }, NOW)).toBe("free");
  });

  it("active/trialing/past_due grant the paid tier inside the period", () => {
    for (const status of ["active", "trialing", "past_due"]) {
      expect(
        resolveTierFromRow({ tier: "pro", status, current_period_end: "2026-08-01T00:00:00Z" }, NOW)
      ).toBe("pro");
    }
    expect(
      resolveTierFromRow({ tier: "elite", status: "active", current_period_end: null }, NOW)
    ).toBe("elite");
  });

  it("expired period (past the 24h grace) → free; inside grace → paid", () => {
    expect(
      resolveTierFromRow({ tier: "pro", status: "active", current_period_end: "2026-07-01T00:00:00Z" }, NOW)
    ).toBe("free");
    expect(
      resolveTierFromRow({ tier: "pro", status: "active", current_period_end: "2026-07-04T20:00:00Z" }, NOW)
    ).toBe("pro");
  });
});

describe("quotas", () => {
  it("month key buckets by calendar month", () => {
    expect(monthKey(NOW)).toBe("2026-07");
  });

  it("photo quotas: free 3, pro 150 fair-use, elite unlimited", () => {
    expect(photoQuotaRemaining("free", 0)).toBe(3);
    expect(photoQuotaRemaining("free", 3)).toBe(0);
    expect(photoQuotaRemaining("pro", 149)).toBe(1);
    expect(photoQuotaRemaining("elite", 10_000)).toBeNull();
  });

  it("live coach gates at pro+", () => {
    expect(canUseLiveCoach("free")).toBe(false);
    expect(canUseLiveCoach("pro")).toBe(true);
    expect(canUseLiveCoach("elite")).toBe(true);
  });
});

describe("price → tier mapping", () => {
  const env = { proMonthly: "price_pm", proYearly: "price_py", eliteMonthly: "price_em", eliteYearly: "price_ey" };
  it("maps configured prices and rejects unknown ones", () => {
    expect(tierForPrice("price_pm", env)).toBe("pro");
    expect(tierForPrice("price_ey", env)).toBe("elite");
    expect(tierForPrice("price_other", env)).toBeNull();
  });
});
