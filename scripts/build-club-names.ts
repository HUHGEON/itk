/**
 * Korean names for the clubs we do not track.
 *
 *   npx tsx scripts/build-club-names.ts
 *
 * Seventeen clubs carry a Korean name in the registry; every other side in a
 * fixture list came through in English - "Brighton & Hove Albion" beside
 * "첼시" on the same row. This reads each league's club list from ESPN (the
 * names the fixtures use), finds each club on Wikidata (CC0) in one query, and
 * keeps the short Korean form fans use: "브라이턴", not "브라이턴 앤 호브
 * 앨비언 FC". Written to data/club-names.json and committed.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const LEAGUES = ["eng.1", "esp.1", "ita.1", "ger.1", "fra.1", "ned.1", "por.1", "tur.1", "sco.1", "bel.1"];

/*
 * Checked by hand: the twelve Wikidata had no English label for under the
 * name ESPN uses, and one it matched to the wrong club (Fortuna Sittard came
 * back as Fortuna Düsseldorf through the short name "Fortuna").
 */
const MANUAL: Record<string, string> = {
  Elche: "엘체",
  "Málaga": "말라가",
  Osasuna: "오사수나",
  Lazio: "라치오",
  "FC Cologne": "쾰른",
  Brest: "브레스트",
  Lorient: "로리앙",
  Nice: "니스",
  Troyes: "트루아",
  Excelsior: "엑셀시오르",
  Heerenveen: "헤이렌베인",
  Telstar: "텔스타르",
  "Fortuna Sittard": "포르투나 시타르트",
  // What Korean fans call them, not the full club name.
  Venezia: "베네치아",
  "Hamburg SV": "함부르크",
  // Known by the letters, not the town.
  "PSV Eindhoven": "PSV",
  "AZ Alkmaar": "AZ 알크마르",
  "Club Brugge": "클럽 브뤼헤",
  // European regulars Wikidata had no English match for.
  Braga: "브라가",
  "Vitória de Guimaraes": "비토리아 기마랑이스",
  "Santa Clara": "산타 클라라",
  Arouca: "아로우카",
  "Casa Pia": "카자 피아",
  "Istanbul Basaksehir": "바샥셰히르",
  "Racing Genk": "헹크",
  "Sint-Truidense": "신트트라위던",
  "Zulte-Waregem": "쥘터 바레험",
  Goztepe: "괴즈테페",
  Kasimpasa: "카슴파샤",
  "Gaziantep FK": "가지안테프",
  Eyupspor: "에위프스포르",
  Genclerbirligi: "겐출레르비를리이",
};

const UA = { "User-Agent": "itk-plus/1.0 (football news; contact via github HUHGEON)" };

async function espnTeams(code: string): Promise<{ name: string; short: string }[]> {
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/teams`);
  if (!res.ok) return [];
  const json = (await res.json()) as {
    sports?: { leagues?: { teams?: { team: { displayName: string; shortDisplayName?: string } }[] }[] }[];
  };
  return (json.sports?.[0]?.leagues?.[0]?.teams ?? []).map((t) => ({
    name: t.team.displayName,
    short: t.team.shortDisplayName ?? t.team.displayName,
  }));
}

/**
 * The short Korean form: the label without the Latin-letter tokens (FC, AFC,
 * SSC, RB...), bare years and "칼초", and where that is still long, a Korean
 * alias that begins it - "브라이턴" for "브라이턴 앤 호브 앨비언", "인테르" for
 * "인테르나치오날레 밀라노".
 */
function shorten(label: string, aliases: string[]): string {
  const base = label
    .split(/\s+/)
    .filter((w) => !/^[A-Za-z0-9.]+$/.test(w) && w !== "칼초")
    .join(" ")
    .trim();
  const name = base || label;
  if (name.replace(/\s/g, "").length <= 8) return name;
  const lead = aliases
    .filter((a) => /[가-힣]/.test(a) && !/[A-Za-z]/.test(a) && name.startsWith(a.split(" ")[0]) && a.length < name.length)
    .sort((a, b) => a.length - b.length)[0];
  return lead ?? name;
}

async function main() {
  const clubs: { name: string; short: string }[] = [];
  for (const code of LEAGUES) {
    clubs.push(...(await espnTeams(code)));
    await new Promise((r) => setTimeout(r, 400));
  }
  console.log(`ESPN clubs: ${clubs.length}`);

  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  // Full names first; the short name only as a fallback, since a short name
  // alone ("Fortuna") is what matched the wrong club.
  const values = clubs
    .flatMap(({ name, short }) =>
      [name, `${name} F.C.`, `${name} FC`, short, `${short} F.C.`, `${short} FC`].map(
        (v, i) => `("${esc(name)}" "${esc(v)}"@en ${i < 3 ? 1 : 0})`,
      ),
    )
    .join(" ");
  const query = `SELECT ?espn ?full ?item ?ko ?sitelinks (GROUP_CONCAT(DISTINCT ?alt; separator="|") AS ?alts) WHERE {
    VALUES (?espn ?n ?full) { ${values} }
    { ?item rdfs:label ?n } UNION { ?item skos:altLabel ?n }
    ?item wdt:P31/wdt:P279* wd:Q476028 ; wikibase:sitelinks ?sitelinks .
    OPTIONAL { ?item rdfs:label ?ko FILTER(LANG(?ko) = "ko") }
    OPTIONAL { ?item skos:altLabel ?alt FILTER(LANG(?alt) = "ko") }
  } GROUP BY ?espn ?full ?item ?ko ?sitelinks`;

  const res = await fetch("https://query.wikidata.org/sparql", {
    method: "POST",
    headers: { ...UA, Accept: "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ query }),
  });
  if (!res.ok) throw new Error(`Wikidata ${res.status}`);
  const rows = (await res.json()).results.bindings as Record<string, { value: string }>[];

  // Per club: a full-name match over a short-name one, then the better-known item.
  const best = new Map<string, { full: number; links: number; ko: string; alts: string[] }>();
  for (const r of rows) {
    if (!r.ko) continue;
    const cand = { full: Number(r.full.value), links: Number(r.sitelinks.value), ko: r.ko.value, alts: r.alts?.value ? r.alts.value.split("|") : [] };
    const prev = best.get(r.espn.value);
    if (!prev || cand.full > prev.full || (cand.full === prev.full && cand.links > prev.links)) best.set(r.espn.value, cand);
  }

  const out: Record<string, string> = {};
  for (const { name } of clubs) {
    const hit = best.get(name);
    const ko = MANUAL[name] ?? (hit ? shorten(hit.ko, hit.alts) : null);
    if (ko) out[name] = ko;
  }
  const missing = clubs.map((c) => c.name).filter((n) => !out[n]);
  const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(join(process.cwd(), "data", "club-names.json"), JSON.stringify(sorted, null, 1) + "\n");
  console.log(`named ${Object.keys(out).length}/${clubs.length}; missing: ${missing.join(", ") || "none"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
