/**
 * Builds data/players.json — Korean spellings for the people who show up in
 * this feed's headlines.
 *
 * Driven by the corpus rather than by squad lists: the candidates are the names
 * appearing in this feed's own headlines, ranked by how often. A squad API
 * would return four hundred players nobody here writes about and still miss the
 * managers, agents and executives that do turn up.
 *
 * Resolution is two hops, both free and keyless:
 *
 *   en.wikipedia  name → Wikidata id + a one-line description. Redirects are
 *                 followed, so "Bruno Guimaraes" reaches the accented article,
 *                 and the description is what proves the article is a
 *                 footballer rather than a town of the same name.
 *   wikidata      id → the `ko` label. This hop is the reason the pass exists:
 *                 Korean Wikipedia has articles for almost none of these
 *                 players, but Wikidata carries their Korean labels anyway.
 *
 * Wikidata follows 외래어 표기법, which is not always what Korean football
 * forums write — it gives 니콜라 작송 where the community says 니콜라 잭슨. Those
 * go in OVERRIDES below, which wins over anything fetched.
 *
 *   npx tsx scripts/build-players.ts --dry
 *   npx tsx scripts/build-players.ts --min 1
 */
import "../lib/load-env";
import fs from "node:fs";
import path from "node:path";
import { loadJournalists, loadTeams } from "../lib/registry";

/** Community usage beats the standard transliteration where they disagree. */
const OVERRIDES: Record<string, string> = {
  "Nicolas Jackson": "니콜라 잭슨",
  "Bruno Guimarães": "브루노 기마랑이스",
  "Dominik Szoboszlai": "도미니크 소보슬러이",
};

/** Capitalised Latin runs that are never a person. */
const NOT_A_PERSON =
  /^(The|A|An|And|Or|But|New|Live|Full|Best|Latest|Breaking|Transfer|Deal|News|Video|Photo|Premier|League|Cup|Final|Club|City|United|Real|Man|FC|AFC|CF|SC|AC|Red Bull|Sky|BBC|ESPN|Getty|Instagram|Twitter|YouTube|Google|Apple)\b/i;

const USER_AGENT = "itkplus/1.0 (football news aggregator; headline localisation)";

/**
 * Both APIs are free and unauthenticated, which means they are also entitled to
 * throttle. A skipped batch used to look identical to "nobody by that name",
 * and a run that got throttled throughout wrote an empty registry over a good
 * one — so a 429 waits and retries rather than being swallowed.
 */
async function wikiGet<T>(url: string): Promise<T | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, {
      headers: { "user-agent": USER_AGENT, "api-user-agent": USER_AGENT },
      signal: AbortSignal.timeout(30_000),
    });
    if (res.ok) return (await res.json()) as T;

    if (res.status !== 429 && res.status < 500) {
      console.warn(`  ⚠ ${res.status} — 이 배치를 건너뜁니다`);
      return null;
    }

    // The server says how long it wants; only guess when it doesn't.
    const stated = Number(res.headers.get("retry-after"));
    const wait = Number.isFinite(stated) && stated > 0
      ? stated * 1_000
      : 5_000 * 2 ** attempt;
    console.warn(`  ⏳ ${res.status} — ${Math.round(wait / 1000)}초 후 재시도`);
    await sleep(wait);
  }
  throw new Error("위키 API가 계속 거절합니다 — 잠시 뒤 다시 실행하세요");
}

/** Nobiliary particles, which a Korean headline keeps attached to the surname. */
const PARTICLES = new Set([
  "de", "van", "von", "del", "di", "da", "dos", "der", "den", "le", "la", "el", "al",
]);

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sql<T>(query: string): Promise<T[]> {
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );
  const body = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${body}`);
  return JSON.parse(body) as T[];
}

/**
 * Two to four capitalised words, with the lowercase particles a European name
 * carries in the middle ("Roberto De Zerbi", "Virgil van Dijk").
 */
const NAME =
  /\b[A-ZÀ-ÖØ-Þ][\p{L}\p{M}'’-]+(?:\s+(?:de|De|van|Van|von|Von|del|Del|di|Di|da|Da|dos|el|al|la|le|Le)){0,2}(?:\s+[A-ZÀ-ÖØ-Þ][\p{L}\p{M}'’-]+){1,2}\b/gu;

/**
 * Names worth having a Korean spelling for.
 *
 * Drawn from the **original** headlines, not the translated ones. Reading
 * `title_ko` seems natural — those are the names visibly leaking — but it makes
 * the build eat itself: every name this script localises disappears from its
 * own next run's candidate list, so a rebuild silently produces a smaller
 * registry than the one it replaces. The English titles never change.
 */
function candidates(titles: string[], exclude: Set<string>, min: number) {
  const tally = new Map<string, number>();

  for (const title of titles) {
    for (const m of title.matchAll(NAME)) {
      const name = m[0].replace(/\s+/g, " ").trim();
      if (name.length < 6 || NOT_A_PERSON.test(name)) continue;
      if (exclude.has(name.toLowerCase())) continue;
      tally.set(name, (tally.get(name) ?? 0) + 1);
    }
  }

  return [...tally]
    .filter(([, n]) => n >= min)
    .sort((a, b) => b[1] - a[1]);
}

interface Resolved {
  qid: string;
  description: string;
  /** The article title after redirects — "Bruno Guimaraes" → "Bruno Guimarães". */
  canonical: string;
}

/** name → Wikidata id + description, 50 at a time (the API's cap). */
async function resolveWiki(names: string[]): Promise<Map<string, Resolved>> {
  const out = new Map<string, Resolved>();

  for (let i = 0; i < names.length; i += 50) {
    const batch = names.slice(i, i + 50);
    const url =
      "https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1" +
      `&prop=pageprops|description&ppprop=wikibase_item&titles=${encodeURIComponent(batch.join("|"))}`;

    const body = await wikiGet<{
      query?: {
        // A redirect maps the name we asked for onto the article that answered.
        normalized?: { from: string; to: string }[];
        redirects?: { from: string; to: string }[];
        pages?: Record<
          string,
          { title?: string; description?: string; pageprops?: { wikibase_item?: string } }
        >;
      };
    }>(url);
    if (!body) continue;

    const byTitle = new Map<string, Resolved>();
    for (const page of Object.values(body.query?.pages ?? {})) {
      const qid = page.pageprops?.wikibase_item;
      if (!qid || !page.title) continue;
      byTitle.set(page.title, {
        qid,
        description: page.description ?? "",
        canonical: page.title,
      });
    }

    // Walk each requested name forward through normalisation and redirects.
    const hop = new Map<string, string>();
    for (const n of body.query?.normalized ?? []) hop.set(n.from, n.to);
    for (const r of body.query?.redirects ?? []) hop.set(r.from, r.to);

    for (const asked of batch) {
      let title = asked;
      for (let step = 0; step < 4 && hop.has(title); step++) title = hop.get(title)!;
      const found = byTitle.get(title);
      if (found) out.set(asked, found);
    }

    process.stdout.write(`  위키백과 ${Math.min(i + 50, names.length)}/${names.length}\r`);
    await sleep(1_200);
  }

  console.log();
  return out;
}

/** Wikidata id → Korean label, 50 at a time. */
async function koreanLabels(qids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();

  for (let i = 0; i < qids.length; i += 50) {
    const batch = qids.slice(i, i + 50);
    const url =
      "https://www.wikidata.org/w/api.php?action=wbgetentities&format=json" +
      `&props=labels&languages=ko&ids=${batch.join("|")}`;

    const body = await wikiGet<{
      entities?: Record<string, { labels?: { ko?: { value?: string } } }>;
    }>(url);
    if (!body) continue;

    for (const [qid, entity] of Object.entries(body.entities ?? {})) {
      const label = entity.labels?.ko?.value?.trim();
      // Wikidata disambiguates in the label itself — "홍길동 (축구 선수)" — and
      // carries the club's legal suffix, which Korean match reports drop:
      // 노팅엄 포리스트, not 노팅엄 포리스트 FC.
      if (label) {
        out.set(
          qid,
          label
            .replace(/\s*\([^)]*\)\s*$/, "")
            .replace(/\s+(FC|F\.C\.|CF|SC|AFC)$/i, "")
            .trim(),
        );
      }
    }

    process.stdout.write(`  위키데이터 ${Math.min(i + 50, qids.length)}/${qids.length}\r`);
    await sleep(1_200);
  }

  console.log();
  return out;
}

export interface PlayerEntry {
  /** Every Latin spelling seen for this person, longest first. */
  en: string[];
  ko: string;
  /** Kept for auditing: which Wikidata entity the Korean came from. */
  qid?: string;
}

async function main() {
  const min = Number(arg("min")) || 2;
  const dry = has("dry");

  // Clubs and journalists already localise elsewhere, and an outlet name must
  // never be transliterated — "The Athletic" is not a person.
  const exclude = new Set<string>();
  for (const t of loadTeams()) {
    for (const n of [t.en, ...(t.aliases ?? [])]) exclude.add(n.toLowerCase());
  }
  for (const j of loadJournalists()) exclude.add(j.en.toLowerCase());
  const outlets = await sql<{ source: string }>(
    "select distinct source from itk.articles where source is not null",
  );
  for (const o of outlets) exclude.add(o.source.toLowerCase());

  const rows = await sql<{ title: string }>("select title from itk.articles");
  const found = candidates(rows.map((r) => r.title), exclude, min);
  console.log(
    `원문 제목 ${rows.length.toLocaleString()}건에서 후보 ${found.length}종 ` +
      `(${min}회 이상, 총 ${found.reduce((s, [, n]) => s + n, 0)}회 출현)`,
  );

  const names = found.map(([name]) => name);
  const wiki = await resolveWiki(names);

  // A description is the cheapest proof the article is about football at all.
  // Without it we would happily transliterate a stadium or a town.
  const FOOTBALL =
    /footballer|football (manager|coach|executive|agent|referee|administrator|club)|association football|soccer|sports journalist|FIFA|UEFA/i;
  const AMBIGUOUS = /disambiguation|Topics referred to by the same term/i;

  // A bare surname often lands on a disambiguation page — there are several
  // Curtis Joneses, and "Crystal Palace" is a park before it is a club. The
  // qualified titles Wikipedia itself uses are worth one more round trip.
  const retry = names.filter((n) => {
    const r = wiki.get(n);
    return !r || AMBIGUOUS.test(r.description) || !FOOTBALL.test(r.description);
  });

  if (retry.length) {
    console.log(`  모호하거나 못 찾은 ${retry.length}종을 한정 표제어로 재조회`);
    const qualified = retry.flatMap((n) => [`${n} (footballer)`, `${n} F.C.`]);
    const second = await resolveWiki(qualified);
    for (const [asked, r] of second) {
      const original = asked.replace(/ \((footballer)\)$| F\.C\.$/, "");
      const current = wiki.get(original);
      if (FOOTBALL.test(r.description) && (!current || AMBIGUOUS.test(current.description))) {
        wiki.set(original, r);
      }
    }
  }

  const people = [...wiki].filter(
    ([, r]) => FOOTBALL.test(r.description) && !AMBIGUOUS.test(r.description),
  );
  console.log(`  축구 관련으로 확인 ${people.length}종 / 조회 ${wiki.size}종`);

  const labels = await koreanLabels([...new Set(people.map(([, r]) => r.qid))]);

  let entries: PlayerEntry[] = [];
  for (const [asked, r] of people) {
    const ko = OVERRIDES[asked] ?? OVERRIDES[r.canonical] ?? labels.get(r.qid);
    if (!ko || !/[가-힣]/.test(ko)) continue;

    // Both spellings matter: the corpus writes "Bruno Guimaraes", Wikipedia
    // titles it "Bruno Guimarães", and either can turn up in a future headline.
    const spellings = new Set([r.canonical, asked]);

    // Headlines drop the given name for anyone whose surname carries a particle
    // — "De Zerbi가 방금 한 말" — and that compound is specific enough to stand
    // alone, unlike a bare "Jones".
    for (const spelling of [...spellings]) {
      const tokens = spelling.replace(/ \(.*\)$/, "").split(/\s+/);
      const particle = tokens.findIndex((t) => PARTICLES.has(t.toLowerCase()));
      if (particle > 0 && particle < tokens.length - 1) {
        spellings.add(tokens.slice(particle).join(" "));
      }
    }

    // "(footballer)" is Wikipedia's disambiguator, not a spelling anyone writes.
    const en = [...spellings]
      .map((s) => s.replace(/\s*\([^)]*\)\s*$/, "").trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    entries.push({ en: [...new Set(en)], ko, qid: r.qid });
  }

  // Two candidate spellings can resolve to one person — "Dundee United" and
  // "Dundee United F.C." are the same entity — and keeping both would compile
  // the same substitution twice.
  const byQid = new Map<string, PlayerEntry>();
  for (const e of entries) {
    const key = e.qid ?? e.ko;
    const existing = byQid.get(key);
    if (!existing) byQid.set(key, e);
    else existing.en = [...new Set([...existing.en, ...e.en])].sort((a, b) => b.length - a.length);
  }

  entries = [...byQid.values()].sort((a, b) => a.ko.localeCompare(b.ko, "ko"));
  console.log(`✓ 한글 표기 확보 ${entries.length}종`);
  for (const e of entries.slice(0, 20)) console.log(`  ${e.en[0]} → ${e.ko}`);

  if (dry) {
    console.log("--dry — 파일을 쓰지 않았습니다.");
    return;
  }

  const out = path.join(process.cwd(), "data", "players.json");

  // A throttled run resolves almost nothing and would otherwise write that
  // nothing over a registry built when the APIs were answering. Losing the file
  // is silent; refusing to shrink it is not.
  if (fs.existsSync(out)) {
    const existing = JSON.parse(fs.readFileSync(out, "utf8")) as PlayerEntry[];
    if (entries.length < existing.length * 0.9) {
      console.error(
        `✗ 기존 ${existing.length}종보다 크게 줄어(${entries.length}종) 쓰지 않습니다. ` +
          "위키 API가 요청을 거절했을 가능성이 큽니다 — --force 로 덮어쓸 수 있습니다.",
      );
      if (!has("force")) {
        process.exitCode = 1;
        return;
      }
    }
  }

  fs.writeFileSync(out, `${JSON.stringify(entries, null, 2)}\n`);
  console.log(`✓ ${entries.length}종 · ${out}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
