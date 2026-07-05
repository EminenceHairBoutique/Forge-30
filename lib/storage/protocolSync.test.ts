import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  LocalStorageAdapter,
  setProtocolLocalOnly,
  setWriteObserver,
  isSyncExcluded,
  PROTOCOL_COLLECTIONS,
} from "./localStorageAdapter";
import type { Compound, ProtocolSettings } from "@/lib/types";

/**
 * Local-only mode integration (V3_SPEC §6.0.5): with the toggle on, protocol
 * collections must never reach the write observer — which is the only path
 * into the sync outbox — and protocolSettings itself never syncs at all.
 * Node test against the same in-memory localStorage the adapter suite uses.
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

const compound: Compound = {
  id: "c1",
  name: "Test compound",
  category: "trt",
  form: "injection",
  labelConcentration: 200,
  concentrationUnit: "mg/mL",
  vialVolumeMl: 10,
  halfLifeHours: 192,
  expiryDate: null,
  prescriberNote: "",
  createdAt: "2026-07-05T10:00:00.000Z",
};

const settings = (localOnly: boolean): ProtocolSettings => ({
  enabled: true,
  prescribedConfirmed: true,
  localOnly,
  lockEnabled: false,
  lockCredentialId: null,
});

describe("protocol local-only sync exclusion", () => {
  let observed: string[];

  beforeEach(() => {
    (globalThis as { window?: unknown }).window = { localStorage: fakeLocalStorage() };
    observed = [];
    setWriteObserver((collection) => observed.push(collection));
  });

  afterEach(() => {
    setWriteObserver(null);
    setProtocolLocalOnly(false);
    delete (globalThis as { window?: unknown }).window;
  });

  it("protocolSettings never reaches the observer, even with local-only off", async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.saveProtocolSettings(settings(false));
    expect(observed).not.toContain("protocolSettings");
  });

  it("with local-only ON, protocol collections never enqueue; others still do", async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.saveProtocolSettings(settings(true));
    await adapter.saveCompound(compound);
    await adapter.saveProtocolSchedule({
      id: "s1",
      compoundId: "c1",
      pattern: "daily",
      timeOfDay: "08:00",
      dose: 100,
      doseUnit: "mg",
      startDate: "2026-07-01",
      paused: false,
      resumeDate: null,
    });
    expect(observed.filter((c) => (PROTOCOL_COLLECTIONS as readonly string[]).includes(c))).toEqual([]);
    // Non-protocol writes still observe (the outbox path stays alive).
    await adapter.saveStreak({
      id: "daily",
      current: 1,
      longest: 1,
      freezes: 0,
      lastMetDate: "2026-07-05",
      atRisk: false,
      metToday: true,
      inRepairWindow: false,
      pendingMilestone: null,
      celebratedMilestones: [],
    });
    expect(observed).toContain("streaks");
  });

  it("with local-only OFF, protocol collections sync like everything else", async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.saveProtocolSettings(settings(false));
    await adapter.saveCompound(compound);
    expect(observed).toContain("compounds");
    expect(isSyncExcluded("compounds")).toBe(false);
    expect(isSyncExcluded("protocolSettings")).toBe(true);
  });

  it("the toggle flips the exclusion set both ways", async () => {
    setProtocolLocalOnly(true);
    for (const c of PROTOCOL_COLLECTIONS) expect(isSyncExcluded(c)).toBe(true);
    setProtocolLocalOnly(false);
    for (const c of PROTOCOL_COLLECTIONS) expect(isSyncExcluded(c)).toBe(false);
  });
});
