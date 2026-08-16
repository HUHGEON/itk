/**
 * Merges the per-tier registry files into data/journalists.json.
 *
 * The source list has the same person in more than one tier (Jason Burt, Manu
 * Sainz) and near-duplicate transliterations of one name. We key on the English
 * name and keep the best tier, since that's the one the reader cares about.
 *
 *   npm run merge
 *   npm run merge -- --force    보강 정보가 사라지는 병합을 강행
 *
 * The tier files are a hand-kept list of who exists. Everything a script or a
 * later edit discovered about them — Bluesky handles, direct feeds — lives only
 * in the merged file, so a plain rewrite from the tier files would throw all of
 * it away. Those fields are carried across instead.
 */
import fs from "node:fs";
import path from "node:path";
import { slugify } from "../lib/registry";
import type { Journalist } from "../lib/types";

const DATA = path.join(process.cwd(), "data");
const OUT = path.join(DATA, "journalists.json");
const FILES = [
  "journalists-tier0.json",
  "journalists-tier1.json",
  "journalists-tier15.json",
  "journalists-tier2.json",
  "journalists-tier3.json",
];

type Incoming = Omit<Journalist, "id" | "active">;

/**
 * Fields the tier files do not carry, so the merged file is their only home.
 *
 * `bluesky`/`blueskyMirror` come from scripts/discover-bluesky.ts and from
 * hand-verified mirrors; `feeds` are author feeds found one at a time; `active`
 * is a manual switch. Re-deriving any of them costs an afternoon.
 */
const CARRIED = [
  "bluesky",
  "blueskyMirror",
  "feeds",
  "active",
] as const satisfies readonly (keyof Journalist)[];

function readExisting(): Map<string, Journalist> {
  if (!fs.existsSync(OUT)) return new Map();
  try {
    const rows = JSON.parse(fs.readFileSync(OUT, "utf8")) as Journalist[];
    return new Map(rows.map((j) => [j.id, j]));
  } catch (err) {
    // A corrupt merged file must not silently become an empty one — that is the
    // exact wipe this function exists to prevent.
    throw new Error(
      `${OUT} 를 읽을 수 없습니다. 병합하면 보강 정보가 사라집니다: ` +
        (err instanceof Error ? err.message : String(err)),
    );
  }
}

/** True when this entry holds something the tier files could not rebuild. */
function enriched(j: Journalist | undefined): boolean {
  if (!j) return false;
  return Boolean(j.bluesky || j.feeds?.length || j.active === false);
}

function main() {
  const byId = new Map<string, Journalist>();
  const collisions: string[] = [];
  let read = 0;

  for (const file of FILES) {
    const p = path.join(DATA, file);
    if (!fs.existsSync(p)) {
      console.warn(`⚠  ${file} 없음 — 건너뜁니다`);
      continue;
    }
    const entries = JSON.parse(fs.readFileSync(p, "utf8")) as Incoming[];
    read += entries.length;

    for (const e of entries) {
      const id = slugify(e.en);
      if (!id) {
        console.warn(`⚠  영문명이 비어 있어 건너뜀: ${e.ko}`);
        continue;
      }
      const existing = byId.get(id);
      if (existing) {
        collisions.push(`${e.en} (${existing.tier}티어 유지, ${e.tier}티어 중복)`);
        // Keep the better (numerically lower) tier, but union the beats.
        if (e.tier < existing.tier) {
          byId.set(id, {
            ...e,
            id,
            active: true,
            teams: [...new Set([...existing.teams, ...e.teams])],
          });
        } else {
          existing.teams = [...new Set([...existing.teams, ...e.teams])];
        }
        continue;
      }
      byId.set(id, { ...e, id, active: true });
    }
  }

  const merged = [...byId.values()].sort((a, b) => a.tier - b.tier || a.en.localeCompare(b.en));

  // Put back what the tier files never knew.
  const existing = readExisting();
  const carried: string[] = [];
  for (const j of merged) {
    const was = existing.get(j.id);
    if (!was) continue;
    const kept: string[] = [];
    for (const key of CARRIED) {
      const value = was[key];
      if (value === undefined) continue;
      Object.assign(j, { [key]: value });
      if (key !== "active") kept.push(key);
    }
    // The tier list carries a note for most people; only fill in from the old
    // file when it has nothing to say, so a corrected note still wins.
    if (!j.note && was.note) {
      j.note = was.note;
      kept.push("note");
    }
    if (kept.length > 0) carried.push(`${j.ko}(${kept.join(", ")})`);
  }

  // Someone who fell out of the tier files takes their Bluesky handle with
  // them, and nothing downstream would ever say so.
  const orphans = [...existing.values()].filter(
    (j) => enriched(j) && !byId.has(j.id),
  );
  if (orphans.length > 0 && !process.argv.includes("--force")) {
    console.error(
      `\n✗ 티어 파일에서 사라진 기자 ${orphans.length}명이 보강 정보를 갖고 있습니다.\n` +
        `  병합하면 되살릴 수 없습니다. 의도한 삭제라면 --force 를 붙이세요.`,
    );
    for (const j of orphans) {
      const what = [
        j.bluesky ? `bluesky=${j.bluesky}` : null,
        j.feeds?.length ? `feeds=${j.feeds.length}` : null,
        j.active === false ? "active=false" : null,
      ].filter(Boolean);
      console.error(`  · ${j.ko} (${j.en}) — ${what.join(" · ")}`);
    }
    process.exitCode = 1;
    return;
  }

  fs.writeFileSync(OUT, JSON.stringify(merged, null, 2) + "\n");

  const lowConf = merged.filter((j) => j.confidence === "low");
  const noX = merged.filter((j) => !j.x);

  console.log(`✓ ${read}건 읽어 ${merged.length}명으로 병합 (중복 ${collisions.length}건)`);
  for (const c of collisions) console.log(`  · ${c}`);
  console.log(`  보강 정보 이어받음: ${carried.length}명`);
  if (orphans.length > 0)
    console.log(`  ⚠ --force 로 ${orphans.length}명의 보강 정보를 버렸습니다.`);
  console.log(`\n확인 필요: 저신뢰 매핑 ${lowConf.length}명, X 핸들 미상 ${noX.length}명`);
  for (const j of lowConf) console.log(`  ? ${j.ko} → ${j.en} (${j.note ?? ""})`);
}

main();
