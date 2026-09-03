/**
 * Brings the club crests into the repo, at the size they are actually shown.
 *
 * Measured before writing this: the landing page pulled 1.9MB of crests from
 * three different hosts on every first visit. They are 512px PNGs and the
 * largest they are ever drawn is 32px on the feed, 64px on the landing ring -
 * so almost all of that was downloaded to be thrown away, over connections the
 * page has no control over and cannot cache well.
 *
 * Served from `public/` instead they cost one round trip to the same origin,
 * come back in the tens of kilobytes, and get the immutable cache header set
 * for `/crests/` in next.config.ts. The filename carries a hash of the source
 * URL, so replacing a crest changes the path and no stale copy can survive.
 *
 *   npm run crests:cache
 *
 * Run it after `npm run crests` changes a badge, and commit what it writes.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import type { Team } from "../lib/types";

/** Twice the largest drawn size, so the crest stays sharp on a 2x screen. */
const EDGE = 128;

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "public", "crests");
const REGISTRY = path.join(ROOT, "data", "teams.json");

async function main() {
  const teams: Team[] = JSON.parse(fs.readFileSync(REGISTRY, "utf8"));
  fs.mkdirSync(OUT, { recursive: true });

  const kept = new Set<string>();
  let saved = 0;
  let before = 0;
  let after = 0;

  for (const team of teams) {
    const src = team.crest;
    if (!src || src.startsWith("/")) {
      if (src) kept.add(path.basename(src));
      continue;
    }

    const res = await fetch(src);
    if (!res.ok) {
      console.warn(`  ${team.slug}: ${res.status} — 원본 주소를 그대로 둡니다`);
      continue;
    }
    const raw = Buffer.from(await res.arrayBuffer());

    // Fit inside the box rather than filling it: crests are all shapes, and a
    // crop would take the top off a shield.
    const png = await sharp(raw)
      .resize(EDGE, EDGE, { fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();

    const stamp = crypto
      .createHash("sha1")
      .update(src)
      .digest("hex")
      .slice(0, 8);
    const name = `${team.slug}-${stamp}.png`;
    fs.writeFileSync(path.join(OUT, name), png);

    team.crest = `/crests/${name}`;
    kept.add(name);
    before += raw.length;
    after += png.length;
    saved++;
    console.log(
      `  ${team.slug.padEnd(16)} ${(raw.length / 1024).toFixed(0).padStart(4)}kB → ${(png.length / 1024).toFixed(1)}kB`,
    );
  }

  // Anything left behind by an earlier run is now unreferenced.
  for (const file of fs.readdirSync(OUT)) {
    if (!kept.has(file)) {
      fs.unlinkSync(path.join(OUT, file));
      console.log(`  지움: ${file}`);
    }
  }

  fs.writeFileSync(REGISTRY, JSON.stringify(teams, null, 2) + "\n");
  console.log(
    `\n${saved}개 저장. ${(before / 1024).toFixed(0)}kB → ${(after / 1024).toFixed(0)}kB`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
