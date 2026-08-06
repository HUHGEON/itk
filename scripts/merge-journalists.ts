/**
 * Merges the per-tier registry files into data/journalists.json.
 *
 * The source list has the same person in more than one tier (Jason Burt, Manu
 * Sainz) and near-duplicate transliterations of one name. We key on the English
 * name and keep the best tier, since that's the one the reader cares about.
 */
import fs from "node:fs";
import path from "node:path";
import { slugify } from "../lib/registry";
import type { Journalist } from "../lib/types";

const DATA = path.join(process.cwd(), "data");
const FILES = [
  "journalists-tier0.json",
  "journalists-tier1.json",
  "journalists-tier15.json",
  "journalists-tier2.json",
  "journalists-tier3.json",
];

type Incoming = Omit<Journalist, "id" | "active">;

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
  fs.writeFileSync(path.join(DATA, "journalists.json"), JSON.stringify(merged, null, 2) + "\n");

  const lowConf = merged.filter((j) => j.confidence === "low");
  const noX = merged.filter((j) => !j.x);

  console.log(`✓ ${read}건 읽어 ${merged.length}명으로 병합 (중복 ${collisions.length}건)`);
  for (const c of collisions) console.log(`  · ${c}`);
  console.log(`\n확인 필요: 저신뢰 매핑 ${lowConf.length}명, X 핸들 미상 ${noX.length}명`);
  for (const j of lowConf) console.log(`  ? ${j.ko} → ${j.en} (${j.note ?? ""})`);
}

main();
