/**
 * The mystery-player pool for Who Are Ya: today's big-five squads.
 *
 *   npm run games:build   (runs this after the grid build)
 *
 * Squads, shirt numbers, ages, positions, nations and photographs come from
 * FotMob, because they have to be current. Korean names come from Wikidata,
 * joined on date of birth - a key that two footballers in the same five
 * leagues almost never share - and then confirmed by a shared surname.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { sparql, qid, val, chunks } from "./games/wikidata";
import { fotmob } from "./games/fotmob";
import { clubScore, sameClub, samePlayer } from "../lib/names";
import { CLUBS } from "./games/clubs";
import { familiarNames } from "./games/namuwiki";

const OUT = join(process.cwd(), "public", "games");

const LEAGUES = [
  { id: 47, ko: "프리미어리그", q: "Q9448" },
  { id: 87, ko: "라리가", q: "Q324867" },
  { id: 55, ko: "세리에 A", q: "Q15804" },
  { id: 54, ko: "분데스리가", q: "Q82595" },
  { id: 53, ko: "리그 1", q: "Q13394" },
];

const POSITION: Record<string, string> = {
  keeper_long: "GK",
  defender_long: "DF",
  midfielder_long: "MF",
  attacker_long: "FW",
};

const HOME_NATIONS: Record<string, string> = {
  ENG: "잉글랜드",
  SCO: "스코틀랜드",
  WAL: "웨일스",
  NIR: "북아일랜드",
  // Not a FIFA member, so it has no FIFA code on Wikidata to be found by.
  GLP: "과들루프",
  KVX: "코소보",
};

/** Clubs Wikidata has no Korean label for yet. */
const MANUAL_CLUB: Record<string, string> = {
  Augsburg: "아우크스부르크",
};

/** Continents, collapsed to the groups the "close" hint compares. */
const CONTINENT: Record<string, string> = {
  Q46: "EU", Q15: "AF", Q18: "SA", Q48: "AS", Q49: "NA", Q538: "OC", Q3960: "OC", Q55643: "OC",
};

interface Member {
  id: number;
  name: string;
  shirtNumber?: number | null;
  ccode?: string;
  cname?: string;
  role?: { key?: string };
  dateOfBirth?: string;
  transferValue?: number;
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  // --- squads ---------------------------------------------------------------
  type Team = { id: number; name: string; league: number };
  const teams: Team[] = [];
  for (const l of LEAGUES) {
    const d = await fotmob<{ table: { data: { table: { all: { id: number; name: string }[] } } }[] }>(
      `leagues?id=${l.id}`,
    );
    for (const t of d.table[0].data.table.all) teams.push({ id: t.id, name: t.name, league: l.id });
  }

  const squads: { team: Team; m: Member }[] = [];
  for (const team of teams) {
    const d = await fotmob<{ squad: { squad: { title: string; members: Member[] }[] } }>(
      `teams?id=${team.id}&ccode3=KOR`,
    );
    for (const g of d.squad.squad) {
      if (g.title === "coach") continue;
      for (const m of g.members) squads.push({ team, m });
    }
  }
  console.log(`squads: ${teams.length} teams, ${squads.length} players`);

  // --- Korean player names, by date of birth ---------------------------------
  const dates = [...new Set(squads.map((s) => s.m.dateOfBirth).filter(Boolean) as string[])];
  const byDate = new Map<string, { ko: string; en: string }[]>();
  for (const batch of chunks(dates, 120)) {
    const rows = await sparql(`SELECT ?p ?ko ?en ?born WHERE {
      VALUES ?born { ${batch.map((d) => `"${d}T00:00:00Z"^^xsd:dateTime`).join(" ")} }
      ?p wdt:P569 ?born ; wdt:P106 wd:Q937857 ; rdfs:label ?ko FILTER(LANG(?ko) = "ko")
      OPTIONAL { ?p rdfs:label ?en FILTER(LANG(?en) = "en") }
    }`);
    for (const r of rows) {
      const d = val(r, "born")!.slice(0, 10);
      (byDate.get(d) ?? byDate.set(d, []).get(d)!).push({ ko: val(r, "ko")!, en: val(r, "en") ?? "" });
    }
  }

  // --- Korean club names --------------------------------------------------------
  const clubRows = await sparql(`SELECT ?c ?ko ?en WHERE {
    VALUES ?l { ${LEAGUES.map((l) => `wd:${l.q}`).join(" ")} }
    ?c wdt:P118 ?l ; rdfs:label ?ko FILTER(LANG(?ko) = "ko")
    # Players carry a league statement too, so without this "Manchester City"
    # matched Sun Jihai and "Villarreal" matched David Villa.
    FILTER NOT EXISTS { ?c wdt:P31 wd:Q5 }
    OPTIONAL { ?c rdfs:label ?en FILTER(LANG(?en) = "en") }
  }`);
  const short = new Map(CLUBS.map((c) => [c.q, c.short]));
  const clubKo = new Map<number, string>();
  for (const t of teams) {
    /*
     * An exact match first, a word count only as a fallback.
     *
     * By word count alone "AC Milan" tied with "Inter Milan" on "milan" and
     * "Paris FC" with Paris Saint-Germain on "paris", and the first row won:
     * two 인테르 and two PSG in Serie A and Ligue 1. `sameClub` already knows
     * that the extra words of a longer name must be qualifiers, not identity.
     */
    const exact = clubRows.find((r) => sameClub(t.name, val(r, "en") ?? ""));
    let best: { ko: string; q: string; s: number } | null = exact
      ? { ko: val(exact, "ko")!, q: qid(val(exact, "c")), s: 99 }
      : null;
    if (!best) {
      for (const r of clubRows) {
        const s = clubScore(t.name, val(r, "en") ?? "");
        if (s > (best?.s ?? 0)) best = { ko: val(r, "ko")!, q: qid(val(r, "c")), s };
      }
    }
    // The short names the grid already uses where there is one: "맨유", not
    // "맨체스터 유나이티드 FC", in a column that is five characters wide. A
    // trailing Latin abbreviation goes too — "제노아 CFC", "릴 OSC".
    const name = best
      ? (short.get(best.q) ?? best.ko.replace(/\s+[A-Z]{2,4}$/, ""))
      : (MANUAL_CLUB[t.name] ?? t.name);
    clubKo.set(t.id, name);
  }

  // --- nations -------------------------------------------------------------------
  /*
   * FIFA codes live on national-team items, not on countries - measured: with
   * the team items filtered out, every nation came back as its bare code. So
   * the code is read off the team and the name and continent off the country
   * the team belongs to.
   */
  const nationRows = await sparql(`SELECT ?code ?ko ?cont WHERE {
    ?t wdt:P3441 ?code ; wdt:P17 ?c .
    ?c rdfs:label ?ko FILTER(LANG(?ko) = "ko")
    OPTIONAL { ?c wdt:P30 ?cont }
  }`);
  const nations: Record<string, { ko: string; cont: string }> = {};
  for (const r of nationRows) {
    const code = val(r, "code")!.toUpperCase();
    const ko = val(r, "ko");
    const prev = nations[code];
    nations[code] = {
      ko: HOME_NATIONS[code] ?? prev?.ko ?? ko ?? code,
      cont: prev?.cont || CONTINENT[qid(val(r, "cont"))] || "",
    };
  }
  for (const [code, ko] of Object.entries(HOME_NATIONS)) nations[code] = { ko, cont: "EU" };

  // --- join -------------------------------------------------------------------------
  let named = 0;
  const hits = squads.map(({ m }) => {
    const cands = m.dateOfBirth ? (byDate.get(m.dateOfBirth) ?? []) : [];
    return cands.find((c) => samePlayer(c.en, m.name)) ?? null;
  });
  // The name fans use, as on the grid (see games/namuwiki); the Wikipedia
  // spelling stays searchable.
  const familiar = await familiarNames(hits.filter(Boolean).map((h) => h!.ko));
  const players = squads.map(({ team, m }, i) => {
    const hit = hits[i];
    if (hit) named++;
    const ko = hit ? (familiar.get(hit.ko) ?? hit.ko) : null;
    return [
      m.id,
      ko,
      m.name,
      m.shirtNumber ?? null,
      (m.ccode ?? "").toUpperCase(),
      POSITION[m.role?.key ?? ""] ?? "MF",
      m.dateOfBirth ?? null,
      team.id,
      m.transferValue ?? 0,
      hit && ko !== hit.ko ? hit.ko : "",
    ];
  });
  const usedCodes = new Set(players.map((p) => p[4] as string));

  const data = {
    built: new Date().toISOString().slice(0, 10),
    leagues: LEAGUES.map((l) => ({ id: l.id, ko: l.ko })),
    clubs: teams.map((t) => ({ id: t.id, ko: clubKo.get(t.id)!, league: t.league })),
    nations: Object.fromEntries([...usedCodes].map((c) => [c, nations[c] ?? { ko: c, cont: "" }])),
    players,
  };
  writeFileSync(join(OUT, "whoareya.json"), JSON.stringify(data));

  const missingNation = [...usedCodes].filter((c) => !nations[c]);
  const unmatched = teams.filter((t) => clubKo.get(t.id) === t.name).map((t) => t.name);
  console.log(
    `  clubs left in English: ${unmatched.join(", ") || "none"}\n` +
    `whoareya: ${players.length} players, ${named} with a Korean name (${Math.round((named / players.length) * 100)}%)\n` +
      `  nations without a Korean name: ${missingNation.join(", ") || "none"}\n` +
      `  clubs: ${[...clubKo.values()].join(", ")}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
