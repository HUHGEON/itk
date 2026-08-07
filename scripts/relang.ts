/**
 * Re-detects the source language of stored headlines.
 *
 *   npm run relang            아직 번역 안 된 기사만
 *   npm run relang -- --all   전체 다시 판별
 *
 * Rows collected before detection existed were all tagged `en`, so Spanish and
 * Dutch headlines were sent to the translator as `en|ko` and came back
 * unchanged — the single biggest cause of untranslated stories on screen.
 */
import "../lib/load-env";
import { rpc } from "../lib/supabase";
import { detectLang } from "../lib/collect/lang";

interface Row {
  id: string;
  title: string;
  lang: string | null;
}

async function main() {
  const all = process.argv.includes("--all");

  const rows: Row[] = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await rpc<Row[]>("itk_articles_for_lang", {
      p_only_untranslated: !all,
      p_offset: offset,
    });
    rows.push(...page);
    if (page.length < 1000) break;
  }

  const changed = rows
    .map((r) => ({ id: r.id, lang: detectLang(r.title, r.lang ?? "en") }))
    .filter((r, i) => r.lang !== (rows[i].lang ?? "en"));

  if (changed.length === 0) {
    console.log(`언어 재판별: ${rows.length}건 검사 · 변경 없음`);
    return;
  }

  let written = 0;
  for (let i = 0; i < changed.length; i += 500) {
    written += await rpc<number>("itk_set_langs", { p_items: changed.slice(i, i + 500) });
  }

  const byLang = new Map<string, number>();
  for (const c of changed) byLang.set(c.lang, (byLang.get(c.lang) ?? 0) + 1);
  const summary = [...byLang]
    .sort((a, b) => b[1] - a[1])
    .map(([l, n]) => `${l} ${n}`)
    .join(" · ");

  console.log(`언어 재판별: ${rows.length}건 검사 · ${written}건 수정 (${summary})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
