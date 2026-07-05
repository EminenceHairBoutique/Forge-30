import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Stamp the service worker version at build time (v3.3 §1.4). Runs as npm
 * prebuild: public/sw.template.js → public/sw.js with VERSION set to the
 * git SHA + minute-resolution timestamp, so every deploy invalidates the
 * shell cache exactly once and installed apps stop serving stale shells.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

let sha = "nogit";
try {
  sha = execSync("git rev-parse --short HEAD", { cwd: root }).toString().trim();
} catch {
  // Building outside a git checkout (e.g. a tarball deploy) still versions
  // by timestamp below.
}
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
const version = `forge30-${sha}-${stamp}`;

const template = readFileSync(join(root, "public/sw.template.js"), "utf8");
if (!template.includes("__SW_VERSION__")) {
  console.error("sw.template.js is missing the __SW_VERSION__ placeholder");
  process.exit(1);
}
const banner = "/* GENERATED from public/sw.template.js by scripts/generate-sw.mjs — do not edit. */\n";
writeFileSync(join(root, "public/sw.js"), banner + template.replace("__SW_VERSION__", version));
console.log(`sw.js stamped ${version}`);
