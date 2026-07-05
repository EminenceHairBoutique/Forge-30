import { describe, expect, it } from "vitest";
import {
  advanceCursor,
  backoffMs,
  enqueue,
  mergePull,
  pickWinner,
  requeueFailed,
  takeBatch,
  type OutboxEntry,
  type SyncRow,
} from "./sync";

const entry = (over: Partial<OutboxEntry>): OutboxEntry => ({
  id: over.id ?? "e1",
  collection: over.collection ?? "meals",
  rowId: over.rowId ?? null,
  op: over.op ?? "upsert",
  data: over.data ?? { v: 1 },
  updatedAt: over.updatedAt ?? "2026-07-05T10:00:00.000Z",
});

describe("outbox enqueue", () => {
  it("dedupes per (collection,rowId) last-write-wins, newest at the end", () => {
    let box: OutboxEntry[] = [];
    box = enqueue(box, entry({ id: "a", collection: "meals", data: { v: 1 } }));
    box = enqueue(box, entry({ id: "b", collection: "workouts" }));
    box = enqueue(box, entry({ id: "c", collection: "meals", data: { v: 2 } }));
    expect(box).toHaveLength(2);
    expect(box[0]?.collection).toBe("workouts");
    expect(box[1]?.id).toBe("c");
    expect(box[1]?.data).toEqual({ v: 2 });
  });

  it("treats different rowIds in one collection as distinct rows", () => {
    let box: OutboxEntry[] = [];
    box = enqueue(box, entry({ id: "a", collection: "journalNotes", rowId: "n1" }));
    box = enqueue(box, entry({ id: "b", collection: "journalNotes", rowId: "n2" }));
    expect(box).toHaveLength(2);
  });

  it("a blob row (null) and a record row ('') never collide", () => {
    let box: OutboxEntry[] = [];
    box = enqueue(box, entry({ id: "a", collection: "meals", rowId: null }));
    box = enqueue(box, entry({ id: "b", collection: "meals", rowId: "x" }));
    expect(box).toHaveLength(2);
  });
});

describe("batching + partial-flush recovery", () => {
  const three = [
    entry({ id: "a", collection: "c1" }),
    entry({ id: "b", collection: "c2" }),
    entry({ id: "c", collection: "c3" }),
  ];

  it("takes a bounded batch preserving order", () => {
    const { batch, rest } = takeBatch(three, 2);
    expect(batch.map((e) => e.id)).toEqual(["a", "b"]);
    expect(rest.map((e) => e.id)).toEqual(["c"]);
  });

  it("requeues failed entries at the front", () => {
    const { batch, rest } = takeBatch(three, 2);
    const requeued = requeueFailed(rest, batch);
    expect(requeued.map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  it("drops a failed entry when a newer write for the row superseded it", () => {
    const { batch, rest } = takeBatch(three, 2);
    const newer = enqueue(rest, entry({ id: "a2", collection: "c1", data: { v: 9 } }));
    const requeued = requeueFailed(newer, batch);
    expect(requeued.map((e) => e.id)).toEqual(["b", "c", "a2"]);
  });
});

describe("last-write-wins merge", () => {
  const at = (t: string, v: number): SyncRow => ({ data: { v }, updatedAt: t });

  it("strictly-newer remote wins; ties and older keep local", () => {
    expect(pickWinner(at("2026-07-01T00:00:00Z", 1), at("2026-07-02T00:00:00Z", 2))).toBe("remote");
    expect(pickWinner(at("2026-07-02T00:00:00Z", 1), at("2026-07-02T00:00:00Z", 2))).toBe("local");
    expect(pickWinner(at("2026-07-03T00:00:00Z", 1), at("2026-07-02T00:00:00Z", 2))).toBe("local");
    expect(pickWinner(null, at("2026-07-02T00:00:00Z", 2))).toBe("remote");
  });

  it("mergePull applies only remote-wins rows and never touches pending local writes", () => {
    const local = new Map<string, SyncRow>([
      ["meals ", at("2026-07-01T00:00:00Z", 1)],
      ["workouts ", at("2026-07-05T00:00:00Z", 1)],
    ]);
    const remote = new Map<string, SyncRow>([
      ["meals ", at("2026-07-02T00:00:00Z", 2)], // newer → apply
      ["workouts ", at("2026-07-04T00:00:00Z", 2)], // older → skip
      ["journals ", at("2026-07-03T00:00:00Z", 2)], // absent locally → apply
      ["streaks ", at("2026-07-09T00:00:00Z", 2)], // pending local write → skip
    ]);
    const toApply = mergePull(local, remote, new Set(["streaks "]));
    expect([...toApply.keys()].sort()).toEqual(["journals ", "meals "]);
  });
});

describe("cursor + backoff", () => {
  it("advances the pull cursor to the newest pulled row", () => {
    const rows: SyncRow[] = [
      { data: 1, updatedAt: "2026-07-02T00:00:00Z" },
      { data: 2, updatedAt: "2026-07-04T00:00:00Z" },
    ];
    expect(advanceCursor("2026-07-03T00:00:00Z", rows)).toBe("2026-07-04T00:00:00Z");
    expect(advanceCursor("2026-07-05T00:00:00Z", rows)).toBe("2026-07-05T00:00:00Z");
    expect(advanceCursor("", [])).toBe("");
  });

  it("backoff doubles from 2s and caps at 5 minutes", () => {
    expect(backoffMs(0)).toBe(2000);
    expect(backoffMs(1)).toBe(4000);
    expect(backoffMs(3)).toBe(16000);
    expect(backoffMs(20)).toBe(300_000);
  });
});
