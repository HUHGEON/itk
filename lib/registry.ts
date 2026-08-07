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
        // Global: detectTeams masks every occurrence, not just the first.
        pattern: new RegExp(`\\b${escapeRe(alias)}\\b`, "gi"),
        len: alias.length,
      });
    }
  }
  out.sort((a, b) => b.len - a.len);
  matcherSource = teams;
  matcherCache = out.map(({ slug, pattern }) => ({ slug, pattern }));
  return matcherCache;
}

/**
 * Clubs we don't track whose names contain an alias we do.
 *
 * "Leeds United" is not Manchester United and "AFC Bournemouth" is not Arsenal,
 * but `\bUnited\b` and `\bAFC\b` match both. Masking a tracked club's longer
 * name handles Newcastle United on its own; these are the ones no tracked alias
 * would ever cover.
 */
const SHIELDS = new RegExp(
  [
    // "United"
    "(?:leeds|west ham|sheffield|dundee|carlisle|colchester|oxford|rotherham",
    "|southend|torquay|hartlepool|cambridge|scunthorpe|ayr|hereford)\\s+united",
    // "City"
    "|(?:leicester|norwich|hull|cardiff|swansea|bristol|stoke|coventry|birmingham",
    "|lincoln|exeter|salford|bradford|york|chester|new york|melbourne|mumbai",
    "|ho chi minh)\\s+city",
    // "AFC" — two clubs and a continental confederation
    "|afc\\s+(?:bournemouth|wimbledon|ajax|champions league|asian cup)",
    // "Madrid" / "Milan" as places rather than clubs
    "|rayo vallecano|milan(?:o)?\\s+(?:fashion|design|airport)",
  ].join(""),
  "gi",
);

/** Same length, so every offset after it is unchanged. */
function blank(match: string): string {
  return " ".repeat(match.length);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Tags free text with every team it mentions.
 *
 * Matching consumes: each alias is blanked out of the text once it has matched,
 * and the aliases run longest first. Testing them independently meant
 * "Newcastle United" tagged Manchester United as well, "Atletico Madrid" tagged
 * Real Madrid, and "Inter Milan" tagged AC Milan — the wrong-club tags that
 * showed up under the filters.
 */
export function detectTeams(text: string): string[] {
  const found = new Set<string>();
  let rest = text.replace(SHIELDS, blank);

  for (const { slug, pattern } of teamMatchers()) {
    pattern.lastIndex = 0;
    if (!pattern.test(rest)) continue;
    found.add(slug);
    pattern.lastIndex = 0;
    rest = rest.replace(pattern, blank);
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
