/**
 * Postgres schema everything lives in, so this can share a Supabase project
 * with another app without colliding with its `public` schema.
 * Declared here (not in db.ts) so client components can read it without
 * pulling the Postgres driver into the browser bundle.
 */
export const DB_SCHEMA = "tierboard";

export type Tier = 0 | 1 | 1.5 | 2 | 3;

export type League =
  | "EPL"
  | "LaLiga"
  | "Bundesliga"
  | "SerieA"
  | "Ligue1"
  | "Eredivisie"
  | "General";

export interface Team {
  slug: string;
  ko: string;
  en: string;
  league: League;
  aliases: string[];
  /** crest URL, filled in by scripts/fetch-crests.ts */
  crest?: string;
  /** football-data.org team id, used to pull squads */
  fdId?: number;
}

export interface Journalist {
  /** stable slug derived from the English name */
  id: string;
  ko: string;
  en: string;
  tier: Tier;
  teams: string[];
  league: League;
  country: string;
  outlet: string;
  x: string;
  confidence: "high" | "medium" | "low";
  note?: string;
  /** false hides the journalist from collection without deleting them */
  active: boolean;
  /**
   * Feeds written by this person — a WordPress author feed
   * (`/author/<slug>/feed/`), a YouTube channel RSS
   * (`youtube.com/feeds/videos.xml?channel_id=...`), a personal blog.
   *
   * Worth adding wherever one exists: unlike the Google News fallback these
   * carry an image and a real body, and the attribution is certain rather
   * than inferred.
   */
  feeds?: string[];
  /**
   * Bluesky handle. The only place these reporters post primary-source breaking
   * news that we can read for free — `public.api.bsky.app` needs no key, no
   * login and no scraping, unlike X (paid per read) or Instagram (no public
   * read at all).
   */
  bluesky?: string;
}

export interface Article {
  id: string;
  url: string;
  title: string;
  snippet: string;
  /** publication that carried the piece, e.g. "The Athletic" */
  source: string;
  publishedAt: number;
  journalistId: string | null;
  /** denormalised from the journalist so feed queries stay single-table */
  tier: Tier | null;
  teams: string[];
  titleKo: string | null;
  summaryKo: string | null;
  createdAt: number;
}

/**
 * How much a tier is trusted, 0..1. Used to rank the feed and to decide
 * whether an article clears a notification threshold.
 */
export const TIER_WEIGHT: Record<string, number> = {
  "0": 1.0,
  "1": 0.8,
  "1.5": 0.65,
  "2": 0.45,
  "3": 0.25,
};

export const TIER_LABEL: Record<string, string> = {
  "0": "0티어",
  "1": "1티어",
  "1.5": "1.5티어",
  "2": "2티어",
  "3": "3티어",
};

export const ALL_TIERS: Tier[] = [0, 1, 1.5, 2, 3];

export const LEAGUE_LABEL: Record<League, string> = {
  EPL: "프리미어리그",
  LaLiga: "라리가",
  Bundesliga: "분데스리가",
  SerieA: "세리에 A",
  Ligue1: "리그 1",
  Eredivisie: "에레디비시",
  General: "종합",
};
