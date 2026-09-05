import { unstable_cache } from "next/cache";
import { sameClub } from "@/lib/names";
import type { Match } from "@/lib/matches";

/**
 * The richer half of a match report.
 *
 * The fixture list and the live scoreline stay where they are, because that
 * source answers with CORS open and a one second cache, which is what lets a
 * ticking scoreline cost this project nothing - the browser polls it directly.
 * Measured here: this one sends no CORS headers at all and caches for fifteen
 * minutes, so it can neither be called from a page nor kept current. It is a
 * server-side read for a report that is already being rendered on the server.
 *
 * What it adds is everything the first source does not have: a rating for every
 * player, a photograph for every player, exact pitch coordinates in both
 * orientations, the manager, and who was unavailable. Measured on one match:
 * forty of forty players had a photograph and a rating.
 *
 * Every part of this fails soft. A match that cannot be found, a request that
 * does not answer, a shape that changed - all of them return null and the
 * report falls back to what the first source gave it.
 */

const API = "https://www.fotmob.com/api/data";

export interface FmPlayer {
  name: string;
  jersey: string;
  rating: number | null;
  image: string;
  /** 0-1 across the pitch and along it, within this team's own half. */
  x: number;
  y: number;
  goals: number;
  assists: number;
  /** Minute he went off, if he did. */
  offAt: number | null;
  /** Minute he came on, if he did. */
  onAt: number | null;
}

export interface FmTeam {
  name: string;
  formation: string | null;
  rating: number | null;
  coach: string | null;
  starters: FmPlayer[];
  subs: FmPlayer[];
  unavailable: { name: string; reason: string }[];
}

export interface FmLineup {
  home: FmTeam;
  away: FmTeam;
}

interface RawPlayer {
  id?: number;
  name?: string;
  shirtNumber?: number;
  verticalLayout?: { x?: number; y?: number };
  performance?: {
    rating?: number;
    events?: { type?: string }[];
    substitutionEvents?: { time?: number; type?: string }[];
  };
}

interface RawTeam {
  name?: string;
  formation?: string;
  rating?: number;
  coach?: { name?: string };
  starters?: RawPlayer[];
  subs?: RawPlayer[];
  unavailable?: {
    name?: string;
    unavailability?: { type?: string; expectedReturn?: string };
  }[];
}

const REASON: Record<string, string> = {
  injury: "부상",
  suspension: "출장 정지",
  other: "결장",
};

function player(p: RawPlayer): FmPlayer {
  const perf = p.performance ?? {};
  const events = perf.events ?? [];
  const subs = perf.substitutionEvents ?? [];
  const at = (type: string) =>
    subs.find((s) => s.type === type)?.time ?? null;
  return {
    name: p.name ?? "?",
    jersey: p.shirtNumber == null ? "" : String(p.shirtNumber),
    rating: typeof perf.rating === "number" ? perf.rating : null,
    image: `https://images.fotmob.com/image_resources/playerimages/${p.id}.png`,
    // The layout is given per team half, which is the same frame the pitch
    // draws in: y runs from the goalkeeper's line to the halfway line.
    x: p.verticalLayout?.x ?? 0.5,
    y: p.verticalLayout?.y ?? 0.5,
    goals: events.filter((e) => e.type === "goal").length,
    assists: events.filter((e) => e.type === "assist").length,
    offAt: at("subOut"),
    onAt: at("subIn"),
  };
}

function team(t: RawTeam | undefined): FmTeam | null {
  if (!t?.starters?.length) return null;
  return {
    name: t.name ?? "?",
    formation: t.formation ?? null,
    rating: typeof t.rating === "number" ? t.rating : null,
    coach: t.coach?.name ?? null,
    starters: t.starters.map(player),
    subs: (t.subs ?? []).map(player),
    unavailable: (t.unavailable ?? []).map((u) => ({
      name: u.name ?? "?",
      reason: REASON[u.unavailability?.type ?? "other"] ?? "결장",
    })),
  };
}

/**
 * This source's id for one of our matches.
 *
 * Matched on the day's fixture list by kick-off and both club names, because
 * the two sources number matches differently and nothing joins them but the
 * fixture itself. Both names have to agree: one alone would pair a Manchester
 * derby with the wrong Manchester side.
 */
export async function findId(match: Match): Promise<number | null> {
  const day = new Date(match.kickoff)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");
  try {
    const res = await fetch(`${API}/matches?date=${day}`, {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      leagues?: {
        matches?: {
          id?: number;
          home?: { name?: string };
          away?: { name?: string };
          status?: { utcTime?: string };
        }[];
      }[];
    };
    for (const league of json.leagues ?? []) {
      for (const m of league.matches ?? []) {
        const t = Date.parse(m.status?.utcTime ?? "");
        if (!Number.isFinite(t) || Math.abs(t - match.kickoff) > 30 * 60_000) {
          continue;
        }
        if (!sameClub(m.home?.name ?? "", match.home.sourceName)) continue;
        if (!sameClub(m.away?.name ?? "", match.away.sourceName)) continue;
        return m.id ?? null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function fotmobDetail(id: number): Promise<FmLineup | null> {
  try {
    const res = await fetch(`${API}/matchDetails?matchId=${id}`, {
      signal: AbortSignal.timeout(9000),
      // Their own edge holds it for fifteen minutes, so asking more often than
      // a couple of minutes buys nothing.
      next: { revalidate: 120 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      content?: { lineup?: { homeTeam?: RawTeam; awayTeam?: RawTeam } };
    };
    const lu = json.content?.lineup;
    const home = team(lu?.homeTeam);
    const away = team(lu?.awayTeam);
    if (!home || !away) return null;
    return { home, away };
  } catch {
    return null;
  }
}

const cachedId = unstable_cache(
  async (kickoff: number, homeName: string, awayName: string) =>
    findId({
      kickoff,
      home: { sourceName: homeName },
      away: { sourceName: awayName },
    } as Match),
  ["fotmob-match-id"],
  { revalidate: 86400 },
);

/** Both lineups with ratings and photographs, or null. */
export async function fotmobLineup(match: Match): Promise<FmLineup | null> {
  const id = await cachedId(
    match.kickoff,
    match.home.sourceName,
    match.away.sourceName,
  );
  if (!id) return null;
  return fotmobDetail(id);
}
