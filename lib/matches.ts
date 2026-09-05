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
  /** The source's own name, always. Needed to ask other services about the club. */
  sourceName: string;
  /** Registry slug, only for tracked clubs. Drives the crest and the filter. */
  slug: string | null;
  crest: string | null;
  score: number | null;
  /** Kit colour as six hex digits, no hash. Drives the pitch tokens. */
  color: string | null;
  /** Change colour, used when both clubs' first colours are too alike. */
  color2: string | null;
}

export interface Match {
  id: string;
  /** Source competition code, so a row can link to its own detail page. */
  code: string;
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

/**
 * Everything on these pages is Korean time, wherever the code is running.
 *
 * The site is read from Korea and rendered on servers set to UTC, which are
 * nine hours apart. Left to the runtime's own idea of local time, a 20:30
 * kick-off rendered as 11:30 in production and correctly at home, and worse,
 * "today" changed over at 09:00 KST instead of midnight - so for nine hours
 * every morning the fixture list was showing the previous day.
 *
 * Fixing it per call site would mean remembering every time. These helpers are
 * the only way dates are read here.
 */
const KST = "Asia/Seoul";

const KST_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: KST,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
  hour12: false,
});

export interface SeoulTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 = Sunday, matching Date.getDay. */
  weekday: number;
  /** YYYYMMDD */
  ymd: string;
  /** HH:MM */
  hm: string;
}

const DAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/** Reads a moment as it appears on a clock in Seoul. */
export function seoul(input: Date | number): SeoulTime {
  const parts = KST_PARTS.formatToParts(
    typeof input === "number" ? new Date(input) : input,
  );
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  // Midnight comes back as "24" from some runtimes.
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    year,
    month,
    day,
    hour,
    minute,
    weekday: DAY_INDEX[get("weekday")] ?? 0,
    ymd: `${year}${pad(month)}${pad(day)}`,
    hm: `${pad(hour)}:${pad(minute)}`,
  };
}

/** YYYYMMDD in Seoul, which is the format the endpoint accepts. */
export function ymd(d: Date): string {
  return seoul(d).ymd;
}

/** Midnight in Seoul on a given YYYYMMDD, as a real instant. */
export function seoulDay(y: number, m: number, d: number): Date {
  // KST has no daylight saving, so a fixed offset is exact.
  return new Date(Date.UTC(y, m - 1, d, 0, 0) - 9 * 3600_000);
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
  team?: {
    displayName?: string;
    shortDisplayName?: string;
    logo?: string;
    color?: string;
    alternateColor?: string;
  };
}

/** Six hex digits or nothing. */
function hex(v: string | undefined): string | null {
  return /^[0-9a-fA-F]{6}$/.test(v ?? "") ? (v as string) : null;
}

function side(c: EspnCompetitor | undefined): MatchSide {
  const raw = c?.team?.displayName ?? c?.team?.shortDisplayName ?? "?";
  const known = resolve(raw);
  const n = c?.score == null ? null : Number(c.score);
  return {
    name: known?.ko ?? raw,
    sourceName: raw,
    slug: known?.slug ?? null,
    crest: known?.crest ?? c?.team?.logo ?? null,
    score: Number.isFinite(n) ? n : null,
    color: hex(c?.team?.color),
    color2: hex(c?.team?.alternateColor),
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
    code,
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
  /*
   * A Korean day, not a UTC one.
   *
   * The source files a match under its own UTC date, and Korea is nine hours
   * ahead, so a Korean day runs from 15:00 the previous UTC day to 14:59 of
   * this one. Asking for a single UTC date therefore answers with the wrong
   * set at both ends.
   *
   * Measured on 6 September before the fix: nineteen matches came back and
   * nine of them were actually Korean the 7th - Arsenal against Chelsea, a
   * Monday 00:30 kick-off, sat under Sunday. The Korean small hours of the
   * 6th were meanwhile filed under the 5th and could not be found at all.
   *
   * So both UTC days are fetched and the result is filtered to the Korean
   * calendar day. The extra request per competition is the whole cost, and
   * fetchOne already takes a range.
   */
  const want = ymd(date);
  const before = ymd(new Date(date.getTime() - 24 * 3600_000));
  const span = `${before}-${want}`;
  const lists = await Promise.all(
    COMPETITIONS.map((c) => fetchOne(c.code, span, signal)),
  );
  return lists
    .flat()
    .filter((m) => seoul(m.kickoff).ymd === want)
    .sort((a, b) => a.kickoff - b.kickoff);
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

/* -------------------------------------------------------------------------
 * One match, in full.
 *
 * ESPN's summary endpoint carries what a match report needs: a timeline with
 * named scorers, twenty-nine team statistics, and both lineups with formations
 * and substitutions. Measured on a finished Premier League match before
 * building on it - what is here is what came back, and what is not here did not
 * exist. Notably there are no player ratings and no per-player statistics
 * (`boxscore.players` is absent for football), so this page does not pretend to
 * have them.
 *
 * The parser is split from the fetch so the browser can re-run it against the
 * same endpoint while a match is in play, the same way the board polls.
 * ----------------------------------------------------------------------- */

export type EventKind = "goal" | "own" | "pen" | "miss" | "yellow" | "red" | "sub";

export interface MatchEvent {
  id: string;
  kind: EventKind;
  /** "24'", "45'+4'". */
  minute: string;
  /** Sorting key in seconds, since the minute string is not comparable. */
  at: number;
  side: "home" | "away" | null;
  /** Scorer, booked player, or the player coming on. */
  player: string | null;
  /** Assist, or the player going off. */
  second: string | null;
}

export interface StatPair {
  label: string;
  home: string;
  away: string;
  /** Share of the bar, home side. 0.5 when neither did anything. */
  share: number;
}

export interface StatGroup {
  title: string;
  rows: StatPair[];
}

export interface LineupPlayer {
  name: string;
  jersey: string;
  position: string;
  subbedOut: boolean;
  subbedIn: boolean;
}

export interface Lineup {
  formation: string | null;
  starters: LineupPlayer[];
  bench: LineupPlayer[];
}

export interface MatchDetail {
  match: Match;
  venue: string | null;
  events: MatchEvent[];
  stats: StatGroup[];
  lineups: { home: Lineup | null; away: Lineup | null } | null;
}

/** Minute string to seconds, so "45'+4'" sorts after "45'". */
function minuteAt(display: string | undefined, value: number | undefined): number {
  if (typeof value === "number") return value;
  const m = /(\d+)'(?:\+(\d+))?/.exec(display ?? "");
  if (!m) return 0;
  return (Number(m[1]) + Number(m[2] ?? 0) / 100) * 60;
}

const EVENT_KIND: Record<string, EventKind> = {
  Goal: "goal",
  "Own Goal": "own",
  "Penalty - Scored": "pen",
  "Penalty - Missed": "miss",
  "Penalty - Saved": "miss",
  "Yellow Card": "yellow",
  "Red Card": "red",
  "Yellow Red Card": "red",
  Substitution: "sub",
};

interface SummaryJson {
  header?: {
    competitions?: {
      competitors?: { id?: string; homeAway?: string }[];
    }[];
  };
  gameInfo?: { venue?: { fullName?: string } };
  keyEvents?: {
    id?: string;
    type?: { text?: string };
    clock?: { value?: number; displayValue?: string };
    team?: { id?: string };
    participants?: { athlete?: { displayName?: string } }[];
  }[];
  boxscore?: {
    teams?: {
      statistics?: { name?: string; displayValue?: string }[];
    }[];
  };
  rosters?: {
    formation?: string;
    homeAway?: string;
    roster?: {
      jersey?: string;
      starter?: boolean;
      subbedIn?: boolean;
      subbedOut?: boolean;
      position?: { abbreviation?: string };
      athlete?: { displayName?: string };
    }[];
  }[];
}

/** Reads a raw statistic. Missing means zero, which is what a blank row means. */
function raw(
  stats: { name?: string; displayValue?: string }[] | undefined,
  name: string,
): number {
  const v = Number(stats?.find((s) => s.name === name)?.displayValue);
  return Number.isFinite(v) ? v : 0;
}

/**
 * A counted statistic, as a bar.
 *
 * The bar is the point: two numbers side by side are read as a comparison, and
 * the share saves the reader doing the division. Nothing to nothing splits even
 * rather than collapsing to one side.
 */
function pair(label: string, a: number, b: number, suffix = ""): StatPair {
  const total = a + b;
  return {
    label,
    home: `${a}${suffix}`,
    away: `${b}${suffix}`,
    share: total === 0 ? 0.5 : a / total,
  };
}

/**
 * A percentage worked out here rather than taken from the source.
 *
 * Measured: the source reports `passPct` as "0.9" for 556 of 626, which is 88.8
 * per cent. Its own rounding is to one decimal of a fraction, so every rate it
 * publishes lands on a multiple of ten when shown as a percentage. Dividing the
 * two counts it also publishes gives the real figure.
 */
function rate(label: string, an: number, ad: number, bn: number, bd: number): StatPair {
  const a = ad === 0 ? 0 : Math.round((an / ad) * 100);
  const b = bd === 0 ? 0 : Math.round((bn / bd) * 100);
  return { label, home: `${a}%`, away: `${b}%`, share: a + b === 0 ? 0.5 : a / (a + b) };
}

function buildStats(json: SummaryJson): StatGroup[] {
  const t = json.boxscore?.teams;
  if (!t || t.length < 2) return [];
  const h = t[0].statistics;
  const a = t[1].statistics;
  const n = (k: string) => [raw(h, k), raw(a, k)] as const;

  const [hPoss, aPoss] = n("possessionPct");
  const [hPass, aPass] = n("accuratePasses");
  const [hPassT, aPassT] = n("totalPasses");
  const [hCross, aCross] = n("accurateCrosses");
  const [hCrossT, aCrossT] = n("totalCrosses");
  const [hLong, aLong] = n("accurateLongBalls");
  const [hLongT, aLongT] = n("totalLongBalls");

  const groups: StatGroup[] = [
    {
      title: "공격",
      rows: [
        {
          label: "점유율",
          home: `${hPoss}%`,
          away: `${aPoss}%`,
          share: hPoss + aPoss === 0 ? 0.5 : hPoss / (hPoss + aPoss),
        },
        pair("슈팅", ...n("totalShots")),
        pair("유효 슈팅", ...n("shotsOnTarget")),
        pair("코너킥", ...n("wonCorners")),
        pair("오프사이드", ...n("offsides")),
      ],
    },
    {
      title: "패스",
      rows: [
        pair("패스 성공", hPass, aPass),
        rate("패스 성공률", hPass, hPassT, aPass, aPassT),
        pair("크로스 성공", hCross, aCross),
        rate("크로스 성공률", hCross, hCrossT, aCross, aCrossT),
        pair("롱볼 성공", hLong, aLong),
        rate("롱볼 성공률", hLong, hLongT, aLong, aLongT),
      ],
    },
    {
      title: "수비",
      rows: [
        pair("태클", ...n("totalTackles")),
        pair("인터셉트", ...n("interceptions")),
        pair("클리어", ...n("effectiveClearance")),
        pair("슈팅 차단", ...n("blockedShots")),
        pair("선방", ...n("saves")),
      ],
    },
    {
      title: "규율",
      rows: [
        pair("파울", ...n("foulsCommitted")),
        pair("경고", ...n("yellowCards")),
        pair("퇴장", ...n("redCards")),
      ],
    },
  ];

  // A group whose every row is nil says nothing. Before kick-off that is all of
  // them, and four empty bar charts is worse than no statistics section at all.
  return groups.filter((g) =>
    g.rows.some((r) => r.home !== "0" && r.home !== "0%" ? true : r.away !== "0" && r.away !== "0%"),
  );
}

function buildLineup(r: SummaryJson["rosters"] extends (infer U)[] | undefined ? U : never): Lineup {
  const all = (r?.roster ?? []).map((p) => ({
    name: p.athlete?.displayName ?? "?",
    jersey: p.jersey ?? "",
    position: p.position?.abbreviation ?? "",
    subbedOut: Boolean(p.subbedOut),
    subbedIn: Boolean(p.subbedIn),
  }));
  return {
    formation: r?.formation ?? null,
    starters: all.filter((_, i) => (r?.roster ?? [])[i]?.starter),
    bench: all.filter((_, i) => !(r?.roster ?? [])[i]?.starter),
  };
}

/**
 * Turns a summary response into a match report. Pure, so the browser can call
 * it on each poll while the match is in play.
 */
export function toDetail(
  summary: unknown,
  match: Match,
): MatchDetail {
  const json = summary as SummaryJson;
  const cs = json.header?.competitions?.[0]?.competitors ?? [];
  const homeId = cs.find((c) => c.homeAway === "home")?.id;
  const awayId = cs.find((c) => c.homeAway === "away")?.id;

  const events: MatchEvent[] = [];
  for (const [i, e] of (json.keyEvents ?? []).entries()) {
    const kind = EVENT_KIND[e.type?.text ?? ""];
    if (!kind) continue; // Kick-off, half time, delays: the clock says this already.
    const who = e.participants ?? [];
    events.push({
      id: e.id ?? `e${i}`,
      kind,
      minute: e.clock?.displayValue ?? "",
      at: minuteAt(e.clock?.displayValue, e.clock?.value),
      side: e.team?.id === homeId ? "home" : e.team?.id === awayId ? "away" : null,
      player: who[0]?.athlete?.displayName ?? null,
      second: who[1]?.athlete?.displayName ?? null,
    });
  }
  events.sort((x, y) => x.at - y.at);

  const rosters = json.rosters ?? [];
  const hr = rosters.find((r) => r.homeAway === "home") ?? rosters[0];
  const ar = rosters.find((r) => r.homeAway === "away") ?? rosters[1];
  // A named side only counts once it has an eleven. Before kick-off the source
  // answers with the rosters key present and both sides empty, and a lineups
  // object holding two nulls is still truthy - which let an empty report render
  // as neither lineups nor the "nothing published yet" notice.
  const named = (r: typeof hr) => {
    if (!r) return null;
    const l = buildLineup(r);
    return l.starters.length > 0 ? l : null;
  };
  const home = named(hr);
  const away = named(ar);

  return {
    match,
    venue: json.gameInfo?.venue?.fullName ?? null,
    events,
    stats: buildStats(json),
    lineups: home || away ? { home, away } : null,
  };
}

/** The summary endpoint for one match. Open, keyless, same host as the board. */
export function summaryUrl(code: string, id: string): string {
  return `${ESPN}/${code}/summary?event=${id}`;
}

/**
 * One match's report.
 *
 * Returns null when the match does not exist, which is what a bad URL should
 * produce - a 404 rather than an empty page pretending the fixture is real.
 */
/**
 * A summary response, whole. Split out from the fetch so the browser can run it
 * on each poll while a match is in play.
 */
export function parseSummary(
  json: unknown,
  code: string,
  id: string,
): MatchDetail | null {
  const header = (json as { header?: { competitions?: unknown[] } }).header;
  const comp = header?.competitions?.[0];
  if (!comp) return null;
  // The header carries the id and the competition entry carries the date,
  // status and competitors - the same shape `toMatch` already reads off a
  // scoreboard event once the two are merged. Verified against a finished
  // fixture: club names, scores, state and kick-off all resolve.
  const match = toMatch({ ...(header as object), ...(comp as object) }, code);
  if (!match) return null;
  return toDetail(json, { ...match, id });
}

/**
 * One match's report.
 *
 * Returns null when the match does not exist, which is what a bad URL should
 * produce - a 404 rather than an empty page pretending the fixture is real.
 */
export async function matchDetail(
  code: string,
  id: string,
  signal?: AbortSignal,
): Promise<MatchDetail | null> {
  try {
    const res = await fetch(summaryUrl(code, id), {
      signal,
      // A match in play must not be served from a cache.
      cache: "no-store",
    });
    if (!res.ok) return null;
    return parseSummary(await res.json(), code, id);
  } catch {
    return null;
  }
}
