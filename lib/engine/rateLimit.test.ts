import { describe, expect, it } from "vitest";
import {
  COACH_DAILY_LIMIT,
  PHOTO_DAILY_BURST,
  RESEARCH_DAILY_LIMIT,
  dayKey,
  rateLimitKey,
  windowDecision,
} from "./rateLimit";

describe("rateLimit engine (fixed daily window)", () => {
  it("dayKey truncates an ISO timestamp to its UTC date", () => {
    expect(dayKey("2026-07-05T23:59:59.999Z")).toBe("2026-07-05");
    expect(dayKey("2026-01-01T00:00:00.000Z")).toBe("2026-01-01");
  });

  it("allows calls under the limit and counts remaining after this one", () => {
    expect(windowDecision(0, 10)).toEqual({ allowed: true, remaining: 9 });
    expect(windowDecision(8, 10)).toEqual({ allowed: true, remaining: 1 });
    expect(windowDecision(9, 10)).toEqual({ allowed: true, remaining: 0 });
  });

  it("refuses at and past the limit", () => {
    expect(windowDecision(10, 10)).toEqual({ allowed: false, remaining: 0 });
    expect(windowDecision(500, 10)).toEqual({ allowed: false, remaining: 0 });
  });

  it("a zero limit refuses everything (fail closed)", () => {
    expect(windowDecision(0, 0).allowed).toBe(false);
  });

  it("garbage counts are clamped, never allowed through", () => {
    expect(windowDecision(-5, 10).allowed).toBe(true); // clamps to 0 used
    expect(windowDecision(9.9, 10)).toEqual({ allowed: true, remaining: 0 });
  });

  it("tier limits match §1.1 (10 free / 40 pro / 80 elite; 20 photo burst; 10 research)", () => {
    expect(COACH_DAILY_LIMIT.free).toBe(10);
    expect(COACH_DAILY_LIMIT.pro).toBe(40);
    expect(COACH_DAILY_LIMIT.elite).toBe(80);
    expect(PHOTO_DAILY_BURST).toBe(20);
    expect(RESEARCH_DAILY_LIMIT).toBe(10);
  });

  it("keys compose route + caller id (userId or IP hash, never a raw IP)", () => {
    expect(rateLimitKey("coach", "user-123")).toBe("coach:user-123");
    expect(rateLimitKey("photo", "ip-a1b2c3")).toBe("photo:ip-a1b2c3");
  });
});
