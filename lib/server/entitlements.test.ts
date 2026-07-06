import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveEntitlement } from "./entitlements";

/**
 * The three entitlement resolution paths (v3.3 §1.1 unmetered hard guard):
 * a Supabase-less deployment is Pro-unmetered ONLY with the explicit
 * ALLOW_UNMETERED opt-in; otherwise anonymous traffic is free tier and the
 * IP-keyed rate limits apply.
 */

const ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ALLOW_UNMETERED",
] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const req = (headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/coach", { method: "POST", headers });

describe("resolveEntitlement fallback paths", () => {
  it("unconfigured + ALLOW_UNMETERED=true → pro, unmetered (self-hosted opt-in)", async () => {
    process.env.ALLOW_UNMETERED = "true";
    expect(await resolveEntitlement(req())).toEqual({
      tier: "pro",
      userId: null,
      unmetered: true,
    });
  });

  it("unconfigured without the opt-in → free tier, metered (hard guard)", async () => {
    expect(await resolveEntitlement(req())).toEqual({
      tier: "free",
      userId: null,
      unmetered: false,
    });
  });

  it("any non-'true' opt-in value stays guarded", async () => {
    process.env.ALLOW_UNMETERED = "1";
    expect((await resolveEntitlement(req())).unmetered).toBe(false);
  });

  it("configured but anonymous (no bearer token) → free tier", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
    expect(await resolveEntitlement(req())).toEqual({
      tier: "free",
      userId: null,
      unmetered: false,
    });
  });
});
