/**
 * Keeps collecting in the background so you never run `npm run collect` by hand.
 *
 *   npm run watch
 *
 * Runs the same rotation the GitHub Action uses, so a laptop and the deployed
 * cron behave identically:
 *
 *   hot   20분  0티어 27명 + 매체 41곳
 *   warm   1시간  1.5티어 이하를 3등분
 *   cold   6시간  전 티어를 4등분
 *
 * COLLECT_AT pins full sweeps to wall-clock times instead of an interval, for
 * when you want everything gathered before you sit down to read:
 *
 *   COLLECT_AT=08:30,13:00,19:00,23:30 npm run watch
 *
 * Ctrl+C to stop. Safe to run alongside `npm run dev`.
 */
import "../lib/load-env";
import { collect, type CollectStats } from "../lib/collect";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

const MINUTE = 60_000;

const BANDS = [
  { name: "hot", everyMs: 20 * MINUTE, opts: { maxTier: 0 } },
  { name: "warm", everyMs: 60 * MINUTE, opts: { maxTier: 1.5, skipOutlets: true }, of: 3 },
  { name: "cold", everyMs: 360 * MINUTE, opts: { maxTier: 3, skipOutlets: true }, of: 4 },
] as const;

function stamp(): string {
  return new Date().toLocaleTimeString("ko-KR", { hour12: false });
}

function summarise(band: string, s: CollectStats): string {
  return (
    `[${stamp()}] ${band.padEnd(4)} ` +
    `신규 ${String(s.inserted).padStart(4)}건 · ` +
    `응답 ${s.ok} / 304 ${s.notModified} / 실패 ${s.failed} · ` +
    `${(s.durationMs / 1000).toFixed(1)}s`
  );
}

async function runBand(band: (typeof BANDS)[number], turn: number) {
  try {
    const slice = "of" in band ? { index: turn % band.of, of: band.of } : undefined;
    const stats = await collect({ ...band.opts, slice });
    console.log(summarise(band.name, stats));

    // Titles are useless to a Korean reader in the original language, so
    // translate right after collecting rather than as a separate chore.
    if (stats.inserted > 0) {
      try {
        const { stdout } = await run("npx", ["tsx", "scripts/translate.ts", "--limit", "120"]);
        const line = stdout.split("\n").find((l) => l.startsWith("✓"));
        if (line) console.log(`         ↳ ${line.replace("✓ ", "")}`);
      } catch {
        // Translation is a nice-to-have; never let it stop collection.
      }
    }

    if (stats.failures.length > 0) {
      for (const f of stats.failures.slice(0, 5)) {
        console.log(`         ↳ ${f.label} — ${f.error}`);
      }
    }
  } catch (err) {
    // A failed cycle must not kill the loop; the next tick retries.
    console.error(`[${stamp()}] ${band.name} 실패:`, err instanceof Error ? err.message : err);
  }
}

/** "08:30,19:00" → minutes past midnight, local time. */
function parseTimes(raw: string | undefined): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      const [h, m] = t.split(":").map(Number);
      if (!Number.isFinite(h) || !Number.isFinite(m)) {
        throw new Error(`COLLECT_AT 형식이 잘못됐습니다: ${t} (예: 08:30)`);
      }
      return h * 60 + m;
    })
    .sort((a, b) => a - b);
}

async function main() {
  const times = parseTimes(process.env.COLLECT_AT);
  console.log(
    "수집기 시작 — hot 20분 / warm 1시간 / cold 6시간" +
      (times.length
        ? `\n전체 수집 예약: ${process.env.COLLECT_AT}`
        : "\n(COLLECT_AT 을 넣으면 지정 시각에 전체 수집)") +
      "\nCtrl+C 로 종료.\n",
  );

  let running = false;
  const turns = new Map<string, number>();

  // A single queue: two bands must never collect at once, or they fight over
  // the same feeds and each other's rate-limit budget.
  const tick = async (band: (typeof BANDS)[number]) => {
    if (running) return;
    running = true;
    const turn = turns.get(band.name) ?? 0;
    turns.set(band.name, turn + 1);
    await runBand(band, turn);
    running = false;
  };

  for (const band of BANDS) {
    setInterval(() => void tick(band), band.everyMs);
  }

  // Fires a full sweep the first minute each scheduled time is reached.
  if (times.length > 0) {
    let lastFired = -1;
    setInterval(() => {
      const now = new Date();
      const minute = now.getHours() * 60 + now.getMinutes();
      if (!times.includes(minute) || minute === lastFired) return;
      lastFired = minute;
      void (async () => {
        if (running) return;
        running = true;
        console.log(`[${stamp()}] 예약 수집 시작 (전 티어)`);
        await runBand({ name: "full", everyMs: 0, opts: { maxTier: 3 } } as never, 0);
        running = false;
      })();
    }, 30_000);
  }

  // Don't make the user wait 20 minutes to see the first result.
  await tick(BANDS[0]);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
