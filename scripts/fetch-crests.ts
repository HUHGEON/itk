/**
 * Fills in team crests and football-data.org IDs in data/teams.json.
 *
 * FotMob has no public API and blocks its internal endpoints, so crests come
 * from football-data.org (free key, 10 req/min) with TheSportsDB as a no-key
 * fallback. Six competition calls cover every team in the registry.
 *
 *   FOOTBALL_DATA_TOKEN=xxx npm run crests
 *   npm run crests            # 토큰 없으면 TheSportsDB만 사용
 *
 * 무료 키 발급: https://www.football-data.org/client/register
 */
import "../lib/load-env";
import fs from "node:fs";
import path from "node:path";
import type { Team } from "../lib/types";

const COMPETITIONS: Record<string, string> = {
  EPL: "PL",
  LaLiga: "PD",
  Bundesliga: "BL1",
  SerieA: "SA",
  Ligue1: "FL1",
  Eredivisie: "DED",
};

interface FdTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
}

const TEAMS_PATH = path.join(process.cwd(), "data", "teams.json");

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\b(fc|cf|afc|rcd|vfl|vfb|as|ac|ss|us|sv|bv|1899|04|09)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

async function fromFootballData(token: string): Promise<Map<string, FdTeam>> {
  const found = new Map<string, FdTeam>();

  for (const code of new Set(Object.values(COMPETITIONS))) {
    const res = await fetch(`https://api.football-data.org/v4/competitions/${code}/teams`, {
      headers: { "X-Auth-Token": token },
    });
    if (!res.ok) {
      console.warn(`⚠ ${code}: HTTP ${res.status} — 건너뜁니다`);
      continue;
    }
    const body = (await res.json()) as { teams: FdTeam[] };
    for (const t of body.teams) {
      for (const key of [t.name, t.shortName].filter(Boolean)) {
        found.set(norm(key), t);
      }
    }
    console.log(`  ${code}: ${body.teams.length}팀`);
    // Free tier allows 10 requests/minute.
    await new Promise((r) => setTimeout(r, 6500));
  }

  return found;
}

async function fromSportsDb(name: string): Promise<string | null> {
  const url = `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(name)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const body = (await res.json()) as {
      teams: { strTeam: string; strBadge?: string; strTeamBadge?: string }[] | null;
    };
    const hit = body.teams?.[0];
    return hit?.strBadge ?? hit?.strTeamBadge ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const teams = JSON.parse(fs.readFileSync(TEAMS_PATH, "utf8")) as Team[];
  const token = process.env.FOOTBALL_DATA_TOKEN;

  const fd = token ? await fromFootballData(token) : new Map<string, FdTeam>();
  if (!token) {
    console.log("FOOTBALL_DATA_TOKEN 없음 — TheSportsDB만 사용합니다.");
  }

  let matched = 0;
  const missing: string[] = [];

  for (const team of teams) {
    const hit = fd.get(norm(team.en)) ?? fd.get(norm(team.aliases[0] ?? ""));
    if (hit) {
      team.crest = hit.crest;
      team.fdId = hit.id;
      matched++;
      continue;
    }

    // TheSportsDB is picky about punctuation ("Paris Saint-Germain" misses,
    // "Paris Saint Germain" hits), so try the aliases too.
    let badge: string | null = null;
    for (const name of [team.en, ...team.aliases, team.en.replace(/-/g, " ")]) {
      badge = await fromSportsDb(name);
      if (badge) break;
    }

    if (badge) {
      team.crest = badge;
      matched++;
    } else {
      missing.push(team.ko);
    }
  }

  fs.writeFileSync(TEAMS_PATH, JSON.stringify(teams, null, 2) + "\n");
  console.log(`✓ ${matched}/${teams.length}팀 엠블럼 확보`);
  if (missing.length) console.log(`  미확보: ${missing.join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
