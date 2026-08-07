/**
 * Runs one collection pass.
 *
 *   npm run collect                      전 티어 + 매체 피드
 *   npm run collect -- --tier 0          0티어만 (빠름)
 *   npm run collect -- --slice 1/3       기자 명단을 3등분해 두 번째 조각만
 *   npm run collect -- --no-outlets
 *
 * --slice 는 한 번에 날리는 요청 수를 줄여 429를 피하기 위한 것이다.
 * 0티어는 매 실행마다, 아래 티어는 조각을 돌려가며 가져온다.
 */
import "../lib/load-env";
import { COLLECT_DAYS, collect } from "../lib/collect";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function parseSlice(raw: string | undefined) {
  if (!raw) return undefined;
  const [index, of] = raw.split("/").map(Number);
  if (!Number.isFinite(index) || !Number.isFinite(of) || of < 1) {
    throw new Error(`--slice 형식이 잘못됐습니다: ${raw} (예: 1/3)`);
  }
  return { index, of };
}

async function main() {
  const stats = await collect({
    maxTier: arg("tier") ? Number(arg("tier")) : 3,
    skipOutlets: process.argv.includes("--no-outlets"),
    slice: parseSlice(arg("slice")),
  });

  const secs = (stats.durationMs / 1000).toFixed(1);
  console.log(
    `✓ ${secs}s · 기자 ${stats.journalistsQueried}명 (Bluesky ${stats.blueskyQueried}명) / ` +
      `매체 ${stats.outletsQueried}곳 / 구단공식 ${stats.clubsQueried}곳\n` +
      `  응답 ${stats.ok} · 변경없음(304) ${stats.notModified} · ` +
      `실패 ${stats.failed} · 쿨다운 ${stats.skipped}\n` +
      `  수집 ${stats.itemsSeen}건 (발행 ${COLLECT_DAYS}일 초과 ${stats.tooOld}건 제외) → ` +
      `중복 제거 ${stats.itemsUnique}건 → 신규 ${stats.inserted}건\n` +
      `  보존기간 지나 삭제 ${stats.pruned}건`,
  );

  if (stats.failures.length > 0) {
    console.log(`\n실패한 소스 ${stats.failures.length}곳:`);
    for (const f of stats.failures.slice(0, 15)) {
      console.log(`  · ${f.label} — ${f.error}`);
    }
    if (stats.failures.length > 15) {
      console.log(`  … 외 ${stats.failures.length - 15}곳`);
    }
  }

  // A run where most sources failed means the IP is throttled or a feed format
  // changed — surface it as a non-zero exit so CI goes red instead of quietly
  // collecting nothing.
  const attempted = stats.ok + stats.notModified + stats.failed;
  if (attempted > 0 && stats.failed / attempted > 0.5) {
    console.error("\n⚠ 절반 이상의 소스가 실패했습니다. 차단 또는 피드 변경을 의심하세요.");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
