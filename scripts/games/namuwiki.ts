import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * The name Korean football fans actually use.
 *
 * Wikidata's Korean labels follow the Korean Wikipedia's transliteration rules,
 * which are faithful to the original language and often not what anyone says:
 * "치아구 시우바" for Thiago Silva, "호드리구 고이스" for Rodrygo. Namuwiki
 * titles its pages by common usage and redirects the formal spelling to them -
 * measured: /w/치아구 시우바 answers 302 → /w/티아고 실바, and
 * /w/호드리구 고이스 answers 302 → /w/호드리구(2001).
 *
 * So one HEAD request per name reads the redirect and nothing else: no page
 * body is downloaded, and the only thing kept is the title - a person's name,
 * which is a fact, not the site's content. robots.txt allows /w/ for every
 * agent. Four requests at a time with a pause between - measured at about
 * seven a second, so the first full run of ~3,300 names took six minutes - and every answer cached
 * on disk, so a rebuild asks again only for names it has never asked about.
 */
/**
 * Committed, not cached. The answers are data the games depend on - a rebuild
 * on another machine or in CI should not have to ask Namuwiki three thousand
 * questions again - and a wrong one can be corrected by editing a line here.
 * `null` means "asked; Namuwiki uses the same name".
 */
const FILE = join(process.cwd(), "data", "games", "namuwiki-names.json");
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

type Answer = string | null; // the familiar name, or null for "no page / same name"

function readCache(): Record<string, Answer> {
  if (!existsSync(FILE)) return {};
  return JSON.parse(readFileSync(FILE, "utf8"));
}

/** Sorted keys, one per line, so a change shows up as a one-line diff. */
function writeCache(cache: Record<string, Answer>) {
  const sorted = Object.fromEntries(Object.entries(cache).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(FILE, JSON.stringify(sorted, null, 0).replace(/,"/g, ',\n"'));
}

/** "/w/호드리구(2001)?from=…" → "호드리구" */
function titleOf(location: string): string | null {
  const path = location.split("?")[0].split("#")[0];
  if (!path.startsWith("/w/")) return null;
  const title = decodeURIComponent(path.slice(3));
  // A redirect into a subpage or a list is not a person's name.
  if (title.includes("/") || title.includes(":")) return null;
  return title.replace(/\s*\([^)]*\)\s*$/, "").trim() || null;
}

/** `undefined` means "could not ask" - not cached, so the next build asks again. */
async function ask(name: string): Promise<Answer | undefined> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`https://namu.wiki/w/${encodeURIComponent(name)}`, {
      method: "HEAD",
      redirect: "manual",
      headers: { "User-Agent": UA },
    });
    if (res.status === 301 || res.status === 302) {
      const t = titleOf(res.headers.get("location") ?? "");
      return t && t !== name ? t : null;
    }
    if (res.status === 200 || res.status === 404) return null;
    // 429 / 5xx / a challenge: back off and try again. Giving up must not be
    // recorded as "same name" - that would freeze a wrong answer into the cache.
    await new Promise((r) => setTimeout(r, attempt * 4000));
  }
  return undefined;
}

export async function familiarNames(names: string[]): Promise<Map<string, string>> {
  mkdirSync(join(process.cwd(), "data", "games"), { recursive: true });
  const cache = readCache();
  const todo = [...new Set(names)].filter((n) => !(n in cache));
  let done = 0;
  const worker = async () => {
    while (todo.length) {
      const name = todo.shift()!;
      const answer = await ask(name);
      if (answer !== undefined) cache[name] = answer;
      done++;
      if (done % 50 === 0) {
        writeCache(cache);
        process.stdout.write(`\r  namuwiki ${done} asked`);
      }
      await new Promise((r) => setTimeout(r, 250));
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  writeCache(cache);
  if (done) process.stdout.write(`\r  namuwiki ${done} asked\n`);

  const out = new Map<string, string>();
  for (const n of names) if (cache[n]) out.set(n, cache[n]!);
  return out;
}
