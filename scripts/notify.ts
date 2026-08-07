/**
 * Pushes new high-trust stories for your teams to Discord or Telegram.
 *
 * The in-browser alerts only fire while a tab is open, so this is the path that
 * reaches you when the browser is closed. Both transports are free.
 *
 * Env:
 *   NOTIFY_TEAMS=liverpool,arsenal   구독할 팀 (필수)
 *   NOTIFY_MAX_TIER=1                이 티어까지만 알림 (기본 1)
 *   DISCORD_WEBHOOK_URL=...          둘 중 하나 이상 설정
 *   TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=...
 */
import "../lib/load-env";
import { rpc } from "../lib/supabase";
import { getFeed } from "../lib/feed";
import { loadTeams } from "../lib/registry";
import { tierLabel } from "../lib/format";
import { ALL_TIERS } from "../lib/types";

async function sendDiscord(lines: string[]): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  // Discord caps a message at 2000 characters.
  for (const chunk of chunkLines(lines, 1900)) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: chunk }),
    });
    if (!res.ok) console.error(`Discord ${res.status}: ${await res.text()}`);
  }
}

async function sendTelegram(lines: string[]): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  for (const chunk of chunkLines(lines, 3800)) {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: chunk }),
    });
    if (!res.ok) console.error(`Telegram ${res.status}: ${await res.text()}`);
  }
}

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

async function main() {
  const teams = (process.env.NOTIFY_TEAMS ?? "").split(",").filter(Boolean);
  if (teams.length === 0) {
    console.log("NOTIFY_TEAMS가 비어 있어 알림을 건너뜁니다.");
    return;
  }
  if (!process.env.DISCORD_WEBHOOK_URL && !process.env.TELEGRAM_BOT_TOKEN) {
    console.log("알림 전송 채널이 설정되지 않아 건너뜁니다.");
    return;
  }

  const maxTier = Number(process.env.NOTIFY_MAX_TIER ?? 1);
  const teamMap = new Map(loadTeams().map((t) => [t.slug, t.ko]));

  const rows = await getFeed({
    teams,
    tiers: ALL_TIERS.filter((t) => t <= maxTier),
    limit: 30,
  });
  if (rows.length === 0) return;

  // Claim the ids first: the function returns only those it actually inserted,
  // so a concurrent or retried run can't send the same story twice. The
  // tradeoff is that a failed send is not retried — duplicates are worse than a
  // rare miss for something that runs every 20 minutes.
  const claimed = new Set(
    await rpc<string[]>("itk_mark_notified", { p_ids: rows.map((r) => r.id) }),
  );
  const toSend = rows.filter((r) => claimed.has(r.id));

  if (toSend.length === 0) {
    console.log("새로 알릴 기사가 없습니다.");
    return;
  }

  const lines = toSend.map((r) => {
    const names = r.teams.map((s) => teamMap.get(s)).filter(Boolean).join(", ");
    const who = r.journalistKo ? ` · ${r.journalistKo}` : "";
    return `[${tierLabel(r.tier)}${who}] ${r.titleKo ?? r.title}${names ? ` (${names})` : ""}\n${r.url}`;
  });

  await Promise.all([sendDiscord(lines), sendTelegram(lines)]);
  console.log(`✓ ${toSend.length}건 알림 전송`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
