import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Flags are env-derived (v3.3 Phase 4) and fail-closed. Each test re-imports
 * the module with a fresh env so the module-level FLAGS object re-evaluates.
 */

const ENV_KEYS = [
  "NEXT_PUBLIC_FLAG_TRANSCRIPTION",
  "NEXT_PUBLIC_FLAG_PHOTO_MEAL",
  "NEXT_PUBLIC_FLAG_LIFEGRAPH_AI",
  "NEXT_PUBLIC_FLAG_RESEARCH_LIVE",
] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  vi.resetModules();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

async function loadFlags() {
  return (await import("./flags")).FLAGS;
}

describe("env-derived flags", () => {
  it("unset uses the compiled default (photoMeal true, others false)", async () => {
    const FLAGS = await loadFlags();
    expect(FLAGS.photoMeal).toBe(true);
    expect(FLAGS.transcription).toBe(false);
    expect(FLAGS.lifeGraphAI).toBe(false);
    expect(FLAGS.researchLive).toBe(false);
  });

  it('"true" and "1" enable; anything else is fail-closed', async () => {
    process.env.NEXT_PUBLIC_FLAG_TRANSCRIPTION = "true";
    process.env.NEXT_PUBLIC_FLAG_LIFEGRAPH_AI = "1";
    process.env.NEXT_PUBLIC_FLAG_RESEARCH_LIVE = "yes";
    const FLAGS = await loadFlags();
    expect(FLAGS.transcription).toBe(true);
    expect(FLAGS.lifeGraphAI).toBe(true);
    expect(FLAGS.researchLive).toBe(false); // "yes" is not a truthy token
  });

  it("a default-on flag can be turned OFF by env", async () => {
    process.env.NEXT_PUBLIC_FLAG_PHOTO_MEAL = "false";
    const FLAGS = await loadFlags();
    expect(FLAGS.photoMeal).toBe(false);
  });
});
