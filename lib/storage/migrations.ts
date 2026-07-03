/**
 * Schema versioning for Forge30's persisted data.
 *
 * Pure module — no window/localStorage access — so migrations are unit-tested
 * in Node against fixtures of real user data. The adapter
 * (localStorageAdapter.ts) owns reading/writing the browser; this module owns
 * the shape of what's stored.
 *
 * Rules (CLAUDE.md #6): never delete or reshape a persisted type without a
 * numbered migration step here, plus a fixture test in migrations.test.ts
 * proving existing data survives.
 */

/** Bump this whenever a persisted shape changes, and add a MIGRATIONS step. */
export const SCHEMA_VERSION = 1;

export const VERSION_KEY = "forge30:schemaVersion";

/** Snapshot of every persisted collection, keyed by collection name. */
export type CollectionSnapshot = Record<string, unknown>;

export interface ExportFile {
  app: "forge30";
  schemaVersion: number;
  exportedAt: string;
  collections: CollectionSnapshot;
  /**
   * Large-record collections (IndexedDB-backed — see largeStore.ts), keyed
   * collection → recordId → record. Optional/additive: pre-E1 exports don't
   * have it, and an absent block imports as "no large data".
   */
  large?: Record<string, Record<string, unknown>>;
}

/**
 * Sequential migration steps: `MIGRATIONS[n]` transforms a snapshot from
 * schema version n to n+1. Version 1 is the v1 launch shape, so the table is
 * empty today — future phases append steps (2: universal profile fields,
 * 3: expenditure fields, …) without ever editing shipped ones.
 *
 * Steps MUST be idempotent: if a run is interrupted after writing some
 * collections but before the version stamp, the next load retries from the
 * old version, so re-applying a step to already-migrated data must be a
 * no-op (e.g. "add field if missing", never "rename blindly").
 */
const MIGRATIONS: Record<number, (c: CollectionSnapshot) => CollectionSnapshot> = {};

export class UnsupportedSchemaError extends Error {
  constructor(found: number) {
    super(
      `This data was created by a newer version of Forge30 (schema ${found}, this app supports ${SCHEMA_VERSION}). Update the app before importing.`
    );
    this.name = "UnsupportedSchemaError";
  }
}

/**
 * Runs every step from `fromVersion` up to SCHEMA_VERSION. Identity when
 * already current. Throws UnsupportedSchemaError for future versions —
 * downgrading data is never attempted.
 */
export function runMigrations(
  collections: CollectionSnapshot,
  fromVersion: number
): { collections: CollectionSnapshot; version: number } {
  if (fromVersion > SCHEMA_VERSION) throw new UnsupportedSchemaError(fromVersion);
  let current = collections;
  for (let v = fromVersion; v < SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (step) current = step(current);
  }
  return { collections: current, version: SCHEMA_VERSION };
}

/** Builds the export payload (the adapter supplies the snapshots). */
export function buildExport(
  collections: CollectionSnapshot,
  exportedAt: string,
  large?: Record<string, Record<string, unknown>>
): ExportFile {
  const file: ExportFile = { app: "forge30", schemaVersion: SCHEMA_VERSION, exportedAt, collections };
  if (large && Object.keys(large).length > 0) file.large = large;
  return file;
}

/**
 * Validates a parsed import payload. Throws with a user-readable message on
 * anything malformed; throws UnsupportedSchemaError when the file comes from
 * a newer app version.
 */
export function validateExport(raw: unknown): ExportFile {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("That file isn't a Forge30 export.");
  }
  const candidate = raw as Partial<ExportFile>;
  if (candidate.app !== "forge30") {
    throw new Error("That file isn't a Forge30 export.");
  }
  if (typeof candidate.schemaVersion !== "number" || !Number.isInteger(candidate.schemaVersion) || candidate.schemaVersion < 1) {
    throw new Error("This export file has no valid schema version.");
  }
  if (candidate.schemaVersion > SCHEMA_VERSION) {
    throw new UnsupportedSchemaError(candidate.schemaVersion);
  }
  if (typeof candidate.collections !== "object" || candidate.collections === null || Array.isArray(candidate.collections)) {
    throw new Error("This export file has no data collections.");
  }
  const file: ExportFile = {
    app: "forge30",
    schemaVersion: candidate.schemaVersion,
    exportedAt: typeof candidate.exportedAt === "string" ? candidate.exportedAt : "",
    collections: candidate.collections as CollectionSnapshot,
  };
  if (
    typeof candidate.large === "object" &&
    candidate.large !== null &&
    !Array.isArray(candidate.large)
  ) {
    file.large = candidate.large as ExportFile["large"];
  }
  return file;
}
