/**
 * Pushes new stories to every registered Discord destination.
 *
 * Destinations live in the database, registered from the UI, rather than in
 * environment variables — one deployment can then serve several team/tier
 * combinations, and changing one doesn't need a redeploy.
 *
 * The in-browser alerts only fire while a tab is open; this is the path that
 * reaches you when the browser is closed.
 */
import "../lib/load-env";
import { rpc } from "../lib/supabase";
import { getFeed, type FeedRow } from "../lib/feed";
import { loadTeams } from "../lib/registry";
import { tierLabel } from "../lib/format";
import { ALL_TIERS } from "../lib/types";

interface Subscription {
  id: string;
  webhook_url: string;
  teams: string[];
  max_tier: number;
  /** never delivered to before — the backlog is baselined, not sent */
  first_run: boolean;
}

/** Discord rejects a message body over 2000 characters. */
const DISCORD_LIMIT = 1900;

function* chunkLines(lines: string[], max: number): Generator<string> {
  let buf = "";
  for (const line of lines) {
    if (buf.length + line.length + 1 > max) {
      yield buf;
      buf = "";
    }
    buf += (buf ? "\n" : "") + line;
  }
  if (buf) yield buf;
}

async function send(url: string, lines: string[]): Promise<boolean> {
  for (const chunk of chunkLines(lines, DISCORD_LIMIT)) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: chunk }),
    });

    if (res.status === 429) {
      // Discord asks for a wait rather than refusing outright.
      const retry = Number(res.headers.get("retry-after") ?? "1");
      await new Promise((r) => setTimeout(r, Math.min(retry * 1000, 10_000)));
      continue;
    }
    if (!res.ok) {
      console.error(`  전송 실패 ${res.status}: ${(await res.text()).slice(0, 120)}`);
      return false;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return true;
}

function format(rows: FeedRow[], teamName: (s: string) => string): string[] {
  // Oldest first, so a burst reads in the order the news actually broke.
  return rows
    .slice()
    .reverse()
    .map((r) => {
      const names = r.teams.map(teamName).filter(Boolean).join(", ");
      const who = r.journalistKo ?? r.citedKo;
      const label = r.official
        ? `공식 · ${r.source}`
        : `${tierLabel(r.tier)}${who ? ` · ${who}` : ""}`;
      return `**[${label}]** ${r.titleKo ?? r.title}${names ? `  \`${names}\`` : ""}\n${r.url}`;
    });
}

async function runOne(sub: Subscription, teamName: (s: string) => string): Promise<number> {
  const tiers = ALL_TIERS.filter((t) => t <= sub.max_tier);

  // Two queries rather than one. A tier filter deliberately excludes official
  // club posts — a club announcing its own signing isn't a reporter's word —
  // but those are exactly what should be pushed. The limit is generous because
  // anything falling out of the window is never claimed, so never sent later.
  const [tiered, everything] = await Promise.all([
    getFeed({ teams: sub.teams, tiers, limit: 120 }),
    getFeed({ teams: sub.teams, tieredOnly: true, limit: 120 }),
  ]);

  const rows = [...tiered, ...everything.filter((r) => r.official)]
    .filter((r, i, all) => all.findIndex((x) => x.id === r.id) === i)
    .sort((a, b) => b.publishedAt - a.publishedAt);

  if (rows.length === 0) return 0;

  // Claim first: the function returns only ids it actually inserted, so a
  // concurrent or retried run can't send the same story twice. The tradeoff is
  // that a failed send isn't retried — for something running every 20 minutes,
  // a rare miss beats duplicates.
  const claimed = new Set(
    await rpc<string[]>("itk_mark_notified", {
      p_sub: sub.id,
      p_ids: rows.map((r) => r.id),
    }),
  );
  const toSend = rows.filter((r) => claimed.has(r.id));
  if (toSend.length === 0) return 0;

  // A brand-new destination would otherwise receive every stored article in
  // one burst. The claim above already recorded them, so from here on only
  // genuinely new stories arrive.
  if (sub.first_run) {
    await rpc<number>("itk_subscription_failed", { p_id: sub.id, p_reset: true });
    console.log(`  ${sub.id.slice(0, 8)} 기준선 설정 (${toSend.length}건은 보내지 않음)`);
    return 0;
  }

  const ok = await send(sub.webhook_url, format(toSend, teamName));
  await rpc<number>("itk_subscription_failed", { p_id: sub.id, p_reset: ok });
  return ok ? toSend.length : 0;
}

async function main() {
  const subs = await rpc<Subscription[]>("itk_active_subscriptions");
  if (!subs || subs.length === 0) {
    console.log("등록된 디스코드 구독이 없습니다.");
    return;
  }

  const teams = new Map(loadTeams().map((t) => [t.slug, t.ko]));
  const teamName = (s: string) => teams.get(s) ?? s;

  let total = 0;
  for (const sub of subs) {
    try {
      const n = await runOne(sub, teamName);
      total += n;
      if (n > 0) console.log(`  ${sub.id.slice(0, 8)} → ${n}건`);
    } catch (err) {
      // One broken destination must not stop the others.
      console.error(
        `  ${sub.id.slice(0, 8)} 실패:`,
        err instanceof Error ? err.message : err,
      );
      await rpc<number>("itk_subscription_failed", { p_id: sub.id }).catch(() => {});
    }
  }

  console.log(`✓ 구독 ${subs.length}곳 · 전송 ${total}건`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
