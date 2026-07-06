import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  LocalStorageAdapter,
  isSyncExcluded,
  resetSyncExclusionsForTests,
  setVoiceSyncOptIn,
  setWriteObserver,
} from "./localStorageAdapter";
import type { BodyMetric } from "@/lib/types";

/**
 * Media storage discipline (v3.3 §3.4): progress photos live in the large
 * store and never sync; voice audio syncs only with the explicit opt-in;
 * legacy metrics with embedded base64 photos are relocated once, losslessly.
 */

function fakeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
}

beforeEach(() => {
  (globalThis as { window?: unknown }).window = { localStorage: fakeLocalStorage() };
  resetSyncExclusionsForTests();
});

afterEach(() => {
  setWriteObserver(null);
  resetSyncExclusionsForTests();
  delete (globalThis as { window?: unknown }).window;
});

describe("sync exclusions for media", () => {
  it("bodyPhotos and mediaPrefs never sync; journalAudio is excluded by default", () => {
    expect(isSyncExcluded("bodyPhotos")).toBe(true);
    expect(isSyncExcluded("mediaPrefs")).toBe(true);
    expect(isSyncExcluded("journalAudio")).toBe(true);
  });

  it("the voice opt-in flips journalAudio only — photos stay excluded", () => {
    setVoiceSyncOptIn(true);
    expect(isSyncExcluded("journalAudio")).toBe(false);
    expect(isSyncExcluded("bodyPhotos")).toBe(true);
    setVoiceSyncOptIn(false);
    expect(isSyncExcluded("journalAudio")).toBe(true);
  });

  it("saveMediaPrefs persists and enforces the opt-in; a cold start re-reads it", async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.saveMediaPrefs({ syncVoice: true });
    expect(isSyncExcluded("journalAudio")).toBe(false);
    // Cold start: fresh module state, same storage.
    resetSyncExclusionsForTests();
    expect(isSyncExcluded("journalAudio")).toBe(false);
    expect((await adapter.getMediaPrefs()).syncVoice).toBe(true);
  });

  it("body-photo writes never reach the write observer", async () => {
    const observed: string[] = [];
    setWriteObserver((collection) => observed.push(collection));
    const adapter = new LocalStorageAdapter();
    await adapter.saveBodyPhoto("m1", "data:image/jpeg;base64,aGk=");
    expect(observed).not.toContain("bodyPhotos");
  });
});

describe("legacy embedded-photo relocation", () => {
  it("moves photoUrl into the large store once, blanks the field, sets hasPhoto", async () => {
    const legacy: BodyMetric = {
      id: "bm-legacy",
      date: "2026-07-01",
      weightLb: 180,
      waistIn: 34,
      chestIn: 42,
      armsIn: 15,
      legsIn: 24,
      energy: 7,
      soreness: 3,
      photoUrl: "data:image/jpeg;base64,bGVnYWN5",
    };
    (globalThis as unknown as { window: { localStorage: Storage } }).window.localStorage.setItem(
      "forge30:bodyMetrics",
      JSON.stringify({ "2026-07-01": legacy })
    );
    const adapter = new LocalStorageAdapter();
    const listed = await adapter.listBodyMetrics("2026-01-01", "2026-12-31");
    expect(listed).toHaveLength(1);
    expect(listed[0]?.photoUrl).toBe("");
    expect(listed[0]?.hasPhoto).toBe(true);
    expect(await adapter.getBodyPhoto("bm-legacy")).toBe("data:image/jpeg;base64,bGVnYWN5");
    // Idempotent: a second adapter over the same storage changes nothing.
    const again = await new LocalStorageAdapter().listBodyMetrics("2026-01-01", "2026-12-31");
    expect(again[0]?.hasPhoto).toBe(true);
    expect(again[0]?.photoUrl).toBe("");
  });

  it("mediaUsageBytes counts stored media approximately", async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.saveBodyPhoto("m1", "x".repeat(4000));
    const bytes = await adapter.mediaUsageBytes();
    expect(bytes).toBeGreaterThan(2500);
    expect(bytes).toBeLessThan(4000);
  });
});
