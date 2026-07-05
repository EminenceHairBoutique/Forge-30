import { describe, expect, it } from "vitest";
import { DOWNGRADE_TRUST_LINE, FEATURE_ROWS, PLAN_COLUMNS } from "./pricing";
import { TIER_PRICING } from "@/lib/engine/entitlements";

/**
 * The paywall table must never contradict the guardrail that safety and
 * core habit features are free at every tier (v3.3 §5 + both audits).
 */

const NEVER_PAYWALLED = [
  "Logging, streaks & sync",
  "Notifications & HealthKit",
  "Food search & mock coach",
  "Crisis & safety resources",
  "Doctor report & Hard Day",
  "Export & delete your data",
];

describe("pricing table invariants", () => {
  it("every never-paywalled row is included on Free, Pro, and Elite", () => {
    for (const label of NEVER_PAYWALLED) {
      const row = FEATURE_ROWS.find((r) => r.label === label);
      expect(row, `missing row: ${label}`).toBeDefined();
      expect(row!.free).toBe(true);
      expect(row!.pro).toBe(true);
      expect(row!.elite).toBe(true);
    }
  });

  it("photo nutrition shows the real per-tier quota (3 / 150 / Unlimited)", () => {
    const row = FEATURE_ROWS.find((r) => r.label.startsWith("Photo nutrition"));
    expect(row).toMatchObject({ free: "3", pro: "150", elite: "Unlimited" });
  });

  it("premium AI rows are off on Free", () => {
    for (const label of ["Live AI coach + 30-day memory", "Adaptive targets & LifeGraph"]) {
      expect(FEATURE_ROWS.find((r) => r.label === label)?.free).toBe(false);
    }
  });

  it("column prices mirror TIER_PRICING", () => {
    const pro = PLAN_COLUMNS.find((c) => c.key === "pro")!;
    const elite = PLAN_COLUMNS.find((c) => c.key === "elite")!;
    expect(pro.monthly).toBe(TIER_PRICING.pro.monthly);
    expect(pro.yearly).toBe(TIER_PRICING.pro.yearly);
    expect(elite.monthly).toBe(TIER_PRICING.elite.monthly);
    expect(elite.yearly).toBe(TIER_PRICING.elite.yearly);
  });

  it("the trust line is the verbatim spec copy (no data-loss language)", () => {
    expect(DOWNGRADE_TRUST_LINE).toBe(
      "Downgrading never deletes your data — features stop generating, nothing is lost."
    );
  });
});
