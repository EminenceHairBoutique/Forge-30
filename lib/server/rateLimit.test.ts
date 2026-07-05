import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { callerId, consumeRateLimit, resetMemoryRateLimitsForTests } from "./rateLimit";

/** In-memory store path (no Supabase env in tests). */

const ENV_KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  resetMemoryRateLimitsForTests();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  resetMemoryRateLimitsForTests();
});

describe("consumeRateLimit (memory store)", () => {
  it("counts up to the limit, then refuses", async () => {
    for (let i = 0; i < 3; i++) {
      expect((await consumeRateLimit("coach", "u1", 3)).allowed).toBe(true);
    }
    expect((await consumeRateLimit("coach", "u1", 3)).allowed).toBe(false);
  });

  it("windows are independent per caller and per route", async () => {
    for (let i = 0; i < 2; i++) await consumeRateLimit("coach", "u1", 2);
    expect((await consumeRateLimit("coach", "u1", 2)).allowed).toBe(false);
    expect((await consumeRateLimit("coach", "u2", 2)).allowed).toBe(true);
    expect((await consumeRateLimit("photo", "u1", 2)).allowed).toBe(true);
  });

  it("remaining counts down after each allowed call", async () => {
    expect((await consumeRateLimit("research", "u1", 2)).remaining).toBe(1);
    expect((await consumeRateLimit("research", "u1", 2)).remaining).toBe(0);
  });
});

describe("callerId", () => {
  const reqWith = (headers: Record<string, string>) =>
    new Request("http://localhost/api/coach", { method: "POST", headers });

  it("prefers the authenticated userId", () => {
    expect(callerId(reqWith({ "x-forwarded-for": "1.2.3.4" }), "user-9")).toBe("user-9");
  });

  it("hashes the first-hop IP for anonymous callers — never the raw IP", () => {
    const id = callerId(reqWith({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }), null);
    expect(id).toMatch(/^ip-[0-9a-f]{16}$/);
    expect(id).not.toContain("1.2.3.4");
    // Deterministic per IP; first hop decides.
    expect(callerId(reqWith({ "x-forwarded-for": "1.2.3.4" }), null)).toBe(id);
    expect(callerId(reqWith({ "x-forwarded-for": "5.6.7.8" }), null)).not.toBe(id);
  });

  it("missing forwarding header still yields a stable bucket", () => {
    expect(callerId(reqWith({}), null)).toMatch(/^ip-[0-9a-f]{16}$/);
  });
});
