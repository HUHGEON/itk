/**
 * Recomputes club tags for stored articles.
 *
 *   npm run retag
 *
 * detectTeams used to test every alias independently, so "Newcastle United"
 * also tagged Manchester United and "Atletico Madrid" also tagged Real Madrid.
 * The stored tags from before that fix are still wrong; this rewrites them.
 */
import "../lib/load-env";
import { rpc } from "../lib/supabase";
import { beatFallback, detectTeams } from "../lib/registry";

interface Row {
  id: string;
  title: string;
  snippet: string | null;
  journalist_teams: string[] | null;
}

async function main() {
  const items: Array<{ id: string; teams: string[] }> = [];
  let scanned = 0;

  for (let offset = 0; ; offset += 1000) {
    const page = await rpc<Row[]>("itk_articles_for_retag", { p_offset: offset });
    scanned += page.length;

    for (const r of page) {
      const detected = detectTeams(`${r.title} ${r.snippet ?? ""}`);
      // Same rule the collector uses: a story that names no club falls back to
      // the reporter's beat rather than being left untagged.
      const teams =
        detected.length > 0 ? detected : beatFallback(r.journalist_teams ?? []);
      items.push({ id: r.id, teams });
    }

    if (page.length < 1000) break;
  }

  let written = 0;
  for (let i = 0; i < items.length; i += 300) {
    written += await rpc<number>("itk_retag", { p_items: items.slice(i, i + 300) });
  }

  console.log(`클럽 태그 재계산: ${scanned}건 검사 · 태그 ${written}개 기록`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
