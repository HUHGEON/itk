/**
 * Bakes the ball's three maps into files.
 *
 *   npm run ball:bake
 *
 * The markings are the same on every visit, so computing them in the browser
 * spends about 100ms of every reader's main thread reproducing a fixed result.
 * Written out once they cost a download instead - measured at roughly 110kB as
 * WebP against 700kB as PNG, which is why this does not use PNG.
 *
 * Run it after changing anything in `ball-pattern.ts`, and commit what it
 * writes. If the files are missing the renderer falls back to computing them,
 * so a stale checkout still draws the right ball.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { computeBallMaps } from "../components/landing/ball-pattern";

const OUT = path.join(__dirname, "..", "public", "ball");

async function main() {
  const t0 = Date.now();
  const maps = computeBallMaps(1024);
  const computed = Date.now() - t0;
  fs.mkdirSync(OUT, { recursive: true });

  const write = async (
    name: string,
    data: Uint8ClampedArray<ArrayBuffer>,
    quality: number,
  ) => {
    const file = path.join(OUT, `${name}.webp`);
    await sharp(Buffer.from(data.buffer), {
      raw: { width: maps.width, height: maps.height, channels: 4 },
    })
      // Alpha carries nothing here and only costs bytes.
      .removeAlpha()
      .webp({ quality, effort: 6 })
      .toFile(file);
    return { name, kb: Math.round(fs.statSync(file).size / 1024) };
  };

  const written = [
    // The colour map is flat regions and compresses well; the relief map is
    // leather grain, which is noise, so it needs the higher setting to keep
    // the bump from going smooth.
    await write("albedo", maps.albedo, 90),
    await write("surface", maps.surface, 88),
    await write("relief", maps.relief, 94),
  ];

  const total = written.reduce((n, w) => n + w.kb, 0);
  console.log(`계산 ${computed}ms · ${maps.width}x${maps.height}`);
  for (const w of written) console.log(`  ${w.name.padEnd(8)} ${w.kb}kB`);
  console.log(`  합계     ${total}kB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
