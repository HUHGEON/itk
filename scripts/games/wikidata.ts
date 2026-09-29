import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Wikidata, asked politely and asked once.
 *
 * The query service asks for a descriptive User-Agent with a contact, and it
 * rate-limits by client, so every answer is cached on disk by the hash of its
 * query. A rebuild after a code change re-reads the cache instead of spending
 * the same minute of the service's time again; delete `.cache/` to refresh.
 */
const UA =
  "ITKplus-games/1.0 (https://itkplus.vercel.app; contact via github.com/HUHGEON/itk)";
const DIR = join(process.cwd(), ".cache", "games", "wikidata");

export type Row = Record<string, { value: string } | undefined>;

export async function sparql(query: string): Promise<Row[]> {
  mkdirSync(DIR, { recursive: true });
  const key = createHash("sha1").update(query).digest("hex");
  const file = join(DIR, `${key}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));

  for (let attempt = 1; ; attempt++) {
    const res = await fetch("https://query.wikidata.org/sparql", {
      method: "POST",
      headers: {
        Accept: "application/sparql-results+json",
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "query=" + encodeURIComponent(query),
    });
    if (res.ok) {
      const rows = (await res.json()).results.bindings as Row[];
      writeFileSync(file, JSON.stringify(rows));
      return rows;
    }
    // 429 and timeouts are the service asking for time; anything else is ours.
    if (attempt >= 4 || (res.status !== 429 && res.status < 500)) {
      throw new Error(`Wikidata ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const wait = Number(res.headers.get("retry-after")) * 1000 || attempt * 5000;
    await new Promise((r) => setTimeout(r, wait));
  }
}

/** "http://www.wikidata.org/entity/Q9617" → "Q9617" */
export const qid = (v: string | undefined) => v?.split("/").pop() ?? "";

export const val = (r: Row, k: string) => r[k]?.value;

export function chunks<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
