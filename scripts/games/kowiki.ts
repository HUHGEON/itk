import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The single name a player goes by, when Korean Wikipedia titles him by his
 * full one.
 *
 * Raphinha is "하파에우 지아스 벨롤리" on Korean Wikipedia and in Wikidata's
 * Korean label, and Namuwiki has no redirect from that spelling, so the games
 * showed the legal name and typing "하피냐" found only the 1985 Rafinha. The
 * article's first sentence says what he is called: "하파에우 지아스
 * 벨롤리(포르투갈어: Raphael Dias Belloli, …)는 하피냐(포르투갈어: Raphinha)
 * 라고 불리는 …". So for a player whose English label is one word and whose
 * Korean name is several, the lead is read for a Hangul word followed by that
 * English word in brackets.
 *
 * One request per twenty players (the extracts API's limit), from Korean
 * Wikipedia's open API. Answers are committed, like Namuwiki's: `null` means
 * "asked; nothing found".
 */
const FILE = join(process.cwd(), "data", "games", "kowiki-common.json");
const UA = "itk-plus/1.0 (football games; github HUHGEON)";

type Answer = string | null;

function readCache(): Record<string, Answer> {
  return existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : {};
}
function writeCache(cache: Record<string, Answer>) {
  const sorted = Object.fromEntries(Object.entries(cache).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(FILE, JSON.stringify(sorted, null, 0).replace(/,"/g, ',\n"'));
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** "…는 하피냐(포르투갈어: Raphinha)라고…" → "하피냐" */
export function commonFromLead(lead: string, en: string): string | null {
  const m = lead.match(new RegExp(`([가-힣]{2,10})\\s*\\((?:[^()]*?:\\s*)?${escape(en)}\\s*[,)]`));
  return m ? m[1] : null;
}

/** Korean full name → the one-word name it goes by, for each player given. */
export async function commonNames(players: { ko: string; en: string }[]): Promise<Map<string, string>> {
  const cache = readCache();
  const todo = players.filter((p) => !(p.ko in cache));
  for (let i = 0; i < todo.length; i += 20) {
    const batch = todo.slice(i, i + 20);
    const url = new URL("https://ko.wikipedia.org/w/api.php");
    for (const [k, v] of Object.entries({
      action: "query", prop: "extracts", exintro: "1", explaintext: "1", exlimit: "20",
      redirects: "1", format: "json", titles: batch.map((p) => p.ko).join("|"),
    })) url.searchParams.set(k, v);
    let json: { query?: { pages?: Record<string, { title: string; extract?: string }>; redirects?: { from: string; to: string }[]; normalized?: { from: string; to: string }[] } };
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) continue; // not recorded: asked again next build
      json = await res.json();
    } catch {
      continue;
    }
    const byTitle = new Map(Object.values(json.query?.pages ?? {}).map((p) => [p.title, p.extract ?? ""]));
    const hop = new Map([...(json.query?.normalized ?? []), ...(json.query?.redirects ?? [])].map((r) => [r.from, r.to]));
    for (const p of batch) {
      let t = p.ko;
      for (let k = 0; k < 3 && hop.has(t); k++) t = hop.get(t)!;
      const found = commonFromLead(byTitle.get(t) ?? "", p.en);
      cache[p.ko] = found && found !== p.ko ? found : null;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  writeCache(cache);
  const out = new Map<string, string>();
  for (const p of players) if (cache[p.ko]) out.set(p.ko, cache[p.ko]!);
  return out;
}
