/**
 * Builds the data behind /games from open sources.
 *
 *   npm run games:build
 *
 * Wikidata (CC0) supplies every player's Korean name, full club career with
 * years, appearances and goals, national team, position and individual awards.
 * FotMob supplies crests, flags and — in build-whoareya — current squads.
 *
 * Nothing here is taken from playfootball.games: its game rules were studied,
 * its player database was not copied. Every answer a game accepts comes from a
 * public statement on Wikidata.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { sparql, qid, val, chunks } from "./games/wikidata";
import { fotmob } from "./games/fotmob";
import { CLUBS, LEAGUES, AWARDS, YOUTH } from "./games/clubs";
import { familiarNames } from "./games/namuwiki";

const OUT = join(process.cwd(), "public", "games");
/*
 * Measured, not assumed: a senior men's side is typed "men's national
 * association football team" (Q135408445) — Argentina, England, Hungary all
 * are — while the youth sides carry the older generic "national association
 * football team" (Q6979593). Reading only the second one put "잉글랜드 U-17"
 * on the board as a nation and left Argentina off it, so Messi came out Spanish
 * by way of his passport.
 */
const SENIOR_NATIONAL = "Q135408445";
const YOUTH_NATIONAL = "Q6979593";
const RESERVE_TEAM = "Q2412834";
const GOALKEEPER = "Q201330";
const LOAN = "Q2914547";

interface Stint {
  club: string;
  start: number | null;
  end: number | null;
  apps: number | null;
  goals: number | null;
  loan: boolean;
}

interface Player {
  q: string;
  ko: string;
  en: string;
  born: number | null;
  links: number;
  stints: Stint[];
  sport: Set<string>;
  citizen: Set<string>;
  positions: Set<string>;
  awards: Set<string>;
  /** other Korean spellings people search by */
  aliases: Set<string>;
}

interface ClubInfo {
  ko: string;
  en: string;
  countries: Set<string>;
  leagues: Set<string>;
  national: boolean;
  seniorNational: boolean;
  reserve: boolean;
}

const year = (v?: string) => (v ? Number(v.slice(0, 4)) || null : null);
const num = (v?: string) => (v === undefined ? null : Math.round(Number(v)));

async function pool(): Promise<Map<string, Player>> {
  const values = CLUBS.map((c) => `wd:${c.q}`).join(" ");
  const rows = await sparql(`SELECT ?p ?ko ?en ?born ?links WHERE {
    VALUES ?club { ${values} }
    ?p p:P54/ps:P54 ?club ; wdt:P106 wd:Q937857 ; wikibase:sitelinks ?links ;
       rdfs:label ?ko . FILTER(LANG(?ko) = "ko")
    # Men's football only, as everywhere else on the site. A club's women's
    # side is a separate item, but the player can still reach the pool through
    # another club — Ji So-yun came through as a Korea hex answer.
    FILTER NOT EXISTS { ?p wdt:P21 wd:Q6581072 }
    OPTIONAL { ?p rdfs:label ?en FILTER(LANG(?en) = "en") }
    OPTIONAL { ?p wdt:P569 ?born }
  }`);
  const out = new Map<string, Player>();
  for (const r of rows) {
    const q = qid(val(r, "p"));
    if (out.has(q)) continue;
    out.set(q, {
      q,
      ko: val(r, "ko")!,
      en: val(r, "en") ?? "",
      born: year(val(r, "born")),
      links: Number(val(r, "links")),
      stints: [],
      sport: new Set(),
      citizen: new Set(),
      positions: new Set(),
      awards: new Set(),
      aliases: new Set(),
    });
  }
  return out;
}

async function details(players: Map<string, Player>, clubs: Map<string, ClubInfo>) {
  const ids = [...players.keys()];
  let n = 0;
  for (const batch of chunks(ids, 250)) {
    const values = batch.map((q) => `wd:${q}`).join(" ");
    const [careers, props] = await Promise.all([
      sparql(`SELECT ?p ?st ?club ?s ?e ?apps ?goals ?how ?cko ?cen ?cc ?cl ?nat WHERE {
        VALUES ?p { ${values} }
        ?p p:P54 ?st . ?st ps:P54 ?club .
        OPTIONAL { ?st pq:P580 ?s } OPTIONAL { ?st pq:P582 ?e }
        OPTIONAL { ?st pq:P1350 ?apps } OPTIONAL { ?st pq:P1351 ?goals }
        OPTIONAL { ?st pq:P1642 ?how }
        OPTIONAL { ?club rdfs:label ?cko FILTER(LANG(?cko) = "ko") }
        OPTIONAL { ?club rdfs:label ?cen FILTER(LANG(?cen) = "en") }
        OPTIONAL { ?club wdt:P17 ?cc }
        OPTIONAL { ?club wdt:P118 ?cl }
        OPTIONAL { ?club wdt:P31 ?nat FILTER(?nat IN (wd:${SENIOR_NATIONAL}, wd:${YOUTH_NATIONAL}, wd:${RESERVE_TEAM})) }
      }`),
      sparql(`SELECT ?p ?k ?v WHERE {
        VALUES ?p { ${values} }
        { ?p wdt:P1532 ?v BIND("s" AS ?k) } UNION { ?p wdt:P27 ?v BIND("c" AS ?k) }
        UNION { ?p wdt:P413 ?v BIND("p" AS ?k) } UNION { ?p wdt:P166 ?v BIND("a" AS ?k) }
        UNION { ?p skos:altLabel ?v FILTER(LANG(?v) = "ko") BIND("k" AS ?k) }
      }`),
    ]);

    const seen = new Set<string>();
    for (const r of careers) {
      const p = players.get(qid(val(r, "p")))!;
      const club = qid(val(r, "club"));
      const info =
        clubs.get(club) ??
        clubs
          .set(club, {
            ko: "", en: "", countries: new Set(), leagues: new Set(),
            national: false, seniorNational: false, reserve: false,
          })
          .get(club)!;
      if (val(r, "cko")) info.ko = val(r, "cko")!;
      if (val(r, "cen")) info.en = val(r, "cen")!;
      if (val(r, "cc")) info.countries.add(qid(val(r, "cc")));
      if (val(r, "cl")) info.leagues.add(qid(val(r, "cl")));
      const type = qid(val(r, "nat"));
      if (type === SENIOR_NATIONAL) info.national = info.seniorNational = true;
      if (type === YOUTH_NATIONAL) info.national = true;
      if (type === RESERVE_TEAM) info.reserve = true;

      // One statement can come back several times, once per country/league.
      const st = val(r, "st")!;
      if (seen.has(st)) continue;
      seen.add(st);
      p.stints.push({
        club,
        start: year(val(r, "s")),
        end: year(val(r, "e")),
        apps: num(val(r, "apps")),
        goals: num(val(r, "goals")),
        loan: qid(val(r, "how")) === LOAN,
      });
    }
    for (const r of props) {
      const p = players.get(qid(val(r, "p")))!;
      const k = val(r, "k");
      if (k === "k") {
        p.aliases.add(val(r, "v")!);
        continue;
      }
      const v = qid(val(r, "v"));
      if (k === "s") p.sport.add(v);
      else if (k === "c") p.citizen.add(v);
      else if (k === "p") p.positions.add(v);
      else if (k === "a") p.awards.add(v);
    }
    n += batch.length;
    process.stdout.write(`\r  details ${n}/${ids.length}`);
  }
  process.stdout.write("\n");
}

/** Senior national teams: their country, Korean name and flag code. */
async function nationalTeams(teams: string[]) {
  const out = new Map<string, { country: string; ko: string; en: string; fifa: string; continent: string }>();
  for (const batch of chunks(teams, 300)) {
    const rows = await sparql(`SELECT ?t ?ko ?en ?cko ?c ?fifa ?cfifa ?cont WHERE {
      VALUES ?t { ${batch.map((q) => `wd:${q}`).join(" ")} }
      OPTIONAL { ?t rdfs:label ?ko FILTER(LANG(?ko) = "ko") }
      OPTIONAL { ?t rdfs:label ?en FILTER(LANG(?en) = "en") }
      OPTIONAL { ?t wdt:P17 ?c .
        OPTIONAL { ?c rdfs:label ?cko FILTER(LANG(?cko) = "ko") }
        OPTIONAL { ?c wdt:P3441 ?cfifa } OPTIONAL { ?c wdt:P30 ?cont } }
      OPTIONAL { ?t wdt:P3441 ?fifa }
    }`);
    for (const r of rows) {
      const t = qid(val(r, "t"));
      const prev = out.get(t);
      // The country's own name, not the team's: "프랑스", where the team's
      // label was missing on several of the biggest sides and would otherwise
      // have to be cut down from "프랑스 축구 국가대표팀" by pattern.
      const teamName = (val(r, "ko") ?? "").replace(/\s*(남자\s*)?축구\s*국가\s*대표\s*팀$/, "").trim();
      const fifa = (prev?.fifa || val(r, "fifa") || val(r, "cfifa") || "").toUpperCase();
      out.set(t, {
        country: prev?.country || qid(val(r, "c")),
        // The home nations share a country on Wikidata — England, Scotland,
        // Wales and Northern Ireland all answered "영국" — but not a team, a
        // flag or a football identity, so they are named by their FIFA code.
        ko: HOME_NATIONS[fifa] ?? (prev?.ko || val(r, "cko") || teamName || ""),
        en: prev?.en || val(r, "en") || "",
        fifa,
        continent: prev?.continent || qid(val(r, "cont")),
      });
    }
  }
  return out;
}

const HOME_NATIONS: Record<string, string> = {
  ENG: "잉글랜드",
  SCO: "스코틀랜드",
  WAL: "웨일스",
  NIR: "북아일랜드",
};

/**
 * Sides with national-team status but no FIFA membership. Catalonia came out
 * as a second "스페인" with 377 players, which is what happens when a regional
 * select plays friendlies against the same people.
 */
const NOT_A_NATION = /catalonia|basque|galicia|padania|andalusia|olympic|\bB\b/i;

async function crestIds(): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const c of CLUBS) {
    const res = await fotmob<{ suggestions?: { type: string; id: string }[] }[]>(
      `search/suggest?term=${encodeURIComponent(c.search)}&lang=en`,
    );
    const team = res.flatMap((g) => g.suggestions ?? []).find((s) => s.type === "team");
    if (team) out.set(c.q, Number(team.id));
  }
  return out;
}

const REGIONS: { id: string; short: string; continents: string[] }[] = [
  { id: "rg-afr", short: "아프리카", continents: ["Q15"] },
  { id: "rg-sam", short: "남미", continents: ["Q18"] },
  { id: "rg-asia", short: "아시아·오세아니아", continents: ["Q48", "Q538", "Q3960", "Q55643"] },
  { id: "rg-nca", short: "북중미", continents: ["Q49"] },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const t0 = Date.now();

  const players = await pool();
  console.log(`pool: ${players.size} players with a Korean name`);
  const clubs = new Map<string, ClubInfo>();
  await details(players, clubs);

  const senior = (s: Stint) => {
    const c = clubs.get(s.club);
    return c && !c.national && !c.reserve && !YOUTH.test(c.en);
  };
  const seniorNational = (club: string) => {
    const c = clubs.get(club);
    return !!c?.seniorNational && !YOUTH.test(c.en) && !/\bwomen/i.test(c.en);
  };
  const teamIds = [...clubs].filter(([q]) => seniorNational(q)).map(([q]) => q);
  const teams = await nationalTeams(teamIds);
  // Uncapped players fall back to the country they declared for.
  const teamByCountry = new Map<string, string>();
  for (const [t, info] of teams) if (info.country && !teamByCountry.has(info.country)) teamByCountry.set(info.country, t);

  const crests = await crestIds();
  console.log(`crests: ${crests.size}/${CLUBS.length}`);

  // --- categories --------------------------------------------------------
  type Cat = { id: string; short: string; kind: string; img?: string };
  const cats: Cat[] = [];
  const members = new Map<string, Set<string>>();
  const add = (cat: string, p: string) =>
    (members.get(cat) ?? members.set(cat, new Set()).get(cat)!).add(p);

  for (const c of CLUBS) {
    const id = `cl-${c.q}`;
    const crest = crests.get(c.q);
    cats.push({ id, short: c.short, kind: "club", img: crest ? `t:${crest}` : undefined });
  }
  for (const l of LEAGUES) cats.push({ id: l.id, short: l.short, kind: "league" });
  for (const r of REGIONS) cats.push({ id: r.id, short: r.short, kind: "region" });
  for (const a of AWARDS) cats.push({ id: `aw-${a.q}`, short: a.short, kind: "award" });
  for (const d of [1970, 1980, 1990, 2000]) cats.push({ id: `dc-${d}`, short: `${String(d).slice(2)}년대생`, kind: "decade" });
  cats.push({ id: "ps-gk", short: "골키퍼", kind: "position" });

  const nationOf = (p: Player): string | null => {
    // The most recent senior side, for the few who switched allegiance.
    const capped = p.stints
      .filter((s) => seniorNational(s.club))
      .sort((a, b) => (b.start ?? 0) - (a.start ?? 0))[0];
    if (capped) return capped.club;
    for (const c of [...p.sport, ...p.citizen]) if (teamByCountry.has(c)) return teamByCountry.get(c)!;
    return null;
  };

  for (const p of players.values()) {
    const seniorStints = p.stints.filter(senior);
    for (const s of seniorStints) add(`cl-${s.club}`, p.q);
    for (const l of LEAGUES) {
      const hit = seniorStints.some((s) => {
        const c = clubs.get(s.club)!;
        return l.country ? c.countries.has(l.country) : l.leagues!.some((x) => c.leagues.has(x));
      });
      if (hit) add(l.id, p.q);
    }
    const nation = nationOf(p);
    if (nation) {
      add(`nt-${nation}`, p.q);
      const cont = teams.get(nation)?.continent;
      for (const r of REGIONS) if (cont && r.continents.includes(cont)) add(r.id, p.q);
    }
    for (const a of AWARDS) if (p.awards.has(a.q)) add(`aw-${a.q}`, p.q);
    if (p.born) {
      const d = Math.floor(p.born / 10) * 10;
      if (d >= 1970 && d <= 2000) add(`dc-${d}`, p.q);
    }
    if (p.positions.has(GOALKEEPER)) add("ps-gk", p.q);
  }

  // Nations: only the ones with enough players to make a fair hex.
  const named = new Set<string>();
  const nations = [...members]
    // Korea is kept below the usual bar on purpose: this is a Korean site, and
    // "a Korean who played for Tottenham" is the hex its readers will want most.
    .filter(
      ([id, set]) =>
        id.startsWith("nt-") &&
        (set.size >= 40 || (teams.get(id.slice(3))?.fifa === "KOR" && set.size >= 8)),
    )
    .sort((a, b) => b[1].size - a[1].size)
    .filter(([id]) => {
      const t = teams.get(id.slice(3))!;
      if (!t.ko || NOT_A_NATION.test(t.en) || named.has(t.ko)) return false;
      named.add(t.ko);
      return true;
    })
    .slice(0, 40);
  for (const [id] of nations) {
    const t = teams.get(id.slice(3))!;
    cats.push({ id, short: t.ko, kind: "nation", img: t.fifa ? `t:${t.fifa.toLowerCase()}` : undefined });
  }

  // Only categories that can actually be answered stay on the board.
  const usable = cats.filter((c) => (members.get(c.id)?.size ?? 0) >= 8);

  const list = [...players.values()]
    .map((p) => ({
      p,
      v: usable.map((c, i) => (members.get(c.id)?.has(p.q) ? i : -1)).filter((i) => i >= 0),
    }))
    // A player who ticks nothing on any board is only noise in the search box.
    .filter((x) => x.v.length > 0)
    .sort((a, b) => b.p.links - a.p.links);

  // Pairs of categories that share enough players to sit side by side.
  const pairs: [number, number, number][] = [];
  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      const a = members.get(usable[i].id)!;
      const b = members.get(usable[j].id)!;
      let n = 0;
      for (const x of a) if (b.has(x)) n++;
      if (n >= 2) pairs.push([i, j, n]);
    }
  }

  /*
   * Show the name fans use, search by every name.
   *
   * The familiar name comes from Namuwiki's redirects (see games/namuwiki) for
   * the best-known players - the ones people will actually type. Every other
   * spelling stays searchable: the Wikipedia form, and Wikidata's own Korean
   * aliases ("버질 반 다이크", "엘링 홀란드").
   */
  // The best-known 3,000, plus everyone famous enough to be a Career Path answer.
  const famous = list.filter((x, i) => i < 3000 || x.p.links >= 45).map(({ p }) => p.ko);
  const familiar = await familiarNames(famous);
  const display = (p: Player) => familiar.get(p.ko) ?? p.ko;
  const alts = (p: Player) =>
    [...new Set([p.ko, ...p.aliases])].filter((a) => a !== display(p) && /[가-힣]/.test(a));
  console.log(`familiar names: ${familiar.size} of ${famous.length} differ from Wikipedia's`);

  const grid = {
    built: new Date().toISOString().slice(0, 10),
    source: "Wikidata (CC0)",
    cats: usable.map((c) => ({ ...c, n: members.get(c.id)!.size })),
    pairs,
    players: list.map(({ p, v }) => [display(p), p.en, p.born ?? 0, p.links, v, alts(p).join("|")]),
  };
  writeFileSync(join(OUT, "grid.json"), JSON.stringify(grid));

  // --- career path -------------------------------------------------------
  const career = [...players.values()]
    .filter((p) => p.links >= 45 && (p.born ?? 0) >= 1955)
    .map((p) => {
      const rows = p.stints
        .filter((s) => senior(s) && s.start)
        .sort((a, b) => a.start! - b.start! || (a.end ?? 9999) - (b.end ?? 9999))
        .map((s) => [s.start, s.end, clubs.get(s.club)!.ko || clubs.get(s.club)!.en, s.apps, s.goals, s.loan ? 1 : 0]);
      /*
       * One row per country, the one with the most caps.
       *
       * A switch of allegiance is two real rows (Thiago Motta: Brazil, then
       * Italy). But 22 of 600 answers had the same country twice, and the
       * smaller row was an under-21 spell typed as the senior side — David
       * Villa's "Spain 2001–2002, 32 caps, 27 goals".
       */
      const byNation = new Map<string, (string | number | null)[]>();
      for (const s of p.stints) {
        if (!seniorNational(s.club) || !s.start) continue;
        const name = teams.get(s.club)?.ko ?? "";
        const row = [s.start, s.end, name, s.apps, s.goals];
        const prev = byNation.get(name);
        if (!prev || (s.apps ?? 0) > ((prev[3] as number | null) ?? 0)) byNation.set(name, row);
      }
      const intl = [...byNation.values()].sort((a, b) => (a[0] as number) - (b[0] as number));
      return { p, rows, intl };
    })
    // Enough rows to make a puzzle, and every row readable in Korean.
    .filter((c) => c.rows.length >= 4 && c.rows.every((r) => /[가-힣]/.test(String(r[2]))))
    .sort((a, b) => b.p.links - a.p.links)
    .slice(0, 600)
    .map((c) => ({ ko: display(c.p), en: c.p.en, born: c.p.born, clubs: c.rows, intl: c.intl }));
  writeFileSync(join(OUT, "career.json"), JSON.stringify(career));

  console.log(
    `grid: ${usable.length} categories, ${list.length} players, ${pairs.length} pairs\n` +
      `career: ${career.length} answers\n` +
      `done in ${((Date.now() - t0) / 1000).toFixed(0)}s`,
  );
  const top = (id: string) => members.get(id)?.size ?? 0;
  console.log("sample sizes:", usable.slice(0, 50).map((c) => `${c.short}:${top(c.id)}`).join(" "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
