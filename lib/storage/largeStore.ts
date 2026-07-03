/**
 * Large-record storage — IndexedDB with a localStorage fallback.
 *
 * localStorage caps out around ~5MB; journal bodies, voice-journal audio
 * blobs, and assessment banks/results (expansion plan E6/E10) would blow
 * through it. This module gives the StorageAdapter a second backend for
 * those collections *before* they exist, per the expansion plan's storage
 * chain: heavy collections never touch localStorage.
 *
 * Shape: one IndexedDB database (`forge30-large`) with a single object
 * store; keys are `<collection>:<recordId>`. The API is deliberately small —
 * record-level get/put/delete plus per-collection listing — because the
 * StorageAdapter keeps owning domain semantics; this is plumbing, not a
 * second adapter surface. UI code never imports this module.
 */

const DB_NAME = "forge30-large";
const STORE = "records";
const DB_VERSION = 1;

export interface LargeStore {
  get<T>(collection: string, id: string): Promise<T | undefined>;
  put(collection: string, id: string, value: unknown): Promise<void>;
  delete(collection: string, id: string): Promise<void>;
  /** All records in a collection, keyed by record id. */
  list<T>(collection: string): Promise<Record<string, T>>;
  /** Removes every record in a collection. */
  clear(collection: string): Promise<void>;
  /** Every record across all collections — feeds export. */
  exportAll(): Promise<Record<string, Record<string, unknown>>>;
  /** Replaces all collections with the given snapshot — feeds import. */
  importAll(data: Record<string, Record<string, unknown>>): Promise<void>;
}

const keyOf = (collection: string, id: string) => `${collection}:${id}`;

// ---------------------------------------------------------------------------
// IndexedDB implementation
// ---------------------------------------------------------------------------

export function idbAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined";
  } catch {
    return false;
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

function tx<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = run(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

export class IdbLargeStore implements LargeStore {
  private db: Promise<IDBDatabase> | null = null;

  private ready(): Promise<IDBDatabase> {
    if (!this.db) this.db = openDb();
    return this.db;
  }

  async get<T>(collection: string, id: string): Promise<T | undefined> {
    const db = await this.ready();
    return tx<T | undefined>(db, "readonly", (s) => s.get(keyOf(collection, id)) as IDBRequest<T | undefined>);
  }

  async put(collection: string, id: string, value: unknown): Promise<void> {
    const db = await this.ready();
    await tx(db, "readwrite", (s) => s.put(value, keyOf(collection, id)));
  }

  async delete(collection: string, id: string): Promise<void> {
    const db = await this.ready();
    await tx(db, "readwrite", (s) => s.delete(keyOf(collection, id)));
  }

  private async entries(prefix?: string): Promise<[string, unknown][]> {
    const db = await this.ready();
    const range = prefix
      ? IDBKeyRange.bound(`${prefix}:`, `${prefix}:￿`)
      : undefined;
    const [keys, values] = await Promise.all([
      tx<IDBValidKey[]>(db, "readonly", (s) => s.getAllKeys(range)),
      tx<unknown[]>(db, "readonly", (s) => s.getAll(range)),
    ]);
    return keys.map((k, i) => [String(k), values[i]]);
  }

  async list<T>(collection: string): Promise<Record<string, T>> {
    const out: Record<string, T> = {};
    for (const [key, value] of await this.entries(collection)) {
      out[key.slice(collection.length + 1)] = value as T;
    }
    return out;
  }

  async clear(collection: string): Promise<void> {
    const db = await this.ready();
    const range = IDBKeyRange.bound(`${collection}:`, `${collection}:￿`);
    await tx(db, "readwrite", (s) => s.delete(range));
  }

  async exportAll(): Promise<Record<string, Record<string, unknown>>> {
    const out: Record<string, Record<string, unknown>> = {};
    for (const [key, value] of await this.entries()) {
      const sep = key.indexOf(":");
      if (sep < 0) continue;
      const collection = key.slice(0, sep);
      (out[collection] ??= {})[key.slice(sep + 1)] = value;
    }
    return out;
  }

  async importAll(data: Record<string, Record<string, unknown>>): Promise<void> {
    const db = await this.ready();
    await tx(db, "readwrite", (s) => s.clear());
    for (const [collection, records] of Object.entries(data)) {
      for (const [id, value] of Object.entries(records)) {
        await tx(db, "readwrite", (s) => s.put(value, keyOf(collection, id)));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// localStorage fallback (private mode / very old browsers) — small data only,
// but a degraded app beats a broken one. Keys: `forge30-large:<coll>:<id>`.
// ---------------------------------------------------------------------------

const LS_PREFIX = "forge30-large";

export class LocalStorageLargeStore implements LargeStore {
  private ls(): Storage | null {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
      ? window.localStorage
      : null;
  }

  private keysFor(collection?: string): string[] {
    const ls = this.ls();
    if (!ls) return [];
    const prefix = collection ? `${LS_PREFIX}:${collection}:` : `${LS_PREFIX}:`;
    const keys: string[] = [];
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k?.startsWith(prefix)) keys.push(k);
    }
    return keys;
  }

  async get<T>(collection: string, id: string): Promise<T | undefined> {
    const raw = this.ls()?.getItem(`${LS_PREFIX}:${keyOf(collection, id)}`);
    if (raw == null) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  async put(collection: string, id: string, value: unknown): Promise<void> {
    try {
      this.ls()?.setItem(`${LS_PREFIX}:${keyOf(collection, id)}`, JSON.stringify(value));
    } catch {
      // Quota — fallback store drops rather than crashes.
    }
  }

  async delete(collection: string, id: string): Promise<void> {
    this.ls()?.removeItem(`${LS_PREFIX}:${keyOf(collection, id)}`);
  }

  async list<T>(collection: string): Promise<Record<string, T>> {
    const out: Record<string, T> = {};
    const prefix = `${LS_PREFIX}:${collection}:`;
    for (const key of this.keysFor(collection)) {
      const raw = this.ls()?.getItem(key);
      if (raw == null) continue;
      try {
        out[key.slice(prefix.length)] = JSON.parse(raw) as T;
      } catch {
        // skip corrupted record
      }
    }
    return out;
  }

  async clear(collection: string): Promise<void> {
    for (const key of this.keysFor(collection)) this.ls()?.removeItem(key);
  }

  async exportAll(): Promise<Record<string, Record<string, unknown>>> {
    const out: Record<string, Record<string, unknown>> = {};
    for (const key of this.keysFor()) {
      const rest = key.slice(LS_PREFIX.length + 1);
      const sep = rest.indexOf(":");
      if (sep < 0) continue;
      const raw = this.ls()?.getItem(key);
      if (raw == null) continue;
      try {
        (out[rest.slice(0, sep)] ??= {})[rest.slice(sep + 1)] = JSON.parse(raw);
      } catch {
        // skip corrupted record
      }
    }
    return out;
  }

  async importAll(data: Record<string, Record<string, unknown>>): Promise<void> {
    for (const key of this.keysFor()) this.ls()?.removeItem(key);
    for (const [collection, records] of Object.entries(data)) {
      for (const [id, value] of Object.entries(records)) {
        await this.put(collection, id, value);
      }
    }
  }
}

/** Feature-detected store: IndexedDB where available, localStorage otherwise. */
export function createLargeStore(): LargeStore {
  return idbAvailable() ? new IdbLargeStore() : new LocalStorageLargeStore();
}
