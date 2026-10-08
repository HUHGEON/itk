/**
 * Builds the data behind /games from open sources.
 *
 *   npm run games:build
 *
 * Wikidata (CC0) supplies every player's Korean name, full club career with
 * years, appearances and goals, national team, position, and every season's
 * trophy winners.
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
import { fotmobCareers, searchCareers, type FmCareer } from "./games/fotmob-careers";
import { CLUBS, LEAGUES, TROPHIES, YOUTH } from "./games/clubs";
import { familiarNames } from "./games/namuwiki";
import { commonNames, redirectNames } from "./games/kowiki";
import manualAliases from "../data/games/aliases.json";

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

/*
 * Wikidata's positions (P413) folded into the four a fan names a player by,
 * to tell two players of one name apart in the search box. Counted over the
 * 40k pool: midfielder 20k, forward 16k, defender 13k, goalkeeper 6k, then
 * wing half, full-back, centre-back and a long tail of rarer terms.
 */
const POSITION: Record<string, "G" | "D" | "M" | "F"> = {
  Q201330: "G", Q172964: "G", Q1317534: "G",
  Q336286: "D", Q268258: "D", Q90173132: "D", Q107213256: "D", Q1489923: "D", Q3522468: "D", Q1109563: "D",
  Q193592: "M", Q18691898: "M", Q6008848: "M", Q90326494: "M", Q8025128: "M", Q904289: "M", Q1201458: "M",
  Q16501245: "M", Q114358125: "M",
  Q280658: "F", Q543457: "F", Q3446915: "F", Q9731197: "F", Q1642283: "F", Q6037916: "F", Q11681748: "F",
  Q1369558: "F", Q2827965: "F", Q114358150: "F", Q114358158: "F", Q18451027: "F",
};
/** "M" or "MF" - pitch order, at most two. */
const positions = (p: Player) =>
  "GDMF".split("").filter((c) => [...p.positions].some((q) => POSITION[q] === c)).slice(0, 2).join("");

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

/*
 * Who can be an answer.
 *
 * This used to be "played for one of the 37 club hexes", which was fine while
 * the board was mostly clubs. With trophies, leagues and nations on it, it
 * left out right answers: Vardy (an EPL winner with Leicester), and Lee
 * Chung-yong, Koo Ja-cheol and Hwang Ui-jo (all Korea hexes) were nowhere in
 * the search box. Now it is every men's footballer with a Korean name
 * (33,213 measured) plus the well-known ones without one (15+ Wikipedia
 * editions, 8,106 measured; they are searched and shown in English), and the
 * build keeps whoever can answer at least one real hex.
 */
async function pool(): Promise<Map<string, Player>> {
  const out = new Map<string, Player>();
  const add = (rows: Awaited<ReturnType<typeof sparql>>) => {
    for (const r of rows) {
      const q = qid(val(r, "p"));
      if (out.has(q)) continue;
      out.set(q, {
        q,
        ko: val(r, "ko") ?? "",
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
  };
  // Men's football only, as everywhere else on the site - Ji So-yun once came
  // through as a Korea hex answer.
  add(
    await sparql(`SELECT ?p ?ko ?en ?born ?links WHERE {
      ?p wdt:P106 wd:Q937857 ; wikibase:sitelinks ?links ;
         rdfs:label ?ko . FILTER(LANG(?ko) = "ko")
      FILTER NOT EXISTS { ?p wdt:P21 wd:Q6581072 }
      OPTIONAL { ?p rdfs:label ?en FILTER(LANG(?en) = "en") }
      OPTIONAL { ?p wdt:P569 ?born }
    }`),
  );
  add(
    await sparql(`SELECT ?p ?en ?born ?links WHERE {
      ?p wdt:P106 wd:Q937857 ; wikibase:sitelinks ?links FILTER(?links >= 15)
      FILTER NOT EXISTS { ?p rdfs:label ?ko FILTER(LANG(?ko) = "ko") }
      FILTER NOT EXISTS { ?p wdt:P21 wd:Q6581072 }
      ?p rdfs:label ?en FILTER(LANG(?en) = "en")
      OPTIONAL { ?p wdt:P569 ?born }
    }`),
  );
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
        UNION { ?w schema:about ?p ; schema:isPartOf <https://ko.wikipedia.org/> ; schema:name ?v BIND("w" AS ?k) }
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
      if (k === "w") {
        /*
         * The Korean Wikipedia article's title, less its disambiguator: the
         * name the player is known by. Wikidata's Korean label is sometimes
         * the legal name instead - Jorginho is labelled "조르지 루이스
         * 프렐루" while his article is "조르지뉴 (1991년)", so typing 조르지뉴
         * found only the 1964 Brazilian. The shorter of the two is shown
         * (Rodri stays 로드리, not his article's 로드리 에르난데스); the other
         * stays searchable.
         */
        const title = val(r, "v")!.replace(/\s*\([^)]*\)\s*$/, "").trim();
        if (title && !p.ko && /[가-힣]/.test(title)) p.ko = title;
        else if (title && title !== p.ko && /[가-힣]/.test(title)) {
          const [short, long] =
            title.replace(/\s+/g, "").length < p.ko.replace(/\s+/g, "").length ? [title, p.ko] : [p.ko, title];
          p.ko = short;
          p.aliases.add(long);
        }
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

/**
 * Regions, as the original groups them: four continents and four clusters of
 * nations (its helper texts list the members). A region is read off the
 * player's nation - by continent, or by FIFA code for the clusters.
 */
const REGIONS: { id: string; short: string; continents?: string[]; fifa?: string[] }[] = [
  { id: "rg-afr", short: "아프리카", continents: ["Q15"] },
  { id: "rg-sam", short: "남미", continents: ["Q18"] },
  { id: "rg-asia", short: "아시아·오세아니아", continents: ["Q48", "Q538", "Q3960", "Q55643"] },
  { id: "rg-nca", short: "북중미", continents: ["Q49"] },
  { id: "rg-nor", short: "북유럽", fifa: ["NOR", "SWE", "DEN", "FIN", "ISL"] },
  { id: "rg-celt", short: "켈트 국가", fifa: ["SCO", "WAL", "NIR", "IRL"] },
  { id: "rg-balk", short: "발칸", fifa: ["ALB", "BIH", "BUL", "CRO", "GRE", "KVX", "MNE", "MKD", "ROU", "SRB", "SVN"] },
  { id: "rg-naf", short: "북아프리카", fifa: ["ALG", "EGY", "LBY", "MAR", "SDN", "TUN"] },
];

/** A season: who won it and the calendar years it spans. */
interface Season {
  /** the season or edition item */
  q?: string;
  comp: string;
  winner: string;
  from: number;
  to: number;
}

/**
 * Every season's winner for the trophy competitions, and every Champions
 * League final's two sides. Measured: 13 competitions, 800-odd seasons with a
 * winner; 51 seasons carry no date, only a label like "1965–66 FA Cup", so the
 * years come from the label when the dates are missing.
 */
async function winners(): Promise<{ seasons: Season[]; finals: Season[]; squads: Map<string, Set<string>> }> {
  const comps = [...new Set(TROPHIES.flatMap((t) => t.comps))].map((q) => `wd:${q}`).join(" ");
  const span = (label: string, s?: string, e?: string, d?: string) => {
    const m = label.match(/(\d{4})(?:\s*[–-]\s*(\d{2,4}))?/);
    const a = year(s) ?? year(d) ?? (m ? Number(m[1]) : null);
    if (!a) return null;
    let b = year(e) ?? year(d);
    if (!b && m?.[2]) b = m[2].length === 2 ? Math.floor(a / 100) * 100 + Number(m[2]) : Number(m[2]);
    return { from: a, to: Math.max(a, b ?? a) };
  };
  const rows = await sparql(`SELECT ?season ?comp ?w ?l ?s ?e ?d WHERE {
    VALUES ?comp { ${comps} }
    ?season wdt:P3450 ?comp ; wdt:P1346 ?w ; rdfs:label ?l FILTER(LANG(?l) = "en")
    OPTIONAL { ?season wdt:P580 ?s } OPTIONAL { ?season wdt:P582 ?e } OPTIONAL { ?season wdt:P585 ?d }
  }`);
  const seasons: Season[] = [];
  for (const r of rows) {
    const y = span(val(r, "l")!, val(r, "s"), val(r, "e"), val(r, "d"));
    if (y) seasons.push({ q: qid(val(r, "season")), comp: qid(val(r, "comp")), winner: qid(val(r, "w")), ...y });
  }
  // Only the final itself: a season's other matches (semi-finals, the
  // super cup) are "part of" it too, and counting them put 3,222 players in
  // "UCL 결승".
  /*
   * The finals, found two ways and merged by item. By label alone 1999 and
   * 2015 were missing - measured: 68 of 70 - because the 1999 final is
   * labelled "1999 champions league final" in lower case and the 2015 one's
   * English label had been vandalised to "Davo mercenario", so Barcelona's and
   * Manchester United's squads were not "UCL 결승" (Vermaelen, reported). The
   * class "UEFA Champions League final" (Q80716240) has both, but not 2025;
   * the label, read case-insensitively, has 2025.
   */
  const byClass = await sparql(`SELECT ?final ?team ?d WHERE {
    ?final wdt:P31 wd:Q80716240 ; wdt:P1923 ?team ; wdt:P585 ?d .
  }`);
  const byLabel = await sparql(`SELECT ?final ?team ?d WHERE {
    ?season wdt:P3450 wd:Q18756 . ?final wdt:P361 ?season ; wdt:P1923 ?team ; wdt:P585 ?d ;
      rdfs:label ?fl FILTER(LANG(?fl) = "en" && REGEX(?fl, "^[0-9]{4} (European Cup|UEFA Champions League|Champions League) Final$", "i"))
  }`);
  const fin = [...new Map([...byClass, ...byLabel].map((r) => [`${val(r, "final")}|${val(r, "team")}`, r])).values()];
  // A final in May closes the season that began the summer before.
  const finals = fin.map((r) => {
    const y = year(val(r, "d"))!;
    return { comp: "final", winner: qid(val(r, "team")), from: y - 1, to: y };
  });

  /*
   * Tournament squads. Players carry "participant in" (P1344) for the
   * tournaments they were picked for - measured complete for recent World
   * Cups (2014: 734 players, 32 squads of 23) - so a national trophy is read
   * exactly where the edition is covered: in that squad, and a player of the
   * side that won it. Thinly covered editions fall back to the years.
   */
  const national = new Set(TROPHIES.filter((t) => t.national).flatMap((t) => t.comps));
  const editions = seasons.filter((x) => national.has(x.comp) && x.q).map((x) => `wd:${x.q}`);
  const squads = new Map<string, Set<string>>();
  for (const batch of chunks(editions, 40)) {
    const got = await sparql(`SELECT ?e ?p WHERE { VALUES ?e { ${batch.join(" ")} } ?p wdt:P1344 ?e }`);
    for (const r of got) {
      const e = qid(val(r, "e"));
      (squads.get(e) ?? squads.set(e, new Set()).get(e)!).add(qid(val(r, "p")));
    }
  }
  return { seasons, finals, squads };
}

/** An edition counts as covered when about a squad per team is listed. */
const SQUAD_COVERED = 150;

/**
 * Was the player with this side for this season?
 *
 * Spells are in whole years, and most moves happen in the summer, so a
 * season that runs August Y1 to May Y2 is read as needing the spell to begin
 * by Y1 and end no earlier than Y2. Measured against FotMob's trophy lists
 * for 60 players: the looser "any overlap" rule found every real winner but
 * a third of its matches were wrong - a spell ending in the summer of 2014
 * was being credited with 2014-15.
 *
 * A season spent out on loan is not the parent club's: Lukaku and Mount were
 * at West Brom and Derby the year Chelsea won the Europa League, and the
 * parent-club spell covering those years had credited them with it.
 */
function wasThere(stints: Stint[], team: string, from: number, to: number): boolean {
  const covers = (st: Stint) => st.start !== null && st.start <= from && (st.end ?? 9999) >= to;
  if (stints.some((st) => st.loan && st.club !== team && covers(st))) return false;
  return stints.some((st) => st.club === team && covers(st));
}

/** The big five leagues, for "played in three or more of them". */
const BIG5 = ["lg-eng", "lg-esp", "lg-ita", "lg-ger", "lg-fra"];

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
  /*
   * Each country's real side: the one with the most players. A country's
   * FIFA code is all most teams carry, so regional selections share it -
   * Padania read as Italy, Catalonia as Spain - and taking the first team
   * per country had mapped every uncapped Italian to Padania (Ranieri,
   * measured). The real side outnumbers them by hundreds. The four home
   * nations share the United Kingdom and are kept apart by their codes.
   */
  const capped = new Map<string, number>();
  for (const p of players.values()) for (const t of new Set(p.stints.map((s) => s.club))) if (teams.has(t)) capped.set(t, (capped.get(t) ?? 0) + 1);
  const teamByCountry = new Map<string, string>();
  for (const [t, info] of teams) {
    if (!info.country) continue;
    const cur = teamByCountry.get(info.country);
    if (!cur || (capped.get(t) ?? 0) > (capped.get(cur) ?? 0)) teamByCountry.set(info.country, t);
  }
  const HOME = new Set(Object.keys(HOME_NATIONS));
  // Citizenship is sometimes the realm rather than the country: Louis van
  // Gaal's is the Kingdom of the Netherlands (Q29999), not the Netherlands
  // (Q55) its team belongs to.
  for (const [realm, country] of [["Q29999", "Q55"], ["Q756617", "Q35"]])
    if (teamByCountry.has(country) && !teamByCountry.has(realm)) teamByCountry.set(realm, teamByCountry.get(country)!);
  const realSide = (t: string) => {
    const info = teams.get(t);
    return !!info && (HOME.has(info.fifa) || teamByCountry.get(info.country) === t);
  };

  const crests = await crestIds();

  /*
   * Today's players, from FotMob: the spells and honours Wikidata has not
   * caught up with (see games/fotmob-careers). Matched by name and birth
   * year; only ever adds - a category Wikidata gives is never taken away.
   */
  const fold = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ø/g, "o").replace(/ı/g, "i").replace(/ł/g, "l").toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
  const { careers, teamLeague } = await fotmobCareers(LEAGUES.map((l) => l.logo));
  const clubByFm = new Map([...crests].map(([q, id]) => [id, q]));
  const leagueByFm = new Map(LEAGUES.map((l) => [l.logo, l.id]));
  const byNameYear = new Map<string, Player[]>();
  for (const p of players.values()) {
    const k = `${fold(p.en)}|${p.born}`;
    byNameYear.set(k, [...(byNameYear.get(k) ?? []), p]);
  }
  // Every career found, squad first then search, keyed by the player.
  const fmCareer = new Map<string, FmCareer>();
  let fmMatched = 0;
  for (const c of careers) {
    const hit = byNameYear.get(`${fold(c.name)}|${c.born}`);
    if (!hit || hit.length !== 1) continue;
    fmMatched++;
    fmCareer.set(hit[0].q, c);
  }
  /*
   * Everyone else with a career since the 2000s and some fame, looked up by
   * name (see searchCareers): the squads above only hold who is in those
   * fourteen leagues today, and "recent transfers missing" was reported for
   * players well beyond them.
   */
  const wanted = [...players.values()]
    .filter((p) => !fmCareer.has(p.q) && p.born && p.born >= 1983 && p.links >= 20 && p.en)
    .map((p) => ({ key: p.q, name: p.en, born: p.born! }));
  const found = await searchCareers(wanted);
  for (const [q, c] of found) fmCareer.set(q, c);
  console.log(`fotmob by search: ${found.size} of ${wanted.length}`);

  /*
   * A club outside today's fourteen tables - relegated since, or a spell in a
   * second division - has no league from the squads; its country on FotMob
   * gives it one. England and Scotland are leagues of their own.
   */
  const LEAGUE_BY_COUNTRY: Record<string, string> = {
    ENG: "lg-eng", ESP: "lg-esp", ITA: "lg-ita", GER: "lg-ger", FRA: "lg-fra", NED: "lg-ned", POR: "lg-por",
    TUR: "lg-tur", KSA: "lg-ksa", SAU: "lg-ksa", USA: "lg-usa", SCO: "lg-sco", BEL: "lg-bel", BRA: "lg-bra", ARG: "lg-arg",
  };
  const unknownTeams = new Set<number>();
  for (const c of fmCareer.values()) for (const s of c.spells) if (!teamLeague.has(s.team)) unknownTeams.add(s.team);
  const leagueOfTeam = new Map<number, string>();
  {
    const todo = [...unknownTeams];
    let n = 0;
    const worker = async () => {
      while (todo.length) {
        const t = todo.pop()!;
        const d = await fotmob<{ details?: { country?: string; gender?: string } }>(`teams?id=${t}`).catch(() => null);
        if (++n % 500 === 0) process.stdout.write(`\r  fotmob team countries ${n}/${unknownTeams.size}`);
        const lg = d?.details?.gender === "female" ? undefined : LEAGUE_BY_COUNTRY[d?.details?.country ?? ""];
        if (lg) leagueOfTeam.set(t, lg);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    process.stdout.write("\n");
  }

  const fmExtra = new Map<string, Set<string>>();
  for (const [q, c] of fmCareer) {
    const extra = new Set<string>();
    for (const s of c.spells) {
      const club = clubByFm.get(s.team);
      if (club) extra.add(`cl-${club}`);
      const league = leagueByFm.get(teamLeague.get(s.team) ?? -1) ?? leagueOfTeam.get(s.team);
      if (league) extra.add(league);
    }
    for (const t of TROPHIES) if (c.won.get(t.logo)?.length) extra.add(t.id);
    // A final reached: won or lost it (the original's "UCL Final").
    if (c.won.get(42)?.length || c.runnerUp.get(42)?.length) extra.add("gr-uclf");
    fmExtra.set(q, extra);
  }
  console.log(`fotmob careers matched to the pool: ${fmMatched} of ${careers.length}`);
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
  // A league hex shows the league's own logo, as the original's do, rather
  // than a generic flag icon.
  for (const l of LEAGUES) cats.push({ id: l.id, short: l.short, kind: "league", img: `l:${l.logo}` });
  for (const r of REGIONS) cats.push({ id: r.id, short: r.short, kind: "region" });
  for (const t of TROPHIES) cats.push({ id: t.id, short: t.short, kind: "trophy", img: `l:${t.logo}` });
  for (const d of [1970, 1980, 1990, 2000]) cats.push({ id: `dc-${d}`, short: `${String(d).slice(2)}년대생`, kind: "group" });
  cats.push({ id: "ps-gk", short: "골키퍼", kind: "group" });
  cats.push({ id: "gr-big5", short: "5대 리그 3곳+", kind: "group" });
  cats.push({ id: "gr-uclf", short: "UCL 결승", kind: "group", img: "l:42" });

  const { seasons, finals, squads } = await winners();
  console.log(`seasons with a winner: ${seasons.length}, UCL finalists: ${finals.length}`);
  const byComp = new Map<string, Season[]>();
  for (const x of seasons) (byComp.get(x.comp) ?? byComp.set(x.comp, []).get(x.comp)!).push(x);

  /*
   * Every country a player has played senior football for, as the original
   * counts them - measured on its own data: Zaha is ENG and CIV, Rice ENG and
   * IRL, Brahim ESP and MAR, while Grealish (Ireland youth only) is ENG alone.
   * Only FIFA sides: Puyol's Catalonia caps are not Spain's, and picking the
   * one most recent side had put him there and lost him from 스페인.
   * Uncapped, the latest youth side's country (Albrighton: England U21), then
   * citizenship - and United Kingdom alone reads as England, as the original
   * has Harvey Elliott.
   */
  const UK = "Q145";
  const ENGLAND = [...teams].find(([, t]) => t.fifa === "ENG")?.[0];
  // Sides with a code but no place in FIFA: regional selections that play
  // friendlies (Catalonia "CAT", the Basque Country, Galicia, ...).
  const NOT_FIFA = new Set(["CAT", "BAS", "EUS", "GAL", "GLC", "AND_", "KOS_"]);
  /*
   * Sides of states that no longer exist. A player capped only by one of them
   * also counts for his country today, as the original has it: Mihajlović
   * (Yugoslavia) is SRB, Panenka (Czechoslovakia) CZE, Sammer (East Germany)
   * GER. Serbia and Montenegro carries no code at all and was being dropped.
   */
  const FORMER = new Set(["Q188363", "Q1131732", "Q182072", "Q189275", "Q152424"]);
  const fifaTeam = (club: string) => {
    if (FORMER.has(club)) return true;
    const code = teams.get(club)?.fifa;
    return seniorNational(club) && !!code && !NOT_FIFA.has(code) && realSide(club);
  };
  // A youth side's senior side by name - "England national under-21 ..." is
  // England's - since its country (P17) is the United Kingdom for all four
  // home nations, and reading it by country had put England U21 players in
  // Scotland (Steve Bruce, Rob Holding, measured).
  const seniorByName = new Map<string, string>();
  for (const [q, t] of teams) if (t.fifa && !NOT_FIFA.has(t.fifa) && realSide(q)) seniorByName.set(t.en.replace(/ (men's )?national.*$/i, "").toLowerCase(), q);
  const seniorOfYouth = (club: string) =>
    seniorByName.get((clubs.get(club)?.en ?? "").replace(/ (men's )?(national|olympic).*$/i, "").toLowerCase());
  const nationsOf = (p: Player): string[] => {
    const senior = [...new Set(p.stints.filter((s) => fifaTeam(s.club)).map((s) => s.club))];
    if (senior.length && senior.every((t) => FORMER.has(t))) {
      const today = [...p.citizen].map((c) => teamByCountry.get(c)).filter((t): t is string => !!t && !FORMER.has(t) && realSide(t));
      return [...new Set([...senior, ...today])];
    }
    if (senior.length) return senior;
    const youth = p.stints
      .filter((s) => clubs.get(s.club)?.national && !seniorNational(s.club))
      .sort((a, b) => (b.start ?? 0) - (a.start ?? 0));
    for (const y of youth) {
      const t = seniorOfYouth(y.club);
      if (t) return [t];
    }
    // The United Kingdom is four football nations; it is read as England
    // only when nothing more specific is known, as the original does.
    for (const c of [...p.sport, ...p.citizen]) if (c !== UK && teamByCountry.has(c)) return [teamByCountry.get(c)!];
    if (ENGLAND && (p.citizen.has(UK) || p.sport.has(UK))) return [ENGLAND];
    return [];
  };

  for (const p of players.values()) {
    for (const id of fmExtra.get(p.q) ?? []) add(id, p.q);
    const seniorStints = p.stints.filter(senior);
    for (const s of seniorStints) add(`cl-${s.club}`, p.q);
    for (const l of LEAGUES) {
      const hit = seniorStints.some((s) => {
        const c = clubs.get(s.club)!;
        return (!!l.country && c.countries.has(l.country)) || !!l.leagues?.some((x) => c.leagues.has(x));
      });
      if (hit) add(l.id, p.q);
    }
    for (const nation of nationsOf(p)) {
      add(`nt-${nation}`, p.q);
      const cont = teams.get(nation)?.continent;
      const fifa = teams.get(nation)?.fifa;
      for (const r of REGIONS)
        if ((cont && r.continents?.includes(cont)) || (fifa && r.fifa?.includes(fifa))) add(r.id, p.q);
    }
    for (const t of TROPHIES) {
      const won = t.comps.some((c) =>
        (byComp.get(c) ?? []).some((x) => {
          if (!t.national) return wasThere(seniorStints, x.winner, x.from, x.to);
          const squad = x.q ? squads.get(x.q) : undefined;
          if (squad && squad.size >= SQUAD_COVERED)
            return squad.has(p.q) && p.stints.some((st) => st.club === x.winner);
          return wasThere(p.stints, x.winner, x.from, x.to);
        }),
      );
      if (won) add(t.id, p.q);
    }
    if (finals.some((x) => wasThere(seniorStints, x.winner, x.from, x.to))) add("gr-uclf", p.q);
    if (p.born) {
      const d = Math.floor(p.born / 10) * 10;
      if (d >= 1970 && d <= 2000) add(`dc-${d}`, p.q);
    }
    if (p.positions.has(GOALKEEPER)) add("ps-gk", p.q);
  }
  for (const p of players.values()) if (BIG5.filter((l) => members.get(l)?.has(p.q)).length >= 3) add("gr-big5", p.q);

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
      // No hex for a state that no longer exists ("체코슬로바키아" was reported
      // as a broken hex); its players count for their country today instead.
      if (FORMER.has(id.slice(3))) return false;
      if (!t.ko || NOT_A_NATION.test(t.en) || named.has(t.ko)) return false;
      named.add(t.ko);
      return true;
    });
  // No cap on how many: a top-40 by headcount was filled by Japan, China and
  // Hungary (the pool has thousands of their league players with Korean
  // names) and left out Wales, Ghana, Ivory Coast, Greece and Ukraine, all
  // hexes on the original's boards.
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
    // A player who can answer no real hex is only noise in the search box -
    // a birth decade alone does not count, or every footballer ever would.
    .filter((x) => x.v.some((i) => usable[i].kind !== "group"))
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
  const famous = list.filter((x, i) => x.p.ko && (i < 3000 || x.p.links >= 45)).map(({ p }) => p.ko);
  const familiar = await familiarNames(famous);
  // A one-word English name against a several-word Korean one is a player
  // known by a single name - Raphinha, Fred, Willian - whose Korean title is
  // his legal name; Korean Wikipedia's lead says what he is called (see
  // games/kowiki). Namuwiki's answer, where it has one, still comes first.
  const mononym = (p: Player) => /\s/.test(p.ko) && /^[\p{L}'-]+$/u.test(p.en);
  const common = await commonNames(list.filter(({ p }) => p.ko && mononym(p)).map(({ p }) => ({ ko: p.ko, en: p.en })));
  // Hand-kept names, keyed "English label|birth year": the first is shown,
  // every one is searchable. For the players no source spells as fans do.
  const manual = manualAliases as Record<string, string[]>;
  const hand = (p: Player) => manual[`${p.en}|${p.born}`];
  // No Korean name anywhere: shown and searched in English.
  const display = (p: Player) =>
    hand(p)?.[0] ?? (p.ko ? (familiar.get(p.ko) ?? common.get(p.ko) ?? p.ko) : p.en);
  // Search-only spellings: Korean Wikipedia's redirects for the well-known
  // (see games/kowiki), and a hand-kept list for the ones no source spells
  // the way fans do - "알렉시스 마크 아이스테르" is Mac Allister.
  const known = list.filter((x, i) => x.p.ko && (i < 6000 || x.p.links >= 30)).map(({ p }) => p.ko);
  const redirects = await redirectNames(known);
  const alts = (p: Player) =>
    [...new Set([p.ko, ...p.aliases, ...(redirects.get(p.ko) ?? []), ...(hand(p) ?? [])])].filter(
      (a) => a !== display(p) && /[가-힣]/.test(a),
    );
  console.log(`familiar names: ${familiar.size} of ${famous.length} differ from Wikipedia's; single names: ${common.size}`);

  const grid = {
    built: new Date().toISOString().slice(0, 10),
    source: "Wikidata (CC0)",
    cats: usable.map((c) => ({ ...c, n: members.get(c.id)!.size })),
    pairs,
    players: list.map(({ p, v }) => [display(p), p.en, p.born ?? 0, p.links, v, alts(p).join("|"), positions(p)]),
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
