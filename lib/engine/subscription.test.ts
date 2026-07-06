import { describe, expect, it } from "vitest";
import {
  canUseLiveCoach,
  monthKey,
  photoQuotaRemaining,
  resolveTierFromRow,
  subscriptionIdFromInvoice,
  subscriptionPatch,
  tierForPrice,
  type StripeSubShape,
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

describe("subscriptionPatch (webhook → subscriptions row)", () => {
  const env = { proMonthly: "price_pm", proYearly: "price_py", eliteMonthly: "price_em", eliteYearly: "price_ey" };
  // Period in seconds (exact round values; expected ISO is derived below).
  const START = 1782_950_400;
  const END = 1785_628_800;
  const START_ISO = new Date(START * 1000).toISOString();
  const END_ISO = new Date(END * 1000).toISOString();
  const sub = (over: Partial<StripeSubShape> = {}): StripeSubShape => ({
    id: "sub_1",
    status: "active",
    cancel_at_period_end: false,
    items: {
      data: [
        {
          price: { id: "price_pm", recurring: { interval: "month" } },
          current_period_start: START,
          current_period_end: END,
        },
      ],
    },
    ...over,
  });

  it("maps a monthly Pro subscription with the extended lifecycle columns", () => {
    const patch = subscriptionPatch(sub(), env);
    expect(patch).toEqual({
      tier: "pro",
      status: "active",
      stripe_subscription_id: "sub_1",
      current_period_start: START_ISO,
      current_period_end: END_ISO,
      cancel_at_period_end: false,
      billing_interval: "month",
    });
  });

  it("carries cancel_at_period_end and the yearly interval through", () => {
    const patch = subscriptionPatch(
      sub({
        cancel_at_period_end: true,
        items: {
          data: [
            {
              price: { id: "price_ey", recurring: { interval: "year" } },
              current_period_start: START,
              current_period_end: END,
            },
          ],
        },
      }),
      env
    );
    expect(patch.tier).toBe("elite");
    expect(patch.cancel_at_period_end).toBe(true);
    expect(patch.billing_interval).toBe("year");
  });

  it("overrides force tier/status (delete → free/canceled, payment_failed → past_due)", () => {
    expect(subscriptionPatch(sub(), env, { tier: "free", status: "canceled" })).toMatchObject({
      tier: "free",
      status: "canceled",
    });
    expect(subscriptionPatch(sub(), env, { status: "past_due" })).toMatchObject({
      tier: "pro",
      status: "past_due",
    });
  });

  it("resolveTierFromRow honors a past_due invoice within the grace, then lapses", () => {
    // past_due still resolves paid inside the period + grace…
    expect(
      resolveTierFromRow({ tier: "pro", status: "past_due", current_period_end: "2026-08-01T00:00:00Z" }, NOW)
    ).toBe("pro");
    // …but once the period + 24h grace elapses, it lapses to free.
    expect(
      resolveTierFromRow({ tier: "pro", status: "past_due", current_period_end: "2026-07-01T00:00:00Z" }, NOW)
    ).toBe("free");
  });

  it("handles an unknown price (defaults to pro) and a missing recurring interval", () => {
    const patch = subscriptionPatch(
      sub({ items: { data: [{ price: { id: "price_unknown", recurring: null }, current_period_end: END }] } }),
      env
    );
    expect(patch.tier).toBe("pro");
    expect(patch.billing_interval).toBeNull();
    expect(patch.current_period_start).toBeNull();
  });
});

describe("subscriptionIdFromInvoice", () => {
  it("reads the id from a string, an object, or the first line, else null", () => {
    expect(subscriptionIdFromInvoice({ subscription: "sub_9" })).toBe("sub_9");
    expect(subscriptionIdFromInvoice({ subscription: { id: "sub_obj" } })).toBe("sub_obj");
    expect(subscriptionIdFromInvoice({ lines: { data: [{ subscription: "sub_line" }] } })).toBe("sub_line");
    expect(subscriptionIdFromInvoice({})).toBeNull();
    expect(subscriptionIdFromInvoice({ subscription: null })).toBeNull();
  });
});
