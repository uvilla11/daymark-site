// Makes a 600px-wide copy of each 920px phone capture, so 1x and 2x screens can
// skip the full file. Run after replacing screenshots; the build picks them up.
import { readdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const assets = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src", "assets");
let made = 0;
for (const name of await readdir(assets)) {
  if (!name.endsWith(".webp") || name.endsWith("-600.webp")) continue;
  const { width } = await sharp(resolve(assets, name)).metadata();
  if (width !== 920) continue;
  await sharp(resolve(assets, name)).resize({ width: 600 }).webp({ quality: 80 }).toFile(resolve(assets, name.replace(/\.webp$/, "-600.webp")));
  made++;
}
console.log(`Made ${made} 600px copies.`);
