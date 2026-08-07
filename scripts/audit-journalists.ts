/**
 * Finds reporters who are on the list but never produce a story, and says why.
 *
 *   npm run audit                    기사 0건인 기자 전체
 *   npm run audit -- --tier 1        1티어 이하만
 *   npm run audit -- --json out.json
 *
 * For each one it runs the same Google News query the collector uses, then the
 * same query without the club filter. Comparing the two separates "nobody
 * writes about them" from "our query is too narrow".
 */
import "../lib/load-env";
import { rpc } from "../lib/supabase";
import { loadJournalists, loadTeams } from "../lib/registry";
import { googleNewsUrl } from "../lib/collect/sources";
import fs from "node:fs";

/** Anything older than this is dropped at collection time anyway. */
const FRESH_DAYS = 60;

type Verdict =
  | "구단필터가좁음"   // fresh hits exist, but only without the club filter
  | "이름불일치"       // no hits at all, so the English name is likely wrong
  | "오래된결과만"     // the name matches, but nothing inside the retention window
  | "수집가능"         // fresh hits with the club filter — should be landing
  | "확인불가";

interface Probe {
  total: number;
  fresh: number;
  newest: string | null;
}

interface Finding {
  id: string;
  ko: string;
  en: string;
  tier: number;
  country: string;
  outlet: string;
  teams: string[];
  withClubs: Probe;
  nameOnly: Probe;
  verdict: Verdict;
}

/**
 * Plain request rather than the collector's fetcher: that one sends conditional
 * headers from feed_state and would answer 304 for a feed it has already seen,
 * which says nothing about whether the query matches anything.
 */
async function probe(url: string): Promise<Probe | null> {
  await new Promise((r) => setTimeout(r, 500));
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ITKplus/1.0)" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const xml = await res.text();

    // A hit count alone is misleading: Google will happily return 84 pieces
    // whose newest is three months old, and the collector drops every one of
    // them. Freshness is what decides whether a reporter can ever land.
    const items = xml.split("<item>").slice(1);
    const cutoff = Date.now() - FRESH_DAYS * 86_400_000;
    let fresh = 0;
    let newest = 0;

    for (const item of items) {
      const raw = item.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1];
      const at = raw ? Date.parse(raw) : NaN;
      if (!Number.isFinite(at)) continue;
      if (at > newest) newest = at;
      if (at >= cutoff) fresh++;
    }

    return {
      total: items.length,
      fresh,
      newest: newest ? new Date(newest).toISOString().slice(0, 10) : null,
    };
  } catch {
    return null;
  }
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const maxTier = arg("tier") ? Number(arg("tier")) : 3;

  const zero = await rpc<Array<{ id: string; n: number }>>("itk_journalist_counts", {});
  const idle = new Set(zero.filter((r) => Number(r.n) === 0).map((r) => r.id));

  const teams = loadTeams();
  const teamEn = new Map(teams.map((t) => [t.slug, t.en]));
  const targets = loadJournalists().filter(
    (j) => j.active && j.tier <= maxTier && idle.has(j.id),
  );

  console.log(`기사 0건 기자 ${targets.length}명 점검\n`);

  const findings: Finding[] = [];

  for (const j of targets) {
    const teamNames = j.teams
      .map((s) => teamEn.get(s))
      .filter((n): n is string => Boolean(n));

    const a = await probe(googleNewsUrl({ name: j.en, country: j.country, teamNames }));
    const b = await probe(googleNewsUrl({ name: j.en, country: j.country, teamNames: [] }));

    let verdict: Verdict;
    if (!a || !b) verdict = "확인불가";
    else if (a.fresh > 0) verdict = "수집가능";
    else if (b.fresh > 0) verdict = "구단필터가좁음";
    else if (a.total > 0 || b.total > 0) verdict = "오래된결과만";
    else verdict = "이름불일치";

    findings.push({
      id: j.id, ko: j.ko, en: j.en, tier: j.tier,
      country: j.country, outlet: j.outlet, teams: j.teams,
      withClubs: a ?? { total: -1, fresh: -1, newest: null },
      nameOnly: b ?? { total: -1, fresh: -1, newest: null },
      verdict,
    });

    console.log(
      `${verdict.padEnd(8)} ${String(j.tier).padStart(3)}티어  ${j.ko} (${j.en})\n` +
        `           구단포함 ${a?.fresh ?? "?"}/${a?.total ?? "?"} 신선 · ` +
        `이름만 ${b?.fresh ?? "?"}/${b?.total ?? "?"} 신선 · 최신 ${b?.newest ?? "-"}`,
    );
  }

  const by = new Map<Verdict, number>();
  for (const f of findings) by.set(f.verdict, (by.get(f.verdict) ?? 0) + 1);
  console.log(
    "\n요약: " + [...by].map(([v, n]) => `${v} ${n}`).join(" · "),
  );

  const out = arg("json");
  if (out) {
    fs.writeFileSync(out, JSON.stringify(findings, null, 2));
    console.log(`→ ${out}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
