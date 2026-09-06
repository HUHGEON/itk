import { unstable_cache } from "next/cache";
import { clubScore } from "@/lib/names";
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
  /** This source's own id, which is what a player page is addressed by. */
  id: number;
  name: string;
  /** Which quarter of the pitch he plays in, for a substitute's card. */
  position: string;
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

export type FmEventKind =
  | "goal"
  | "own"
  | "pen"
  | "yellow"
  | "red"
  | "sub"
  | "half";

export interface FmEvent {
  id: string;
  kind: FmEventKind;
  /** "24'", "45+2'". */
  minute: string;
  /** Sorting key. */
  at: number;
  side: "home" | "away" | null;
  /** Scorer, booked player, or the player coming on. */
  player: string | null;
  playerId: number | null;
  /** Assist, or the player going off. */
  second: string | null;
  secondId: number | null;
  /** The scoreline after a goal. */
  score: string | null;
  /** Half time, full time, added time - a divider rather than an event. */
  note: string | null;
}

export interface FmStat {
  label: string;
  home: string;
  away: string;
  /** Home's share of the bar, 0-1. Null when the pair cannot be compared. */
  share: number | null;
}

export interface FmStatGroup {
  title: string;
  rows: FmStat[];
}

export interface FmReport {
  /** This source's match id, so the browser can poll the same match. */
  id: number;
  lineup: FmLineup | null;
  events: FmEvent[];
  stats: FmStatGroup[];
}

/**
 * Which quarter of the pitch a player belongs to.
 *
 * Two fields carry a position and only one of them is always there: a starter
 * has `positionId`, which is where he lined up, but a substitute has no such
 * field at all - measured, every one of them came back null, which is why the
 * cards showed no position under the name. `usualPlayingPositionId` is on both,
 * and it is the plain four-way split: 0 keeper, 1 defence, 2 midfield, 3
 * attack. Checked against the source's own labels for the same match:
 * Grealish 3 and shown as a forward, Hackney 2 a midfielder, Maitland-Niles 1
 * a defender, Travers 0 a keeper.
 */
function positionOf(usual: number | undefined): string {
  switch (usual) {
    case 0:
      return "G";
    case 1:
      return "D";
    case 2:
      return "M";
    case 3:
      return "F";
    default:
      return "";
  }
}

interface RawPlayer {
  id?: number;
  name?: string;
  usualPlayingPositionId?: number;
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
    id: p.id ?? 0,
    name: p.name ?? "?",
    position: positionOf(p.usualPlayingPositionId),
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

    /*
     * The best of the fixtures kicking off at the same minute.
     *
     * Both sides have to agree at least a little, and the winner has to beat
     * the runner-up outright - a tie means two candidates look equally like
     * this match and picking either would be a guess. That is what stops a
     * women's fixture, which carries the same club names, from being taken for
     * the men's one at the same hour.
     */
    let best: { id: number; score: number } | null = null;
    let runnerUp = -Infinity;

    for (const league of json.leagues ?? []) {
      for (const m of league.matches ?? []) {
        const t = Date.parse(m.status?.utcTime ?? "");
        if (!Number.isFinite(t) || Math.abs(t - match.kickoff) > 20 * 60_000) {
          continue;
        }
        const home = m.home?.name ?? "";
        const away = m.away?.name ?? "";
        // A women's or youth side shares its club's name and nothing else.
        if (/\((?:W|Y)\)|\bWFC\b|\bU\d{2}\b/i.test(`${home} ${away}`)) {
          continue;
        }
        const h = clubScore(home, match.home.sourceName);
        const a = clubScore(away, match.away.sourceName);
        if (h === 0 || a === 0) continue;
        const score = h + a;
        if (!best || score > best.score) {
          if (best) runnerUp = best.score;
          best = { id: m.id ?? 0, score };
        } else if (score > runnerUp) {
          runnerUp = score;
        }
      }
    }
    if (!best || best.score < 2 || best.score <= runnerUp) return null;
    return best.id || null;
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
  // The key carries the matching rules' version: a lookup that failed under
  // the old club-name comparison was cached as "no such match" for a day, so
  // fixing the comparison changed nothing until the stored nulls expired.
  ["fotmob-match-id-v3"],
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

/* -------------------------------------------------------------------------
 * One player.
 * ----------------------------------------------------------------------- */

export interface FmSeasonStat {
  label: string;
  value: string;
}

export interface FmRecentMatch {
  date: number;
  competition: string | null;
  /** The opponent, from this player's point of view. */
  opponent: string;
  home: boolean;
  score: string;
  rating: number | null;
  minutes: number | null;
  goals: number;
  assists: number;
  /** Win, draw or loss for the player's side. */
  outcome: "승" | "무" | "패" | null;
}

export interface FmPlayerPage {
  id: number;
  name: string;
  image: string;
  team: string | null;
  teamId: number | null;
  position: string | null;
  /** Height, age, foot, country, value, contract - whatever was published. */
  facts: { label: string; value: string }[];
  league: string | null;
  season: string | null;
  stats: FmSeasonStat[];
  recent: FmRecentMatch[];
  injury: string | null;
}

const FACT_KO: Record<string, string> = {
  Height: "신장",
  Shirt: "등번호",
  Age: "나이",
  "Preferred foot": "주발",
  Country: "국적",
  "Market value": "시장 가치",
  "Contract end": "계약 만료",
};

const STAT_KO: Record<string, string> = {
  Goals: "골",
  Assists: "도움",
  Started: "선발",
  Matches: "출전",
  "Minutes played": "출전 시간",
  Rating: "평균 평점",
  "Yellow cards": "경고",
  "Red cards": "퇴장",
  "Clean sheets": "무실점",
  "Goals conceded": "실점",
  Saves: "선방",
};

const FOOT_KO: Record<string, string> = {
  Right: "오른발",
  Left: "왼발",
  Both: "양발",
};

interface RawFact {
  title?: string;
  value?: { fallback?: unknown; numberValue?: number; key?: string };
}

/** Turns one of the source's fact objects into a line of text. */
function fact(f: RawFact): { label: string; value: string } | null {
  const title = f.title ?? "";
  const raw = f.value?.fallback;
  let value: string;
  if (typeof raw === "string") value = FOOT_KO[raw] ?? raw;
  else if (typeof raw === "number") value = String(raw);
  else if (raw && typeof raw === "object" && "utcTime" in raw) {
    value = String((raw as { utcTime: string }).utcTime).slice(0, 10);
  } else if (typeof f.value?.numberValue === "number") {
    value = String(f.value.numberValue);
  } else return null;
  if (title === "Height") value = `${value.replace(/\s*cm$/, "")}cm`;
  if (title === "Age") value = `${value.replace(/[^\d]/g, "")}세`;
  return { label: FACT_KO[title] ?? title, value };
}

/**
 * A player's card: who he is, this season's numbers, and his last few matches.
 *
 * Everything is optional because the source fills in what it has - a player at
 * a smaller club may carry no market value and no contract date, and the page
 * simply shows fewer lines rather than empty ones.
 */
export async function fotmobPlayer(id: number): Promise<FmPlayerPage | null> {
  try {
    const res = await fetch(`${API}/playerData?id=${id}`, {
      signal: AbortSignal.timeout(9000),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      id?: number;
      name?: string;
      primaryTeam?: { teamName?: string; teamId?: number };
      positionDescription?: { primaryPosition?: { label?: string } };
      playerInformation?: RawFact[];
      injuryInformation?: { expectedReturn?: string; type?: string } | null;
      mainLeague?: {
        leagueName?: string;
        season?: string;
        stats?: { title?: string; value?: unknown }[];
      };
      recentMatches?: {
        matchDate?: { utcTime?: string };
        leagueName?: string;
        opponentTeamName?: string;
        isHomeTeam?: boolean;
        homeScore?: number;
        awayScore?: number;
        ratingProps?: { rating?: string };
        minutesPlayed?: number;
        goals?: number;
        assists?: number;
        playedInMatch?: boolean;
      }[];
    };
    if (!j.name) return null;

    return {
      id,
      name: j.name,
      image: `https://images.fotmob.com/image_resources/playerimages/${id}.png`,
      team: j.primaryTeam?.teamName ?? null,
      teamId: j.primaryTeam?.teamId ?? null,
      position: j.positionDescription?.primaryPosition?.label ?? null,
      facts: (j.playerInformation ?? [])
        .map(fact)
        .filter((f): f is { label: string; value: string } => f !== null),
      league: j.mainLeague?.leagueName ?? null,
      season: j.mainLeague?.season ?? null,
      stats: (j.mainLeague?.stats ?? [])
        .filter((s) => s.value !== null && s.value !== undefined)
        .map((s) => ({
          label: STAT_KO[s.title ?? ""] ?? s.title ?? "",
          value: String(s.value),
        })),
      /*
       * The last few matches, from this player's side of them.
       *
       * The source gives the opponent rather than the two teams and a flag for
       * which end the player was on, so the result has to be worked out here -
       * a 0:2 is a win or a defeat depending on that flag, and getting it
       * backwards would put a defeat badge on a hat-trick.
       */
      recent: (j.recentMatches ?? [])
        .filter((m) => m.playedInMatch !== false)
        .slice(0, 10)
        .map((m) => {
          const home = m.isHomeTeam !== false;
          const us = home ? (m.homeScore ?? 0) : (m.awayScore ?? 0);
          const them = home ? (m.awayScore ?? 0) : (m.homeScore ?? 0);
          const rating = Number(m.ratingProps?.rating);
          return {
            date: Date.parse(m.matchDate?.utcTime ?? "") || 0,
            competition: m.leagueName ?? null,
            opponent: m.opponentTeamName ?? "?",
            home,
            score: `${us} : ${them}`,
            rating: Number.isFinite(rating) ? rating : null,
            minutes: m.minutesPlayed ?? null,
            goals: m.goals ?? 0,
            assists: m.assists ?? 0,
            outcome: (us > them ? "승" : us === them ? "무" : "패") as
              | "승"
              | "무"
              | "패",
          };
        }),
      injury: j.injuryInformation?.expectedReturn
        ? `복귀 예정 ${j.injuryInformation.expectedReturn}`
        : null,
    };
  } catch {
    return null;
  }
}


/* -------------------------------------------------------------------------
 * The timeline and the statistics.
 * ----------------------------------------------------------------------- */

const STAT_KO_LABEL: Record<string, string> = {
  "Ball possession": "점유율",
  "Expected goals (xG)": "기대 득점 (xG)",
  "xG open play": "오픈 플레이 xG",
  "xG set play": "세트피스 xG",
  "xG non-penalty": "PK 제외 xG",
  "xG on target (xGOT)": "유효슈팅 xG",
  "Total shots": "슈팅",
  "Shots on target": "유효 슈팅",
  "Shots off target": "빗나간 슈팅",
  "Blocked shots": "막힌 슈팅",
  "Hit woodwork": "골대 강타",
  "Shots inside box": "박스 안 슈팅",
  "Shots outside box": "박스 밖 슈팅",
  "Big chances": "결정적 기회",
  "Big chances missed": "결정적 기회 실패",
  "Touches in opposition box": "상대 박스 터치",
  "Accurate passes": "패스 성공",
  Passes: "패스 시도",
  "Own half": "자기 진영 패스",
  "Opposition half": "상대 진영 패스",
  "Accurate long balls": "롱볼 성공",
  "Accurate crosses": "크로스 성공",
  Throws: "스로인",
  Offsides: "오프사이드",
  Corners: "코너킥",
  Tackles: "태클",
  Interceptions: "인터셉트",
  Blocks: "블록",
  Clearances: "클리어",
  "Keeper saves": "선방",
  "Duels won": "듀얼 승리",
  "Ground duels won": "지상 듀얼",
  "Aerial duels won": "공중 듀얼",
  "Successful dribbles": "드리블 성공",
  "Yellow cards": "경고",
  "Red cards": "퇴장",
  "Fouls committed": "파울",
  "Distance covered": "뛴 거리",
  "Sprinting distance": "스프린트 거리",
  "Number of sprints": "스프린트 횟수",
};

const GROUP_KO: Record<string, string> = {
  "Top stats": "요약",
  Shots: "슈팅",
  "Expected goals (xG)": "기대 득점",
  "Physical performance": "활동량",
  Passes: "패스",
  Defence: "수비",
  Duels: "듀얼",
  Discipline: "규율",
};

/**
 * A statistic's two values, as text and as a share of a bar.
 *
 * The source mixes plain numbers with strings like "357 (83%)", and distances
 * arrive in metres as five figure integers. The number that matters for the bar
 * is the leading one; the text is kept as published, except distances, which
 * are read as kilometres because 116566 is not a quantity anyone pictures.
 */
function statPair(title: string, raw: [unknown, unknown]): FmStat | null {
  const [a, b] = raw;
  if (a === null || a === undefined || b === null || b === undefined) return null;

  const isDistance = title.includes("distance") || title === "Distance covered";
  const text = (v: unknown) => {
    if (typeof v === "number" && isDistance) return `${(v / 1000).toFixed(1)}km`;
    return String(v);
  };
  const lead = (v: unknown) => {
    const n = Number(String(v).match(/-?[\d.]+/)?.[0]);
    return Number.isFinite(n) ? n : null;
  };
  const na = lead(a);
  const nb = lead(b);
  return {
    label: STAT_KO_LABEL[title] ?? title,
    home: text(a),
    away: text(b),
    share:
      na === null || nb === null || na + nb === 0 ? null : na / (na + nb),
  };
}

interface RawStatGroup {
  title?: string;
  stats?: { title?: string; stats?: [unknown, unknown]; type?: string }[];
}

function buildStats(json: unknown): FmStatGroup[] {
  const all = (
    json as {
      content?: { stats?: { Periods?: { All?: { stats?: RawStatGroup[] } } } };
    }
  ).content?.stats?.Periods?.All?.stats;
  if (!all) return [];

  const out: FmStatGroup[] = [];
  for (const g of all) {
    const rows: FmStat[] = [];
    for (const s of g.stats ?? []) {
      // A "title" row repeats the group heading and carries no values.
      if (s.type === "title" || !s.stats) continue;
      const pair = statPair(s.title ?? "", s.stats);
      if (pair) rows.push(pair);
    }
    if (rows.length > 0) {
      out.push({ title: GROUP_KO[g.title ?? ""] ?? g.title ?? "", rows });
    }
  }
  return out;
}

interface RawEvent {
  type?: string;
  time?: number;
  overloadTime?: number | null;
  eventId?: number;
  nameStr?: string;
  playerId?: number;
  assistStr?: string;
  assistInput?: { id?: number };
  isHome?: boolean;
  ownGoal?: boolean | null;
  goalDescription?: string | null;
  card?: string;
  newScore?: [number, number];
  swap?: { name?: string; id?: string }[];
  halfStrShort?: string;
  minutesAddedInput?: number;
}

const HALF_KO: Record<string, string> = {
  HT: "하프타임",
  FT: "경기 종료",
};

function buildEvents(json: unknown): FmEvent[] {
  const raw = (
    json as {
      content?: { matchFacts?: { events?: { events?: RawEvent[] } } };
    }
  ).content?.matchFacts?.events?.events;
  if (!raw) return [];

  const out: FmEvent[] = [];
  for (const [i, e] of raw.entries()) {
    const minute =
      e.overloadTime && e.overloadTime > 0
        ? `${e.time}+${e.overloadTime}'`
        : `${e.time}'`;
    const at = (e.time ?? 0) + (e.overloadTime ?? 0) / 100;
    const side: "home" | "away" | null =
      e.isHome === true ? "home" : e.isHome === false ? "away" : null;
    const base = {
      id: String(e.eventId ?? `${e.type}${i}`),
      minute,
      at,
      side,
      score: e.newScore ? `${e.newScore[0]} : ${e.newScore[1]}` : null,
      note: null as string | null,
    };

    if (e.type === "Goal") {
      const pen = (e.goalDescription ?? "").toLowerCase().includes("penalty");
      out.push({
        ...base,
        kind: e.ownGoal ? "own" : pen ? "pen" : "goal",
        player: e.nameStr ?? null,
        playerId: e.playerId ?? null,
        second: e.assistStr?.replace(/^assist by\s*/i, "") ?? null,
        secondId: e.assistInput?.id ?? null,
      });
    } else if (e.type === "Card") {
      out.push({
        ...base,
        kind: e.card === "Red" ? "red" : "yellow",
        player: e.nameStr ?? null,
        playerId: e.playerId ?? null,
        second: null,
        secondId: null,
      });
    } else if (e.type === "Substitution") {
      const [on, off] = e.swap ?? [];
      out.push({
        ...base,
        kind: "sub",
        player: on?.name ?? null,
        playerId: on?.id ? Number(on.id) : null,
        second: off?.name ?? null,
        secondId: off?.id ? Number(off.id) : null,
      });
    } else if (e.type === "Half") {
      out.push({
        ...base,
        kind: "half",
        player: null,
        playerId: null,
        second: null,
        secondId: null,
        note: HALF_KO[e.halfStrShort ?? ""] ?? e.halfStrShort ?? null,
      });
    }
    // Added time and free-text comments are noise on a timeline of this size.
  }
  out.sort((a, b) => a.at - b.at);
  return out;
}

/**
 * The whole report for one of this source's matches.
 *
 * Not cached here at all, deliberately.
 *
 * Measured while a match was being played, the same answer was being held four
 * times over: ten seconds at the source, ten in this project's data cache, ten
 * at the edge and ten in the browser. Stacked, a goal could take forty seconds
 * to reach a reader whose scoreline had already changed five seconds after it
 * went in - which is exactly what a scoreline moving with no scorer beside it
 * looks like.
 *
 * The source's own edge holds a live match for ten seconds and a finished one
 * for an hour, so it already absorbs the load; the only cache kept downstream
 * is a short one at this project's edge, which is what stops many readers of
 * the same match from becoming many requests.
 */
export async function fotmobReportById(id: number): Promise<FmReport | null> {
  try {
    const res = await fetch(`${API}/matchDetails?matchId=${id}`, {
      signal: AbortSignal.timeout(9000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    const lu = (json as { content?: { lineup?: { homeTeam?: RawTeam; awayTeam?: RawTeam } } })
      .content?.lineup;
    const home = team(lu?.homeTeam);
    const away = team(lu?.awayTeam);
    return {
      id,
      lineup: home && away ? { home, away } : null,
      events: buildEvents(json),
      stats: buildStats(json),
    };
  } catch {
    return null;
  }
}

/** The same, found from one of our matches. */
export async function fotmobReport(match: Match): Promise<FmReport | null> {
  const id = await cachedId(
    match.kickoff,
    match.home.sourceName,
    match.away.sourceName,
  );
  if (!id) return null;
  return fotmobReportById(id);
}
