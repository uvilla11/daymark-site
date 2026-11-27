// Turns a folder of raw captures (PNG, named like the site assets) into the
// WebP files the site serves. Phone 920x2000, iPad 1600x1200, Daylight 540x1174.
// usage: node scripts/import-captures.mjs <folder-of-pngs>
import { readdir } from "node:fs/promises";
import { basename, resolve } from "node:path";
import sharp from "sharp";

const DAYLIGHT = new Set(["predawn", "dawn", "parchment", "dusk", "nightfall", "night"]);
const folder = process.argv[2];
if (!folder) throw new Error("usage: node scripts/import-captures.mjs <folder-of-pngs>");
const assets = resolve(import.meta.dirname, "..", "src", "assets");

for (const file of (await readdir(folder)).filter(name => name.endsWith(".png")).sort()) {
  const name = basename(file, ".png");
  const [width, height] = name.startsWith("ipad-") ? [1600, 1200] : DAYLIGHT.has(name) ? [540, 1174] : [920, 2000];
  // cover: the captures share these aspect ratios to within a few pixels.
  await sharp(resolve(folder, file)).resize(width, height, { fit: "cover", position: "top" })
    .webp({ quality: 86 }).toFile(resolve(assets, `${name}.webp`));
  console.log(`${name}.webp ${width}x${height}`);
}
