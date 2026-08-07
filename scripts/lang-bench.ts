/**
 * Measures detectLang against real headlines.
 *
 *   npm run lang:bench
 *   npm run lang:bench -- --fails    틀린 것만 출력
 *
 * The labels come from outlets that publish in exactly one language, which is
 * the only ground truth available without a paid detector. Mixed-language
 * outlets (OneFootball, Bluesky, Google News aggregates) are excluded.
 */
import "../lib/load-env";
import { rpc } from "../lib/supabase";
import { detectLang } from "../lib/collect/lang";

/** Outlets that publish in one language only. */
const LABELS: Record<string, string> = {
  "BBC Sport": "en", BBC: "en", "The Guardian": "en", "Sky Sports": "en",
  "Daily Mail": "en", "Mirror Football": "en", "Evening Standard": "en",
  "The Independent": "en", "The Telegraph": "en", FourFourTwo: "en",
  "football.london": "en", "Manchester Evening News": "en",
  "Liverpool Echo": "en", ChronicleLive: "en", BirminghamLive: "en",
  LeedsLive: "en", CaughtOffside: "en", GiveMeSport: "en",
  "Football Italia": "en", "The New York Times": "en",

  "Mundo Deportivo": "es", "Diario Sport": "es", "Diario AS": "es", Marca: "es",
  "Defensa Central": "es", "Olé": "es", Relevo: "es",

  Tuttosport: "it", "Corriere dello Sport": "it", "SOS Fanta": "it",
  "Gianluca Di Marzio": "it", "FC Inter 1908": "it", "La Gazzetta dello Sport": "it",

  "L'Équipe": "fr", "RMC Sport": "fr", "Foot Mercato": "fr", "Ouest-France": "fr",

  "De Telegraaf": "nl", "Voetbal International": "nl", "AD Sport": "nl",

  kicker: "de", "Bild": "de", "Sky Sport Germany": "de",

  "Globo Esporte": "pt",
};

interface Row {
  title: string;
  source: string;
}

function arg(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const rows: Row[] = [];
  for (let offset = 0; offset < 6000; offset += 1000) {
    const page = await rpc<Row[]>("itk_titles_for_bench", { p_offset: offset });
    rows.push(...page);
    if (page.length < 1000) break;
  }

  const cases = rows
    .filter((r) => LABELS[r.source])
    .map((r) => ({ title: r.title, want: LABELS[r.source] }));

  const perLang = new Map<string, { n: number; ok: number }>();
  const fails: Array<{ title: string; want: string; got: string }> = [];

  for (const c of cases) {
    const got = detectLang(c.title);
    const bucket = perLang.get(c.want) ?? { n: 0, ok: 0 };
    bucket.n++;
    if (got === c.want) bucket.ok++;
    else fails.push({ title: c.title, want: c.want, got });
    perLang.set(c.want, bucket);
  }

  if (arg("fails")) {
    for (const f of fails.slice(0, 40)) {
      console.log(`want=${f.want} got=${f.got}  ${f.title.slice(0, 78)}`);
    }
    console.log("");
  }

  let n = 0;
  let ok = 0;
  for (const [lang, b] of [...perLang].sort((a, b) => b[1].n - a[1].n)) {
    n += b.n;
    ok += b.ok;
    const pct = ((100 * b.ok) / b.n).toFixed(1);
    console.log(`  ${lang}  ${String(b.ok).padStart(4)}/${String(b.n).padEnd(4)} ${pct}%`);
  }
  console.log(`\n전체 ${ok}/${n} = ${((100 * ok) / n).toFixed(1)}%`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
