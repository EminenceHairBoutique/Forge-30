import type { SupabaseClient } from "@supabase/supabase-js";
import {
  advanceCursor,
  backoffMs,
  enqueue,
  requeueFailed,
  takeBatch,
  type OutboxEntry,
} from "@/lib/engine/sync";
import { uid } from "@/lib/utils";
import {
  LocalStorageAdapter,
  setWriteObserver,
  snapshotCollections,
  writeCollectionBlob,
} from "./localStorageAdapter";

/**
 * SyncedAdapter (v3 Phase 1): the offline-first cloud-backed StorageAdapter.
 *
 * Extends LocalStorageAdapter, so every read is local and instant and the UI
 * never waits on the network. Writes flow through the local adapter first,
 * are observed at the storage choke points (whole-collection blobs +
 * per-record large-store rows), land in a persisted outbox, and flush to
 * Supabase in the background with retry/backoff. Pulls merge remote changes
 * on start, on regained connectivity, and on app foreground — last-write-
 * wins per row, and a row with a pending unflushed local write always keeps
 * the local version (the outbox will push it).
 *
 * Everything degrades gracefully: no network → outbox waits; sign-out →
 * dispose() detaches and the app continues local-only, byte-for-byte the
 * pre-sync experience.
 */

const OUTBOX_KEY = "forge30:syncOutbox";
const META_KEY = "forge30:syncMeta";
const FLUSH_BATCH = 25;
const FLUSH_DEBOUNCE_MS = 1500;

interface SyncMeta {
  /** Pull cursors (ISO timestamps) per table. */
  blobCursor: string;
  rowCursor: string;
  /** Local last-write time per blob collection — the LWW comparand. */
  blobUpdatedAt: Record<string, string>;
  /** Set once the first-sign-in full push completed ("your data is backed up"). */
  migratedAt?: string;
}

const canUse = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

function readJson<T>(key: string, fallback: T): T {
  if (!canUse()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (!canUse()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota/private-mode failure: sync state stays in memory for the session.
  }
}

export type SyncStatus = "idle" | "syncing" | "offline" | "error";

export class SyncedAdapter extends LocalStorageAdapter {
  private outbox: OutboxEntry[];
  private meta: SyncMeta;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;
  private attempt = 0;
  private suppress = false;
  private disposed = false;
  private onStatus?: (s: SyncStatus) => void;

  constructor(
    private supabase: SupabaseClient,
    private userId: string,
    onStatus?: (s: SyncStatus) => void
  ) {
    super();
    this.onStatus = onStatus;
    this.outbox = readJson<OutboxEntry[]>(OUTBOX_KEY, []);
    this.meta = readJson<SyncMeta>(META_KEY, { blobCursor: "", rowCursor: "", blobUpdatedAt: {} });
  }

  /** Attach observation + listeners, run first-sign-in migration, pull, flush. */
  start(): void {
    setWriteObserver((collection, rowId, value, op) => {
      if (this.suppress) return;
      const updatedAt = new Date().toISOString();
      if (rowId === null) this.meta.blobUpdatedAt[collection] = updatedAt;
      this.outbox = enqueue(this.outbox, {
        id: uid(),
        collection,
        rowId,
        op,
        data: value,
        updatedAt,
      });
      this.persistState();
      this.scheduleFlush();
    });
    if (canUse()) {
      window.addEventListener("online", this.onWake);
      document.addEventListener("visibilitychange", this.onVisible);
    }
    void this.initialSync();
  }

  /** Detach everything; the underlying local adapter keeps working as-is. */
  dispose(): void {
    this.disposed = true;
    setWriteObserver(null);
    if (this.flushTimer) clearTimeout(this.flushTimer);
    if (canUse()) {
      window.removeEventListener("online", this.onWake);
      document.removeEventListener("visibilitychange", this.onVisible);
    }
  }

  /** True once the one-time full local push finished. */
  get backedUp(): boolean {
    return !!this.meta.migratedAt;
  }

  private onWake = () => {
    this.attempt = 0;
    void this.flush();
    void this.pull();
  };

  private onVisible = () => {
    if (document.visibilityState === "visible") this.onWake();
  };

  private persistState(): void {
    writeJson(OUTBOX_KEY, this.outbox);
    writeJson(META_KEY, this.meta);
  }

  private scheduleFlush(delay = FLUSH_DEBOUNCE_MS): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => void this.flush(), delay);
  }

  private async initialSync(): Promise<void> {
    if (!this.meta.migratedAt) await this.migrateLocalToCloud();
    await this.pull();
    await this.flush();
  }

  /**
   * First sign-in: everything already on this device gets enqueued, so the
   * cloud starts as a faithful copy. Idempotent — upserts by natural key.
   */
  private async migrateLocalToCloud(): Promise<void> {
    const now = new Date().toISOString();
    for (const [collection, value] of Object.entries(snapshotCollections())) {
      this.meta.blobUpdatedAt[collection] ??= now;
      this.outbox = enqueue(this.outbox, {
        id: uid(),
        collection,
        rowId: null,
        op: "upsert",
        data: value,
        updatedAt: this.meta.blobUpdatedAt[collection] ?? now,
      });
    }
    const large = await this.large.exportAll();
    for (const [collection, rows] of Object.entries(large)) {
      for (const [rowId, data] of Object.entries(rows)) {
        this.outbox = enqueue(this.outbox, {
          id: uid(),
          collection,
          rowId,
          op: "upsert",
          data,
          updatedAt: now,
        });
      }
    }
    this.meta.migratedAt = now;
    this.persistState();
  }

  /** Push the outbox in bounded batches; failed batches requeue at the front. */
  async flush(): Promise<void> {
    if (this.flushing || this.disposed || this.outbox.length === 0) return;
    if (canUse() && !navigator.onLine) {
      this.onStatus?.("offline");
      return;
    }
    this.flushing = true;
    this.onStatus?.("syncing");
    try {
      while (this.outbox.length > 0 && !this.disposed) {
        const { batch, rest } = takeBatch(this.outbox, FLUSH_BATCH);
        const blobs = batch.filter((e) => e.rowId === null);
        const rows = batch.filter((e) => e.rowId !== null);
        if (blobs.length > 0) {
          const { error } = await this.supabase.from("sync_blobs").upsert(
            blobs.map((e) => ({
              user_id: this.userId,
              collection: e.collection,
              data: e.data,
              updated_at: e.updatedAt,
            })),
            { onConflict: "user_id,collection" }
          );
          if (error) throw error;
        }
        if (rows.length > 0) {
          const { error } = await this.supabase.from("sync_rows").upsert(
            rows.map((e) => ({
              user_id: this.userId,
              collection: e.collection,
              row_id: e.rowId,
              data: e.op === "delete" ? null : e.data,
              deleted: e.op === "delete",
              updated_at: e.updatedAt,
            })),
            { onConflict: "user_id,collection,row_id" }
          );
          if (error) throw error;
        }
        this.outbox = rest;
        this.persistState();
      }
      this.attempt = 0;
      this.onStatus?.("idle");
    } catch {
      // Requeue what we tried; back off and retry. Nothing is lost — the
      // outbox is persisted and re-flushed on the next wake or timer.
      const { batch, rest } = takeBatch(this.outbox, FLUSH_BATCH);
      this.outbox = requeueFailed(rest, batch);
      this.persistState();
      this.onStatus?.("error");
      this.scheduleFlush(backoffMs(this.attempt++));
    } finally {
      this.flushing = false;
    }
  }

  /** Pull rows newer than the cursors and merge, local-pending always winning. */
  async pull(): Promise<void> {
    if (this.disposed) return;
    try {
      const pendingBlobs = new Set(
        this.outbox.filter((e) => e.rowId === null).map((e) => e.collection)
      );
      const pendingRows = new Set(
        this.outbox.filter((e) => e.rowId !== null).map((e) => `${e.collection}:${e.rowId}`)
      );

      const blobQuery = this.supabase
        .from("sync_blobs")
        .select("collection,data,updated_at")
        .eq("user_id", this.userId)
        .order("updated_at", { ascending: true })
        .limit(500);
      const { data: blobRows, error: blobErr } = this.meta.blobCursor
        ? await blobQuery.gt("updated_at", this.meta.blobCursor)
        : await blobQuery;
      if (blobErr) throw blobErr;

      this.suppress = true;
      try {
        for (const row of blobRows ?? []) {
          const collection = row.collection as string;
          const remoteAt = new Date(row.updated_at as string).toISOString();
          if (pendingBlobs.has(collection)) continue;
          const localAt = this.meta.blobUpdatedAt[collection] ?? "";
          if (remoteAt > localAt) {
            writeCollectionBlob(collection, row.data);
            this.meta.blobUpdatedAt[collection] = remoteAt;
          }
        }
      } finally {
        this.suppress = false;
      }
      this.meta.blobCursor = advanceCursor(
        this.meta.blobCursor,
        (blobRows ?? []).map((r) => ({ data: null, updatedAt: new Date(r.updated_at as string).toISOString() }))
      );

      const rowQuery = this.supabase
        .from("sync_rows")
        .select("collection,row_id,data,deleted,updated_at")
        .eq("user_id", this.userId)
        .order("updated_at", { ascending: true })
        .limit(500);
      const { data: largeRows, error: rowErr } = this.meta.rowCursor
        ? await rowQuery.gt("updated_at", this.meta.rowCursor)
        : await rowQuery;
      if (rowErr) throw rowErr;

      this.suppress = true;
      try {
        for (const row of largeRows ?? []) {
          const collection = row.collection as string;
          const rowId = row.row_id as string;
          if (pendingRows.has(`${collection}:${rowId}`)) continue;
          if (row.deleted) await this.large.delete(collection, rowId);
          else await this.large.put(collection, rowId, row.data);
        }
      } finally {
        this.suppress = false;
      }
      this.meta.rowCursor = advanceCursor(
        this.meta.rowCursor,
        (largeRows ?? []).map((r) => ({ data: null, updatedAt: new Date(r.updated_at as string).toISOString() }))
      );
      this.persistState();
    } catch {
      // Pull failures are silent: local data is authoritative until the next
      // successful pull; nothing in the UI blocks on this.
      this.onStatus?.("error");
    }
  }
}
