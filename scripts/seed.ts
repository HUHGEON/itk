/** Loads the JSON registries into Supabase. Safe to re-run. */
import "../lib/load-env";
import { rpc } from "../lib/supabase";
import { loadJournalists, loadTeams } from "../lib/registry";

async function main() {
  const teams = loadTeams();
  if (teams.length === 0) {
    // The registry drives deletion downstream, so an unreadable file must stop
    // the run rather than be treated as "no teams exist".
    throw new Error(
      "data/teams.json 을 읽지 못했습니다. 프로젝트 루트에서 실행했는지 확인하세요.",
    );
  }

  await rpc<number>("itk_seed_teams", {
    p_items: teams.map((t) => ({
      slug: t.slug,
      ko: t.ko,
      en: t.en,
      league: t.league,
      aliases: t.aliases,
      crest: t.crest ?? null,
      fd_id: t.fdId ?? null,
    })),
  });

  const journalists = loadJournalists();
  if (journalists.length === 0) {
    console.warn("⚠ data/journalists.json이 비어 있습니다. 먼저 `npm run merge`를 실행하세요.");
  } else {
    await rpc<number>("itk_seed_journalists", {
      // `handle` rather than `x`: the column is named x, but a one-letter JSON
      // key is easy to mistype and the function maps it back.
      p_items: journalists.map((j) => ({
        id: j.id,
        ko: j.ko,
        en: j.en,
        tier: j.tier,
        league: j.league,
        country: j.country ?? "",
        outlet: j.outlet ?? "",
        handle: j.x ?? "",
        confidence: j.confidence ?? "medium",
        note: j.note ?? "",
        active: j.active,
        teams: j.teams,
      })),
    });
  }

  console.log(`✓ 팀 ${teams.length}개, 기자 ${journalists.length}명 시드 완료`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
