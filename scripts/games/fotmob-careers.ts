import { fotmob } from "./fotmob";

/**
 * Current players' careers and honours from FotMob, to fill what Wikidata
 * has not caught up with.
 *
 * Measured against the original game's own data (7,166 players matched): the
 * clubs and leagues of today's players were where this build fell short -
 * Galatasaray missed 18% of the original's players, the Saudi league 43% -
 * because Wikidata's memberships stop years ago for many of them: Dávinson
 * Sánchez's last club there is Atlético Nacional (2013), Rúben Neves's is
 * Porto (2017). FotMob lists every senior spell with dates, and every trophy
 * by competition and season, for anyone in a squad today.
 *
 * Squads of the leagues the games ask about, then each player once. All of it
 * keyless and cached on disk by `fotmob()`, so a rebuild asks nothing new.
 */
export interface FmSpell {
  team: number;
  name: string;
  start: number | null;
  end: number | null;
  loan: boolean;
}
export interface FmCareer {
  id: number;
  name: string;
  born: number | null;
  spells: FmSpell[];
  /** competition id → seasons won / lost in the final ("2024/2025") */
  won: Map<number, string[]>;
  runnerUp: Map<number, string[]>;
}

interface RawMember { id: number; name: string }
interface RawPlayer {
  id: number;
  name: string;
  birthDate?: { utcTime?: string };
  careerHistory?: {
    careerItems?: Record<string, { teamEntries?: { teamId: number; team: string; startDate?: unknown; endDate?: unknown; transferType?: { text?: string } | null }[] }>;
  };
  trophies?: { playerTrophies?: { tournaments?: { leagueId: number; seasonsWon?: string[]; seasonsRunnerUp?: string[] }[] }[] };
}

// Dates come as "2023-06-14T00:00:00" or, on some entries, { utcTime }.
const year = (d?: unknown): number | null => {
  const v = typeof d === "string" ? d : (d as { utcTime?: string } | null)?.utcTime;
  return typeof v === "string" ? Number(v.slice(0, 4)) || null : null;
};

function teamsIn(table: unknown): { id: number; name: string }[] {
  const out = new Map<number, string>();
  const walk = (o: unknown) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach(walk);
    const r = o as Record<string, unknown>;
    if (typeof r.id === "number" && typeof r.name === "string" && ("pts" in r || "played" in r)) out.set(r.id, r.name);
    for (const k in r) walk(r[k]);
  };
  walk(table);
  return [...out].map(([id, name]) => ({ id, name }));
}

function parseCareer(p: RawPlayer): FmCareer {
  const entries = p.careerHistory?.careerItems?.senior?.teamEntries ?? [];
  const won = new Map<number, string[]>();
  const runnerUp = new Map<number, string[]>();
  for (const team of p.trophies?.playerTrophies ?? [])
    for (const t of team.tournaments ?? []) {
      if (t.seasonsWon?.length) won.set(t.leagueId, [...(won.get(t.leagueId) ?? []), ...t.seasonsWon]);
      if (t.seasonsRunnerUp?.length) runnerUp.set(t.leagueId, [...(runnerUp.get(t.leagueId) ?? []), ...t.seasonsRunnerUp]);
    }
  return {
    id: p.id,
    name: p.name,
    born: year(p.birthDate?.utcTime),
    spells: entries.map((e) => ({
      team: e.teamId,
      name: e.team,
      start: year(e.startDate),
      end: year(e.endDate),
      loan: /loan/i.test(e.transferType?.text ?? "") && !/back from/i.test(e.transferType?.text ?? ""),
    })),
    won,
    runnerUp,
  };
}

export const foldName = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ø/g, "o").replace(/ı/g, "i").replace(/ł/g, "l").replace(/đ/g, "d").toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();

/**
 * A known player looked up by name, for the ones no current squad of the
 * fetched leagues holds - someone now in Qatar, in a second division, or
 * retired since. The search's player suggestions are checked against the
 * birth year on the profile, so a namesake is never taken for him.
 */
export async function searchCareers(
  wanted: { key: string; name: string; born: number }[],
): Promise<Map<string, FmCareer>> {
  const out = new Map<string, FmCareer>();
  const todo = [...wanted];
  let done = 0;
  const worker = async () => {
    while (todo.length) {
      const w = todo.pop()!;
      done++;
      if (done % 500 === 0) process.stdout.write(`\r  fotmob search ${done}/${wanted.length}`);
      const res = await fotmob<{ suggestions?: { type: string; id: string; name: string; isCoach?: boolean }[] }[]>(
        `search/suggest?term=${encodeURIComponent(w.name)}&lang=en`,
      ).catch(() => null);
      const want = foldName(w.name).split(" ");
      const last = want[want.length - 1];
      const cands = [...new Set((res ?? []).flatMap((g) => g.suggestions ?? []).filter((x) => x.type === "player").map((x) => x))]
        .filter((x) => foldName(x.name).split(" ").includes(last))
        .slice(0, 3);
      for (const c of cands) {
        const p = await fotmob<RawPlayer>(`playerData?id=${c.id}`).catch(() => null);
        if (p && year(p.birthDate?.utcTime) === w.born) {
          out.set(w.key, parseCareer(p));
          break;
        }
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  process.stdout.write("\n");
  return out;
}

export async function fotmobCareers(leagues: number[]): Promise<{ careers: FmCareer[]; teamLeague: Map<number, number> }> {
  const teamLeague = new Map<number, number>();
  for (const l of leagues) {
    const data = await fotmob<{ table?: unknown }>(`leagues?id=${l}`).catch(() => null);
    for (const t of teamsIn(data?.table)) if (!teamLeague.has(t.id)) teamLeague.set(t.id, l);
  }
  const playerIds = new Set<number>();
  for (const team of teamLeague.keys()) {
    const data = await fotmob<{ squad?: { squad?: { title: string; members?: RawMember[] }[] } }>(`teams?id=${team}`).catch(() => null);
    for (const g of data?.squad?.squad ?? []) if (g.title !== "coach") for (const m of g.members ?? []) playerIds.add(m.id);
  }
  console.log(`fotmob: ${teamLeague.size} teams, ${playerIds.size} players`);

  const careers: FmCareer[] = [];
  const ids = [...playerIds];
  let done = 0;
  const worker = async () => {
    while (ids.length) {
      const id = ids.pop()!;
      const p = await fotmob<RawPlayer>(`playerData?id=${id}`).catch(() => null);
      done++;
      if (done % 500 === 0) process.stdout.write(`\r  fotmob players ${done}/${playerIds.size}`);
      if (p) careers.push(parseCareer(p));
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  process.stdout.write("\n");
  return { careers, teamLeague };
}
