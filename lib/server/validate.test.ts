import { describe, expect, it } from "vitest";
import {
  MAX_JSON_BODY_BYTES,
  readJsonBody,
  validateCoachInput,
  validateImagePayload,
  validatePushSubscription,
} from "./validate";
import { crossOriginBlocked } from "./origin";

/** A minimal valid CoachInput body. */
function coachBody(): Record<string, unknown> {
  return {
    name: "Test",
    dayNumber: 5,
    forgeScore: 70,
    calories: 2200,
    calorieTarget: 2400,
    protein: 140,
    proteinTarget: 150,
    waterMl: 2500,
    waterTarget: 3000,
    workoutStatus: "complete",
    splitLabel: "Push A",
    sessionPainScore: 1,
    sleepHours: 7.5,
    mobilityDone: true,
    mood: 7,
    stress: 4,
    journalDone: true,
    spendingChecked: true,
    totalSpend: 42.5,
    unnecessarySpend: 10,
    dailySpendingLimit: 50,
    skillMinutes: 20,
    skillMissedTwoDays: false,
    weightTrend7d: null,
    scoreState: "final",
    hardDay: false,
    journalThemes: ["consistency"],
  };
}

describe("validateCoachInput", () => {
  it("accepts a well-formed body, with and without optional fields", () => {
    expect(validateCoachInput(coachBody()).ok).toBe(true);
    const withOptional = {
      ...coachBody(),
      bpCrisis: false,
      patterns: ["short sleep follows late spending"],
      daysSinceOutreach: null,
      coachStyle: { directness: "high" },
      protocolAdherence7d: 92,
    };
    expect(validateCoachInput(withOptional).ok).toBe(true);
  });

  it("rejects non-objects and missing required fields", () => {
    expect(validateCoachInput(null).ok).toBe(false);
    expect(validateCoachInput([]).ok).toBe(false);
    expect(validateCoachInput("hi").ok).toBe(false);
    const missing = coachBody();
    delete missing.forgeScore;
    expect(validateCoachInput(missing).ok).toBe(false);
  });

  it("rejects wrong types, bad enums, and non-finite numbers", () => {
    expect(validateCoachInput({ ...coachBody(), calories: "2200" }).ok).toBe(false);
    expect(validateCoachInput({ ...coachBody(), scoreState: "done" }).ok).toBe(false);
    expect(validateCoachInput({ ...coachBody(), stress: Infinity }).ok).toBe(false);
    expect(validateCoachInput({ ...coachBody(), hardDay: "no" }).ok).toBe(false);
    expect(validateCoachInput({ ...coachBody(), journalThemes: [42] }).ok).toBe(false);
  });

  it("rejects unexpected extra keys and oversized strings/arrays", () => {
    expect(validateCoachInput({ ...coachBody(), adminOverride: true }).ok).toBe(false);
    expect(validateCoachInput({ ...coachBody(), name: "x".repeat(201) }).ok).toBe(false);
    expect(
      validateCoachInput({ ...coachBody(), journalThemes: Array(11).fill("t") }).ok
    ).toBe(false);
    expect(
      validateCoachInput({ ...coachBody(), patterns: ["p".repeat(401)] }).ok
    ).toBe(false);
  });

  it("error messages never echo the payload", () => {
    const res = validateCoachInput({ ...coachBody(), name: "SECRET-VALUE-XYZ", extra: 1 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).not.toContain("SECRET-VALUE-XYZ");
  });
});

describe("readJsonBody", () => {
  const reqWith = (body: string) =>
    new Request("http://localhost/api/coach", { method: "POST", body });

  it("parses under the cap, rejects over it, rejects non-JSON", async () => {
    expect((await readJsonBody(reqWith('{"a":1}'), MAX_JSON_BODY_BYTES)).ok).toBe(true);
    expect((await readJsonBody(reqWith("x".repeat(100)), 50)).ok).toBe(false);
    expect((await readJsonBody(reqWith("not json"), MAX_JSON_BODY_BYTES)).ok).toBe(false);
  });
});

describe("validateImagePayload", () => {
  it("accepts base64 with an allow-listed media type; defaults to jpeg", () => {
    const ok = validateImagePayload({ image: "aGVsbG8=", mediaType: "image/png" }, 1000);
    expect(ok.ok).toBe(true);
    const def = validateImagePayload({ image: "aGVsbG8=" }, 1000);
    expect(def.ok && def.value.mediaType === "image/jpeg").toBe(true);
  });

  it("rejects oversized, empty, non-base64, and unknown media types", () => {
    expect(validateImagePayload({ image: "A".repeat(2001) }, 2000).ok).toBe(false);
    expect(validateImagePayload({ image: "" }, 2000).ok).toBe(false);
    expect(validateImagePayload({ image: "<script>" }, 2000).ok).toBe(false);
    expect(validateImagePayload({ image: "aGVsbG8=", mediaType: "image/svg+xml" }, 2000).ok).toBe(false);
    expect(validateImagePayload({ image: "aGVsbG8=", extra: 1 }, 2000).ok).toBe(false);
  });
});

describe("validatePushSubscription", () => {
  const good = {
    endpoint: "https://push.example.com/sub/abc",
    keys: { p256dh: "k1", auth: "k2" },
    tz: "America/New_York",
  };

  it("accepts a valid subscription and defaults tz", () => {
    const res = validatePushSubscription(good);
    expect(res.ok && res.value.tz === "America/New_York").toBe(true);
    const noTz = validatePushSubscription({ ...good, tz: undefined });
    expect(noTz.ok && noTz.value.tz === "UTC").toBe(true);
  });

  it("rejects http endpoints, missing keys, and oversized fields", () => {
    expect(validatePushSubscription({ ...good, endpoint: "http://x.com" }).ok).toBe(false);
    expect(validatePushSubscription({ ...good, keys: { p256dh: "k1" } }).ok).toBe(false);
    expect(validatePushSubscription({ ...good, endpoint: `https://x.com/${"a".repeat(2050)}` }).ok).toBe(false);
    expect(validatePushSubscription(null).ok).toBe(false);
  });
});

describe("crossOriginBlocked", () => {
  const reqWith = (headers: Record<string, string>) =>
    new Request("http://localhost/api/coach", { method: "POST", headers });

  it("passes same-origin, no-origin, and the native shell origins", () => {
    expect(crossOriginBlocked(reqWith({}))).toBe(false);
    expect(
      crossOriginBlocked(reqWith({ origin: "https://forge30.app", host: "forge30.app" }))
    ).toBe(false);
    expect(
      crossOriginBlocked(reqWith({ origin: "capacitor://localhost", host: "forge30.app" }))
    ).toBe(false);
  });

  it("blocks foreign browser origins", () => {
    expect(
      crossOriginBlocked(reqWith({ origin: "https://evil.example", host: "forge30.app" }))
    ).toBe(true);
    expect(crossOriginBlocked(reqWith({ origin: "garbage", host: "forge30.app" }))).toBe(true);
  });

  it("honors the x-forwarded-host the platform sets", () => {
    expect(
      crossOriginBlocked(
        reqWith({
          origin: "https://forge30.app",
          host: "internal:3000",
          "x-forwarded-host": "forge30.app",
        })
      )
    ).toBe(false);
  });
});
