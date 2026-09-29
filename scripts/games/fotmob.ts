import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * The same keyless JSON the match pages already read, cached on disk for the
 * build so a rerun costs nothing. Squads are the reason this exists: shirt
 * numbers are on 0% of Wikidata's current memberships (measured across the big
 * five leagues), and Wikidata's idea of "current club" is whatever nobody has
 * closed yet — 1,516 "current" Premier League players, against ~500 real ones.
 */
const DIR = join(process.cwd(), ".cache", "games", "fotmob");

export async function fotmob<T>(path: string): Promise<T> {
  mkdirSync(DIR, { recursive: true });
  const file = join(DIR, createHash("sha1").update(path).digest("hex") + ".json");
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`https://www.fotmob.com/api/data/${path}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (res.ok) {
      const json = await res.json();
      writeFileSync(file, JSON.stringify(json));
      return json as T;
    }
    if (attempt >= 3) throw new Error(`FotMob ${res.status} ${path}`);
    await new Promise((r) => setTimeout(r, attempt * 2000));
  }
}

/** A team's crest or a nation's flag, from the ids and codes this source uses. */
export const teamLogo = (id: number | string) =>
  `https://images.fotmob.com/image_resources/logo/teamlogo/${String(id).toLowerCase()}.png`;
export const playerPhoto = (id: number) =>
  `https://images.fotmob.com/image_resources/playerimages/${id}.png`;
