import type { CoachInput } from "@/lib/engine/mockCoach";

/**
 * Hand-rolled request validation (v3.3 §1.9) — no schema-library dependency.
 * Every public API route validates shape, types, enum membership, and size
 * caps before doing any work. Errors are plain language and never echo the
 * payload back.
 */

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

/** Total request-body cap for JSON routes (64 KB). */
export const MAX_JSON_BODY_BYTES = 64 * 1024;

/** Base64 image cap (~4 MB of base64 ≈ a 3 MB image; routes may be stricter). */
export const MAX_IMAGE_BASE64_BYTES = 4 * 1024 * 1024;

/**
 * Read + parse a JSON body under a byte cap. Returns the parsed unknown —
 * shape validation is the caller's next step.
 */
export async function readJsonBody(req: Request, maxBytes: number): Promise<Validation<unknown>> {
  let text: string;
  try {
    text = await req.text();
  } catch {
    return { ok: false, error: "Could not read the request." };
  }
  if (text.length > maxBytes) {
    return { ok: false, error: "Request too large." };
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, error: "Malformed request." };
  }
}

// ---------------------------------------------------------------------------
// Field-spec mini-language
// ---------------------------------------------------------------------------

type FieldSpec =
  | { kind: "string"; max: number }
  | { kind: "number"; nullable?: boolean }
  | { kind: "boolean" }
  | { kind: "enum"; values: readonly string[] }
  | { kind: "stringArray"; maxItems: number; maxLen: number }
  | { kind: "object"; nullable?: boolean }
  | { kind: "objectArray"; maxItems: number };

const NUM_ABS_MAX = 10_000_000;

function checkField(value: unknown, spec: FieldSpec): boolean {
  switch (spec.kind) {
    case "string":
      return typeof value === "string" && value.length <= spec.max;
    case "number":
      if (value === null) return spec.nullable === true;
      return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= NUM_ABS_MAX;
    case "boolean":
      return typeof value === "boolean";
    case "enum":
      return typeof value === "string" && spec.values.includes(value);
    case "stringArray":
      return (
        Array.isArray(value) &&
        value.length <= spec.maxItems &&
        value.every((x) => typeof x === "string" && x.length <= spec.maxLen)
      );
    case "object":
      if (value === null) return spec.nullable === true;
      return typeof value === "object" && !Array.isArray(value);
    case "objectArray":
      return (
        Array.isArray(value) &&
        value.length <= spec.maxItems &&
        value.every((x) => typeof x === "object" && x !== null && !Array.isArray(x))
      );
  }
}

function validateShape(
  raw: unknown,
  required: Record<string, FieldSpec>,
  optional: Record<string, FieldSpec>
): string | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return "Malformed request.";
  }
  const obj = raw as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (!(key in required) && !(key in optional)) {
      return "Request contains an unexpected field.";
    }
  }
  for (const [key, spec] of Object.entries(required)) {
    if (!(key in obj) || !checkField(obj[key], spec)) {
      return "Request is missing or mistypes a required field.";
    }
  }
  for (const [key, spec] of Object.entries(optional)) {
    if (key in obj && obj[key] !== undefined && !checkField(obj[key], spec)) {
      return "Request mistypes an optional field.";
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// /api/coach — the CoachInput shape
// ---------------------------------------------------------------------------

const COACH_REQUIRED: Record<string, FieldSpec> = {
  name: { kind: "string", max: 200 },
  dayNumber: { kind: "number" },
  forgeScore: { kind: "number" },
  calories: { kind: "number" },
  calorieTarget: { kind: "number" },
  protein: { kind: "number" },
  proteinTarget: { kind: "number" },
  waterMl: { kind: "number" },
  waterTarget: { kind: "number" },
  workoutStatus: { kind: "string", max: 40 },
  splitLabel: { kind: "string", max: 120 },
  sessionPainScore: { kind: "number" },
  sleepHours: { kind: "number" },
  mobilityDone: { kind: "boolean" },
  mood: { kind: "number" },
  stress: { kind: "number" },
  journalDone: { kind: "boolean" },
  spendingChecked: { kind: "boolean" },
  totalSpend: { kind: "number" },
  unnecessarySpend: { kind: "number" },
  dailySpendingLimit: { kind: "number" },
  skillMinutes: { kind: "number" },
  skillMissedTwoDays: { kind: "boolean" },
  weightTrend7d: { kind: "number", nullable: true },
  scoreState: { kind: "enum", values: ["inProgress", "final"] },
  hardDay: { kind: "boolean" },
  journalThemes: { kind: "stringArray", maxItems: 10, maxLen: 80 },
};

const COACH_OPTIONAL: Record<string, FieldSpec> = {
  elevatedBpCount: { kind: "number" },
  bpCrisis: { kind: "boolean" },
  conflictUnrepaired: { kind: "boolean" },
  isolationFlagged: { kind: "boolean" },
  daysSinceOutreach: { kind: "number", nullable: true },
  summary30d: { kind: "object" },
  followThrough: { kind: "objectArray", maxItems: 14 },
  streakCurrent: { kind: "number" },
  streakFreezes: { kind: "number" },
  patterns: { kind: "stringArray", maxItems: 4, maxLen: 400 },
  coachStyle: { kind: "object", nullable: true },
  isSunday: { kind: "boolean" },
  protocolAdherence7d: { kind: "number", nullable: true },
  protocolMissedCount7d: { kind: "number" },
};

export function validateCoachInput(raw: unknown): Validation<CoachInput> {
  const error = validateShape(raw, COACH_REQUIRED, COACH_OPTIONAL);
  if (error) return { ok: false, error };
  return { ok: true, value: raw as CoachInput };
}

// ---------------------------------------------------------------------------
// Image routes — /api/nutrition/photo, /api/protocols/labimport
// ---------------------------------------------------------------------------

const IMAGE_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export interface ImagePayload {
  image: string;
  mediaType: (typeof IMAGE_MEDIA_TYPES)[number];
}

export function validateImagePayload(raw: unknown, maxBase64Bytes: number): Validation<ImagePayload> {
  const error = validateShape(
    raw,
    { image: { kind: "string", max: Math.min(maxBase64Bytes, MAX_IMAGE_BASE64_BYTES) } },
    { mediaType: { kind: "enum", values: IMAGE_MEDIA_TYPES } }
  );
  if (error) return { ok: false, error };
  const obj = raw as { image: string; mediaType?: ImagePayload["mediaType"] };
  if (obj.image.length === 0) return { ok: false, error: "Send one downscaled image." };
  if (!/^[A-Za-z0-9+/=]+$/.test(obj.image)) {
    return { ok: false, error: "Image data isn't valid base64." };
  }
  return { ok: true, value: { image: obj.image, mediaType: obj.mediaType ?? "image/jpeg" } };
}

// ---------------------------------------------------------------------------
// /api/push/subscribe
// ---------------------------------------------------------------------------

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  tz: string;
}

export function validatePushSubscription(raw: unknown): Validation<PushSubscriptionPayload> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "Malformed subscription." };
  }
  const obj = raw as { endpoint?: unknown; keys?: unknown; tz?: unknown };
  if (
    typeof obj.endpoint !== "string" ||
    obj.endpoint.length > 2048 ||
    !obj.endpoint.startsWith("https://")
  ) {
    return { ok: false, error: "Malformed subscription." };
  }
  const keys = obj.keys as { p256dh?: unknown; auth?: unknown } | undefined;
  if (
    !keys ||
    typeof keys.p256dh !== "string" ||
    keys.p256dh.length === 0 ||
    keys.p256dh.length > 512 ||
    typeof keys.auth !== "string" ||
    keys.auth.length === 0 ||
    keys.auth.length > 512
  ) {
    return { ok: false, error: "Malformed subscription." };
  }
  const tz = typeof obj.tz === "string" && obj.tz.length <= 64 ? obj.tz : "UTC";
  return { ok: true, value: { endpoint: obj.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, tz } };
}
