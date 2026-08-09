/**
 * Backfills headline hygiene over articles already stored.
 *
 * `cleanTitle` runs inside the collector from now on, but the 8,800 rows taken
 * before it existed still carry "… - Gianluca Di Marzio" — and, worse, a
 * `title_ko` translated *from* that suffix. So every row whose title changes
 * here also has its Korean dropped, which puts it back in front of the
 * translator.
 *
 * Deliberately the same function the collector calls, rather than an equivalent
 * expression in SQL: two implementations of this rule would drift, and the one
 * that drifts is the one nobody is watching.
 *
 *   npx tsx scripts/clean-titles.ts --dry
 *   npx tsx scripts/clean-titles.ts
 *   npx tsx scripts/clean-titles.ts --restyle 7   # also re-queue 7 days of
 *                                                 # translations for the new prompt
 */
import "../lib/load-env";
import { cleanTitle } from "../lib/collect/title";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

/**
 * Runs SQL through the Management API.
 *
 * Same reasoning as scripts/query.ts: outbound 5432 is blocked here, and this
 * needs plain UPDATE rather than one of the `itk_*` functions.
 */
async function sql<T = Record<string, unknown>>(query: string): Promise<T[]> {
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(
    ".",
  )[0];
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

const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

async function main() {
  const dry = has("dry");
  const restyle = arg("restyle") ? Number(arg("restyle")) : 0;

  const rows = await sql<{ id: string; title: string; source: string | null }>(
    "select id, title, source from itk.articles where source is not null",
  );
  console.log(`${rows.length.toLocaleString()}건 검사`);

  const changed = rows
    .map((r) => ({ id: r.id, from: r.title, to: cleanTitle(r.title, r.source!) }))
    .filter((r) => r.to && r.to !== r.from);

  console.log(`${changed.length.toLocaleString()}건 변경`);
  for (const c of changed.slice(0, 12)) {
    console.log(`  ${c.from}\n  → ${c.to}\n`);
  }

  if (dry) {
    console.log("--dry — 아무것도 쓰지 않았습니다.");
    return;
  }

  // Chunked: the Management API rejects a body of a few thousand rows outright.
  let done = 0;
  for (let i = 0; i < changed.length; i += 400) {
    const batch = changed.slice(i, i + 400);
    const values = batch
      .map((c) => `(${lit(c.id)}, ${lit(c.to)})`)
      .join(",\n    ");

    await sql(`
      update itk.articles a
      set title = v.title,
          -- Translated from the polluted headline, so it is wrong by
          -- construction. Nulling it re-queues the row.
          title_ko = null,
          translate_tries = 0
      from (values
    ${values}
      ) as v(id, title)
      where a.id = v.id`);

    done += batch.length;
    process.stdout.write(`  ${done}/${changed.length}\r`);
  }
  console.log(`\n✓ ${done.toLocaleString()}건 제목 정리 · 번역 재큐`);

  if (restyle > 0) {
    // The suffix was only half the problem: the old prompt produced "~입니다"
    // prose where a headline belonged. Those rows read fine to a checker and
    // badly to a reader, so they have to be re-queued by age, not by diff.
    const [{ n }] = await sql<{ n: number }>(`
      with t as (
        update itk.articles
        set title_ko = null, translate_tries = 0
        where published_at > now() - interval '${restyle} days'
          and title_ko is not null
          and (journalist_id is not null or cited_id is not null or official)
        returning 1
      ) select count(*)::int n from t`);
    console.log(`✓ 최근 ${restyle}일 ${n.toLocaleString()}건 재번역 대기열 추가`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
