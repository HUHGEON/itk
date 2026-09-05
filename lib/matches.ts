/**
 * The registry, imported rather than read off disk.
 *
 * This module runs in the browser as well as on the server - the live poll is
 * a client-side fetch - and `loadTeams` reaches for `node:fs`, which drags the
 * whole path module into the client bundle and fails the build. The file is 4kB
 * and static, so importing it directly is both smaller and simpler.
 */
import registry from "@/data/teams.json";

interface RegistryTeam {
  slug: string;
  ko: string;
  en: string;
  aliases?: string[];
  crest?: string;
}

const TEAMS = registry as RegistryTeam[];

/**
 * Fixtures, results and live scores.
 *
 * Everything comes from ESPN's public scoreboard endpoints. They need no key
 * and they answer with CORS open, which is what makes live scores possible at
 * all here: the browser can poll them directly, so a ticking scoreline costs
 * this project nothing in server time. Measured before building on it: 20
 * competitions all return 200, a fixture list carries 2.6kB gzipped, and 20
 * requests at 3 second intervals drew no rate limiting.
 *
 * The trade is that this is not a documented API. It is what espn.com itself
 * calls, so it can change without notice. Everything below fails soft: a
 * competition that stops answering drops out of the list rather than taking the
 * page down with it.
 */

/** How ESPN names each competition, and how we do. */
export const COMPETITIONS = [
  { code: "eng.1", ko: "프리미어리그", short: "EPL", kind: "league" },
  { code: "esp.1", ko: "라리가", short: "라리가", kind: "league" },
  { code: "ita.1", ko: "세리에 A", short: "세리에A", kind: "league" },
  { code: "ger.1", ko: "분데스리가", short: "분데스", kind: "league" },
  { code: "fra.1", ko: "리그 1", short: "리그1", kind: "league" },
  { code: "ned.1", ko: "에레디비시", short: "에레디비시", kind: "league" },

  { code: "uefa.champions", ko: "챔피언스리그", short: "UCL", kind: "europe" },
  { code: "uefa.europa", ko: "유로파리그", short: "UEL", kind: "europe" },
  { code: "uefa.europa.conf", ko: "컨퍼런스리그", short: "UECL", kind: "europe" },
  { code: "uefa.super_cup", ko: "UEFA 슈퍼컵", short: "슈퍼컵", kind: "europe" },

  { code: "eng.fa", ko: "FA컵", short: "FA컵", kind: "cup" },
  { code: "eng.league_cup", ko: "카라바오컵", short: "카라바오", kind: "cup" },
  { code: "eng.charity", ko: "커뮤니티 실드", short: "실드", kind: "cup" },
  { code: "esp.copa_del_rey", ko: "코파 델 레이", short: "코파", kind: "cup" },
  { code: "esp.super_cup", ko: "수페르코파", short: "수페르코파", kind: "cup" },
  { code: "ita.coppa_italia", ko: "코파 이탈리아", short: "코파", kind: "cup" },
  { code: "ita.super_cup", ko: "수페르코파", short: "수페르코파", kind: "cup" },
  { code: "ger.dfb_pokal", ko: "DFB 포칼", short: "포칼", kind: "cup" },
  { code: "ger.super_cup", ko: "독일 슈퍼컵", short: "슈퍼컵", kind: "cup" },
  { code: "fra.coupe_de_france", ko: "쿠프 드 프랑스", short: "쿠프", kind: "cup" },
  { code: "fra.super_cup", ko: "트로페 데 샹피옹", short: "트로페", kind: "cup" },
  { code: "ned.cup", ko: "KNVB 베커", short: "KNVB", kind: "cup" },
  { code: "fifa.cwc", ko: "클럽 월드컵", short: "CWC", kind: "cup" },
] as const;

export type CompetitionCode = (typeof COMPETITIONS)[number]["code"];

const BY_CODE = new Map(COMPETITIONS.map((c) => [c.code as string, c]));

export interface MatchSide {
  /** Korean name when the club is one we track, the source's own name otherwise. */
  name: string;
  /** Registry slug, only for tracked clubs. Drives the crest and the filter. */
  slug: string | null;
  crest: string | null;
  score: number | null;
}

export interface Match {
  id: string;
  competition: string;
  competitionShort: string;
  /** Kick-off, as a timestamp. */
  kickoff: number;
  state: "pre" | "in" | "post";
  /** "45'+2'" while playing, "FT" once finished, kick-off time before. */
  clock: string | null;
  home: MatchSide;
  away: MatchSide;
  /** True when either side is a club the feed tracks. */
  tracked: boolean;
}

const ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer";

/** Local YYYYMMDD, which is the only date format the endpoint accepts. */
export function ymd(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("");
}

/**
 * The source's name for each club we track, spelled its way.
 *
 * The registry's aliases exist to find clubs in prose, where "City" and "Villa"
 * and "United" are useful. Against a fixture list they are actively wrong:
 * "Villa" caught Villarreal, "City" caught Coventry City, "Madrid" caught
 * Atletico. The board showed Manchester City playing Manchester City.
 *
 * Fixtures do not need fuzzy matching, because the source names clubs
 * consistently. These are its exact spellings, collected from six leagues and
 * both European competitions before writing this. Anything not in the table is
 * simply a club we do not follow, which is the correct answer for most of the
 * 149 names that come back.
 */
const ESPN_NAME: Record<string, string> = {
  // Premier League
  "Arsenal": "arsenal",
  "Aston Villa": "aston-villa",
  "Chelsea": "chelsea",
  "Liverpool": "liverpool",
  "Manchester City": "man-city",
  "Manchester United": "man-utd",
  "Newcastle United": "newcastle",
  "Tottenham Hotspur": "tottenham",
  // LaLiga
  "Atlético Madrid": "atletico-madrid",
  "Atletico Madrid": "atletico-madrid",
  "Barcelona": "barcelona",
  "Real Madrid": "real-madrid",
  // Serie A. The source calls Inter by its full name.
  "AC Milan": "ac-milan",
  "AS Roma": "roma",
  "Internazionale": "inter",
  "Inter Milan": "inter",
  "Juventus": "juventus",
  // Ligue 1. Paris FC is a different club in the same city.
  "Paris Saint-Germain": "psg",
  "Strasbourg": "strasbourg",
};

const BY_SLUG = new Map(TEAMS.map((t) => [t.slug, t]));

function resolve(name: string): RegistryTeam | null {
  const slug = ESPN_NAME[name.trim()];
  return slug ? (BY_SLUG.get(slug) ?? null) : null;
}

interface EspnCompetitor {
  homeAway?: string;
  score?: string;
  team?: { displayName?: string; shortDisplayName?: string; logo?: string };
}

function side(c: EspnCompetitor | undefined): MatchSide {
  const raw = c?.team?.displayName ?? c?.team?.shortDisplayName ?? "?";
  const known = resolve(raw);
  const n = c?.score == null ? null : Number(c.score);
  return {
    name: known?.ko ?? raw,
    slug: known?.slug ?? null,
    crest: known?.crest ?? c?.team?.logo ?? null,
    score: Number.isFinite(n) ? n : null,
  };
}

/**
 * Turns one ESPN event into a Match, or null if it is unusable.
 *
 * The shape is only loosely guaranteed, so anything missing a competitor or a
 * date is dropped rather than rendered half-empty.
 */
export function toMatch(event: unknown, code: string): Match | null {
  const e = event as {
    id?: string;
    date?: string;
    status?: {
      displayClock?: string;
      type?: { state?: string; shortDetail?: string; completed?: boolean };
    };
    competitions?: { competitors?: EspnCompetitor[] }[];
  };
  const comp = e.competitions?.[0];
  const cs = comp?.competitors ?? [];
  if (!e.id || !e.date || cs.length < 2) return null;

  const home = side(cs.find((c) => c.homeAway === "home") ?? cs[0]);
  const away = side(cs.find((c) => c.homeAway === "away") ?? cs[1]);
  const state = (e.status?.type?.state ?? "pre") as Match["state"];
  const meta = BY_CODE.get(code);

  return {
    id: e.id,
    competition: meta?.ko ?? code,
    competitionShort: meta?.short ?? code,
    kickoff: new Date(e.date).getTime(),
    state,
    clock:
      state === "in"
        ? (e.status?.displayClock ?? null)
        : state === "post"
          ? "종료"
          : null,
    home,
    away,
    tracked: Boolean(home.slug || away.slug),
  };
}

/** One competition's matches for a date. Returns [] rather than throwing. */
async function fetchOne(
  code: string,
  date: string,
  signal?: AbortSignal,
): Promise<Match[]> {
  try {
    const res = await fetch(`${ESPN}/${code}/scoreboard?dates=${date}`, {
      signal,
      // Live scores must not be served from a cache.
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { events?: unknown[] };
    return (json.events ?? [])
      .map((e) => toMatch(e, code))
      .filter((m): m is Match => m !== null);
  } catch {
    return [];
  }
}

/**
 * Every match on a date, across every competition we follow.
 *
 * Requests go out together rather than one after another: twenty sequential
 * round trips would be most of a second, and they do not depend on each other.
 */
export async function matchesOn(
  date: Date,
  signal?: AbortSignal,
): Promise<Match[]> {
  const day = ymd(date);
  const lists = await Promise.all(
    COMPETITIONS.map((c) => fetchOne(c.code, day, signal)),
  );
  return lists.flat().sort((a, b) => a.kickoff - b.kickoff);
}


/* ------------------------------------------------------------------ *
 * League tables
 * ------------------------------------------------------------------ */

export interface TableRow {
  rank: number;
  name: string;
  slug: string | null;
  crest: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  for: number;
  against: number;
  diff: number;
  points: number;
}

/** Pulls a named stat out of the source's flat list. */
function stat(
  stats: { name?: string; value?: number; displayValue?: string }[] | undefined,
  name: string,
): number {
  const s = stats?.find((x) => x.name === name);
  if (!s) return 0;
  if (typeof s.value === "number") return s.value;
  const n = Number(s.displayValue);
  return Number.isFinite(n) ? n : 0;
}

/**
 * A competition's table.
 *
 * Returns [] for anything that does not have one - a knockout cup has no
 * standings, and asking for them is not an error worth surfacing. The European
 * competitions do have one: the league phase is a single 36 team table.
 */
export async function tableFor(
  code: string,
  signal?: AbortSignal,
): Promise<TableRow[]> {
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/v2/sports/soccer/${code}/standings`,
      { signal, next: { revalidate: 300 } },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as {
      children?: {
        standings?: {
          entries?: {
            team?: { displayName?: string; logo?: string };
            stats?: { name?: string; value?: number; displayValue?: string }[];
          }[];
        };
      }[];
    };

    const rows: TableRow[] = [];
    for (const child of json.children ?? []) {
      for (const e of child.standings?.entries ?? []) {
        const raw = e.team?.displayName ?? "?";
        const known = resolve(raw);
        rows.push({
          rank: stat(e.stats, "rank"),
          name: known?.ko ?? raw,
          slug: known?.slug ?? null,
          crest: known?.crest ?? e.team?.logo ?? null,
          played: stat(e.stats, "gamesPlayed"),
          won: stat(e.stats, "wins"),
          drawn: stat(e.stats, "ties"),
          lost: stat(e.stats, "losses"),
          for: stat(e.stats, "pointsFor"),
          against: stat(e.stats, "pointsAgainst"),
          diff: stat(e.stats, "pointDifferential"),
          points: stat(e.stats, "points"),
        });
      }
    }
    return rows.sort((a, b) => a.rank - b.rank);
  } catch {
    return [];
  }
}

/**
 * Every match a club plays in a window, across all competitions.
 *
 * Asked per competition rather than per club because that is the only shape
 * the source offers, then filtered here. A 90 day window either side covers a
 * club's recent form and everything that has been scheduled.
 */
export async function matchesForTeam(
  slug: string,
  opts: { back?: number; forward?: number } = {},
  signal?: AbortSignal,
): Promise<Match[]> {
  const back = opts.back ?? 45;
  const forward = opts.forward ?? 45;
  const from = new Date();
  from.setDate(from.getDate() - back);
  const to = new Date();
  to.setDate(to.getDate() + forward);
  const span = `${ymd(from)}-${ymd(to)}`;

  const lists = await Promise.all(
    COMPETITIONS.map(async (c) => {
      try {
        const res = await fetch(
          `${ESPN}/${c.code}/scoreboard?dates=${span}`,
          { signal, next: { revalidate: 120 } },
        );
        if (!res.ok) return [];
        const json = (await res.json()) as { events?: unknown[] };
        return (json.events ?? [])
          .map((e) => toMatch(e, c.code))
          .filter(
            (m): m is Match =>
              m !== null && (m.home.slug === slug || m.away.slug === slug),
          );
      } catch {
        return [];
      }
    }),
  );
  return lists.flat().sort((a, b) => a.kickoff - b.kickoff);
}
