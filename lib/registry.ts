import fs from "node:fs";
import path from "node:path";
import type { Journalist, Team } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

/** "Raphaël Honigstein" -> "raphael-honigstein" */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Reads a JSON registry, re-reading whenever the file changes on disk.
 *
 * A plain module-level cache silently served a stale team list for the life of
 * the process: editing teams.json left the running server showing clubs that no
 * longer existed in the database, so their filter chips returned nothing.
 */
function cachedJson<T>(file: string, fallback: T): () => T {
  let value: T | null = null;
  let stamp = -1;

  return () => {
    const full = path.join(DATA_DIR, file);
    if (!fs.existsSync(full)) return fallback;

    const mtime = fs.statSync(full).mtimeMs;
    if (value === null || mtime !== stamp) {
      value = JSON.parse(fs.readFileSync(full, "utf8")) as T;
      stamp = mtime;
    }
    return value;
  };
}

export const loadTeams = cachedJson<Team[]>("teams.json", []);
export const loadJournalists = cachedJson<Journalist[]>("journalists.json", []);

/**
 * Longest alias first, so "Manchester United" wins over "United" and we never
 * tag a Man Utd story as a generic match on the shorter alias.
 */
let matcherSource: Team[] | null = null;
let matcherCache: { slug: string; pattern: RegExp }[] = [];

export function teamMatchers(): { slug: string; pattern: RegExp }[] {
  const teams = loadTeams();
  // detectTeams runs per article; rebuilding every regex each time was the
  // hottest thing in a collection run. Keyed on identity, so an edited
  // teams.json (which produces a new array) rebuilds automatically.
  if (teams === matcherSource) return matcherCache;

  const out: { slug: string; pattern: RegExp; len: number }[] = [];
  for (const team of teams) {
    for (const alias of team.aliases) {
      out.push({
        slug: team.slug,
        pattern: new RegExp(`\\b${escapeRe(alias)}\\b`, "i"),
        len: alias.length,
      });
    }
  }
  out.sort((a, b) => b.len - a.len);
  matcherSource = teams;
  matcherCache = out.map(({ slug, pattern }) => ({ slug, pattern }));
  return matcherCache;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Tags free text with every team it mentions. */
export function detectTeams(text: string): string[] {
  const found = new Set<string>();
  for (const { slug, pattern } of teamMatchers()) {
    if (pattern.test(text)) found.add(slug);
  }
  return [...found];
}

/**
 * Journalists whose name appears in the text — a citation, not a byline.
 *
 * The reporters with the biggest scoops (Romano above all) publish only on X
 * and Instagram, where free reads don't exist. But the outlets that re-report
 * them say so explicitly ("according to Fabrizio Romano"), so the name in the
 * body is the one free signal that a story traces back to him.
 *
 * Full-name match only: surnames alone would attribute half of Italian football
 * to the wrong person.
 */
let citationSource: Journalist[] | null = null;
let citationCache: { id: string; tier: number; pattern: RegExp }[] = [];

function citationMatchers() {
  const journalists = loadJournalists();
  if (journalists === citationSource) return citationCache;

  citationCache = journalists
    .filter((j) => j.active && j.en.length >= 10 && j.en.includes(" "))
    .map((j) => ({
      id: j.id,
      tier: j.tier,
      pattern: new RegExp(`\\b${escapeRe(j.en)}\\b`, "i"),
    }));
  citationSource = journalists;
  return citationCache;
}

/** The most-trusted journalist cited in `text`, or null. */
export function detectCitation(text: string): { id: string; tier: number } | null {
  let best: { id: string; tier: number } | null = null;
  for (const m of citationMatchers()) {
    if (!m.pattern.test(text)) continue;
    if (!best || m.tier < best.tier) best = { id: m.id, tier: m.tier };
  }
  return best;
}
