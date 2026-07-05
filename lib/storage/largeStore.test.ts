import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import {
  IdbLargeStore,
  LocalStorageLargeStore,
  createLargeStore,
  idbAvailable,
  type LargeStore,
} from "./largeStore";

/**
 * The same contract, run against both backends — heavy collections (journal
 * bodies, audio, assessment banks) must behave identically whichever store
 * the runtime feature-detects.
 */
function contractTests(name: string, make: () => LargeStore) {
  describe(`${name} contract`, () => {
    let store: LargeStore;

    beforeEach(() => {
      store = make();
    });

    it("round-trips records per collection", async () => {
      await store.put("journal", "j1", { body: "long text…", tags: ["stress"] });
      await store.put("journal", "j2", { body: "second", tags: [] });
      await store.put("assessments", "bigfive-1", { answers: [1, 2, 3] });

      expect(await store.get("journal", "j1")).toEqual({ body: "long text…", tags: ["stress"] });
      expect(await store.get("journal", "missing")).toBeUndefined();
      expect(Object.keys(await store.list("journal")).sort()).toEqual(["j1", "j2"]);
      // Collections are isolated — no prefix bleed.
      expect(Object.keys(await store.list("assessments"))).toEqual(["bigfive-1"]);
      expect(await store.list("journalx")).toEqual({});
    });

    it("deletes records and clears whole collections", async () => {
      await store.put("journal", "j1", { body: "a" });
      await store.put("journal", "j2", { body: "b" });
      await store.put("audio", "a1", { bytes: "…" });

      await store.delete("journal", "j1");
      expect(await store.get("journal", "j1")).toBeUndefined();

      await store.clear("journal");
      expect(await store.list("journal")).toEqual({});
      // Other collections untouched.
      expect(Object.keys(await store.list("audio"))).toEqual(["a1"]);
    });

    it("export → import round-trips everything and replaces prior contents", async () => {
      await store.put("journal", "j1", { body: "keep" });
      await store.put("audio", "a1", { bytes: "xyz" });
      const dump = await store.exportAll();
      expect(dump).toEqual({ journal: { j1: { body: "keep" } }, audio: { a1: { bytes: "xyz" } } });

      const fresh = make();
      await fresh.put("journal", "stray", { body: "pre-import leftovers" });
      await fresh.importAll(dump);
      expect(await fresh.list("journal")).toEqual({ j1: { body: "keep" } });
      expect(await fresh.get("audio", "a1")).toEqual({ bytes: "xyz" });
    });
  });
}

describe("IdbLargeStore (fake-indexeddb)", () => {
  beforeEach(() => {
    // Fresh IDB universe per test file section.
    globalThis.indexedDB = new IDBFactory();
  });

  contractTests("IdbLargeStore", () => new IdbLargeStore());

  it("is selected by createLargeStore when indexedDB exists", () => {
    expect(idbAvailable()).toBe(true);
    expect(createLargeStore()).toBeInstanceOf(IdbLargeStore);
  });
});

describe("LocalStorageLargeStore (fallback)", () => {
  const backing = new Map<string, string>();

  beforeEach(() => {
    backing.clear();
    (globalThis as Record<string, unknown>).window = {
      localStorage: {
        getItem: (k: string) => (backing.has(k) ? backing.get(k)! : null),
        setItem: (k: string, v: string) => void backing.set(k, String(v)),
        removeItem: (k: string) => void backing.delete(k),
        key: (i: number) => [...backing.keys()][i] ?? null,
        get length() {
          return backing.size;
        },
      },
    };
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).window;
  });

  contractTests("LocalStorageLargeStore", () => new LocalStorageLargeStore());
});
