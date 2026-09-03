/**
 * Fills in summaries and images for feed stories that arrived with neither.
 *
 *   npm run hydrate                 기본 60건
 *   npm run hydrate -- --limit 200
 *
 * Runs after collection. Bounded per run because each article costs one or two
 * page fetches, and the point is a steady drain rather than a burst that gets
 * the collector rate-limited.
 */
import "../lib/load-env";
import { rpc } from "../lib/supabase";
import { hydrateOne, type Hydrated } from "../lib/collect/hydrate";
import { matchByline } from "../lib/collect/byline";
import { loadJournalists } from "../lib/registry";

/** Concurrency is per-host, not global: news.google.com is the bottleneck. */
const CONCURRENCY = 4;
const HOST_GAP_MS = 700;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const lastHit = new Map<string, number>();

async function throttle(url: string) {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return;
  }
  const prev = lastHit.get(host) ?? 0;
  const wait = prev + HOST_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastHit.set(host, Date.now());
}

async function main() {
  const limit = Number(arg("limit") ?? 60);
  const pending = await rpc<Array<{ id: string; url: string }>>("itk_hydrate_pending", {
    p_limit: limit,
  });

  if (pending.length === 0) {
    // Still worth a merge pass: a previous run may have resolved a wrapper
    // whose twin only arrived from the outlet feed afterwards.
    const merged = await rpc<number>("itk_dedupe_resolved", {});
    console.log(`본문 요약: 대상 없음 · 중복병합 ${merged}`);
    return;
  }

  const done: Hydrated[] = [];
  let cursor = 0;

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, pending.length) }, async () => {
      while (cursor < pending.length) {
        const row = pending[cursor++];
        await throttle(row.url);
        try {
          done.push(await hydrateOne(row));
        } catch {
          // Stamp it anyway so one poison URL can't block the queue forever.
          done.push({ id: row.id, snippet: "", image_url: "", resolved_url: "" });
        }
      }
    }),
  );

  // The page said what the headline would not: drop these rather than store a
  // summary for something the feed does not cover.
  const womens = done.filter((d) => d.womens).map((d) => d.id);
  const dropped = womens.length
    ? await rpc<number>("itk_drop_articles", { p_ids: womens })
    : 0;

  /**
   * A name off the page can also be a reporter we follow.
   *
   * The collector only ever sees the byline a feed chose to publish, and most
   * do not publish one. Matching here as well is what turns a scraped name into
   * a tier: the row stops being "기자 미확인" and starts carrying the trust
   * level of whoever actually wrote it.
   */
  const journalists = loadJournalists();
  const rows = done
    .filter((d) => !d.womens)
    .map((d) => {
      const j = matchByline(d.byline, journalists);
      return j
        ? { ...d, journalist_id: j.id, tier: j.tier }
        : { ...d, journalist_id: null, tier: null };
    });
  const matched = rows.filter((r) => r.journalist_id).length;
  const named = rows.filter((r) => r.byline).length;

  const written = await rpc<number>("itk_hydrate_apply", { p_rows: rows });
  // Only now can the wrapper links be matched against the outlet's own, so the
  // merge belongs here rather than in the collector.
  const merged = await rpc<number>("itk_dedupe_resolved", {});
  const gotText = done.filter((d) => !d.womens && d.snippet).length;
  const gotImage = done.filter((d) => d.image_url).length;
  const gotUrl = done.filter((d) => d.resolved_url).length;

  console.log(
    `본문 요약: ${pending.length}건 시도 · 요약 ${gotText} · 이미지 ${gotImage} · ` +
      `원문링크 ${gotUrl} · 기록 ${written} · 중복병합 ${merged}` +
      (dropped ? ` · 여자축구 ${dropped}건 제외` : "") +
      `\n  저자: 이름 확보 ${named} · 추적 기자 매칭 ${matched}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
