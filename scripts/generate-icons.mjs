/**
 * Generates the full PWA icon set from an inline SVG mark.
 * Run: npm run icons  (outputs to public/icons/, committed to the repo)
 */
import sharp from "sharp";
import { mkdir } from "fs/promises";
import path from "path";

const OUT = path.resolve(process.cwd(), "public/icons");

// The Forge30 mark: gold "F" over a "30" baseline on matte black, with a
// subtle gold ring echoing the Forge Score ring on the Today screen.
// `pad` insets the artwork for maskable variants (safe zone ≈ 80%).
function markSvg(size, { pad = 0 } = {}) {
  const s = size;
  const c = s / 2;
  const scale = 1 - pad * 2;
  const ringR = c * 0.82 * scale;
  const fSize = s * 0.42 * scale;
  const numSize = s * 0.17 * scale;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${s}" height="${s}" fill="#0A0A0B"/>
  <circle cx="${c}" cy="${c}" r="${ringR}" fill="none" stroke="#C9A961" stroke-width="${s * 0.028 * scale}" opacity="0.55"/>
  <text x="${c}" y="${c + fSize * 0.18}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="bold" font-size="${fSize}" fill="#F5F1E8">F</text>
  <text x="${c}" y="${c + ringR * 0.62}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="bold" font-size="${numSize}" fill="#C9A961">30</text>
</svg>`;
}

async function render(name, size, opts) {
  const svg = Buffer.from(markSvg(size, opts));
  await sharp(svg).png().toFile(path.join(OUT, name));
  console.log(`✓ ${name} (${size}×${size})`);
}

await mkdir(OUT, { recursive: true });
await render("icon-192.png", 192);
await render("icon-512.png", 512);
await render("icon-maskable-192.png", 192, { pad: 0.1 });
await render("icon-maskable-512.png", 512, { pad: 0.1 });
await render("apple-touch-icon.png", 180);
console.log("Icon set written to public/icons/");
