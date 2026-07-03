import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIER,
  FEATURE_TIERS,
  SAFETY_FEATURES,
  TIERS,
  hasFeature,
  isTier,
  requiredTier,
  type GatedFeature,
} from "./entitlements";

describe("hasFeature", () => {
  it("safety features are available at EVERY tier — permanently", () => {
    for (const tier of TIERS) {
      for (const feature of SAFETY_FEATURES) {
        expect(hasFeature(tier, feature), `${tier}/${feature}`).toBe(true);
      }
    }
  });

  it("gates by minimum tier with higher tiers inheriting lower unlocks", () => {
    expect(hasFeature("free", "unlimitedHistory")).toBe(false);
    expect(hasFeature("plus", "unlimitedHistory")).toBe(true);
    expect(hasFeature("plus", "assessments")).toBe(false);
    expect(hasFeature("pro", "assessments")).toBe(true);
    expect(hasFeature("pro", "researchMode")).toBe(false);
    expect(hasFeature("max", "researchMode")).toBe(true);
    expect(hasFeature("max", "householdMode")).toBe(false);
    expect(hasFeature("household", "householdMode")).toBe(true);
    // Inheritance: household gets everything below it.
    for (const feature of Object.keys(FEATURE_TIERS) as GatedFeature[]) {
      expect(hasFeature("household", feature), feature).toBe(true);
    }
  });

  it("free tier has no gated features and all safety features", () => {
    for (const feature of Object.keys(FEATURE_TIERS) as GatedFeature[]) {
      expect(hasFeature("free", feature), feature).toBe(false);
    }
  });
});

describe("requiredTier / isTier / defaults", () => {
  it("reports the unlock tier for paywall copy", () => {
    expect(requiredTier("lifeGraph")).toBe("pro");
    expect(requiredTier("exportImport")).toBe("plus");
  });

  it("validates stored tier strings", () => {
    expect(isTier("pro")).toBe(true);
    expect(isTier("ultra")).toBe(false);
    expect(isTier(3)).toBe(false);
  });

  it("pre-payments default keeps current users unrestricted (flips in E16)", () => {
    expect(DEFAULT_TIER).toBe("max");
  });
});
