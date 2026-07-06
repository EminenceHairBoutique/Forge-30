import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Server-only env guard (v3.3 §1.5): the service-role key must never gain a
 * NEXT_PUBLIC_ prefix and must only ever be read from server-side modules
 * (lib/server/**, app/api/**) — never from client code.
 */

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components", "lib"];
const SERVER_ONLY_VARS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "VAPID_PRIVATE_KEY",
  "CRON_SECRET",
  "ANTHROPIC_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const files = SCAN_DIRS.flatMap((d) => sourceFiles(join(ROOT, d)));

describe("server-only env guard", () => {
  it("scans a real source tree", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("no server-only var ever appears with a NEXT_PUBLIC_ prefix", () => {
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const v of SERVER_ONLY_VARS) {
        expect(
          text.includes(`NEXT_PUBLIC_${v}`),
          `${relative(ROOT, file)} exposes ${v} as NEXT_PUBLIC_`
        ).toBe(false);
      }
    }
  });

  it("server-only vars are read only under lib/server/ or app/api/", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      if (rel.startsWith("lib/server/") || rel.startsWith("app/api/")) continue;
      const text = readFileSync(file, "utf8");
      for (const v of SERVER_ONLY_VARS) {
        // Actual reads only — prose mentions in doc comments are fine.
        if (text.includes(`process.env.${v}`) || text.includes(`env["${v}"]`)) {
          offenders.push(`${rel} reads ${v}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
