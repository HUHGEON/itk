/**
 * Translates headlines into Korean and stores them, so every browser gets
 * Korean without depending on a client-side API.
 *
 * Default engine is MyMemory: free, no key, no signup. Setting
 * MYMEMORY_EMAIL raises the daily allowance from 5,000 to 50,000 characters —
 * at ~70 characters a headline that's ~70/day anonymous versus ~700/day, and
 * this feed produces roughly 130 attributable stories a day.
 *
 * ANTHROPIC_API_KEY, when present, is used instead: better handling of football
 * names and Korean club conventions, at roughly $3/month for this volume.
 *
 *   npm run translate
 *   npm run translate -- --limit 200 --tier 1.5
 *   npm run translate -- --engine claude
 */
import "../lib/load-env";
import { rpc } from "../lib/supabase";

const MYMEMORY_DAILY_CHARS = process.env.MYMEMORY_EMAIL ? 50_000 : 5_000;
/** MyMemory throttles hard on bursts. */
const GAP_MS = 700;

interface Pending {
  id: string;
  title: string;
  snippet: string;
  source: string;
  tier: number | null;
  lang: string;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPending(limit: number, maxTier: number): Promise<Pending[]> {
  const rows = await rpc<
    {
      id: string; title: string; snippet: string | null;
      source: string | null; tier: number | null; lang: string | null;
    }[]
  >("itk_pending_translations", { p_limit: limit, p_max_tier: maxTier });

  return (rows ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    snippet: r.snippet ?? "",
    source: r.source ?? "",
    tier: r.tier,
    lang: r.lang ?? "en",
  }));
}

/** Already Korean — nothing to do, and it would come back mangled. */
function isKorean(text: string): boolean {
  return /[가-힣]/.test(text);
}

/** Pairs MyMemory actually serves; anything else is treated as English. */
const PAIRS = new Set(["en", "es", "it", "fr", "de", "nl", "pt"]);

async function viaMyMemory(text: string, lang: string): Promise<string | null> {
  const source = PAIRS.has(lang) ? lang : "en";
  const params = new URLSearchParams({ q: text, langpair: `${source}|ko` });
  if (process.env.MYMEMORY_EMAIL) params.set("de", process.env.MYMEMORY_EMAIL);

  try {
    const res = await fetch(`https://api.mymemory.translated.net/get?${params}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;

    const body = (await res.json()) as {
      responseData?: { translatedText?: string };
      responseStatus?: number | string;
      quotaFinished?: boolean;
    };

    if (body.quotaFinished) throw new Error("QUOTA");
    if (Number(body.responseStatus) !== 200) return null;

    const out = body.responseData?.translatedText?.trim();
    // The API echoes the input, or shouts an error in caps, when it can't help.
    if (!out || out === text || /^[A-Z '.]+$/.test(out)) return null;
    return out;
  } catch (err) {
    if (err instanceof Error && err.message === "QUOTA") throw err;
    return null;
  }
}

async function viaClaude(batch: Pending[]): Promise<Map<string, string>> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();

  const res = await client.messages.create({
    model: process.env.TRANSLATE_MODEL ?? "claude-opus-4-8",
    max_tokens: 4000,
    system:
      "해외 축구 헤드라인을 한국어로 옮긴다. 선수·감독·구단명은 국내 축구 커뮤니티 통용 표기를 " +
      "따른다 (Haaland→홀란, Tottenham→토트넘). 원문에 없는 내용을 덧붙이지 않고, 확정되지 않은 " +
      "이적설을 확정처럼 쓰지 않는다.",
    output_config: {
      effort: "low",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: { id: { type: "string" }, title_ko: { type: "string" } },
                required: ["id", "title_ko"],
                additionalProperties: false,
              },
            },
          },
          required: ["items"],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: "user",
        content: `id는 그대로 돌려줘.\n\n${JSON.stringify(
          batch.map((b) => ({ id: b.id, title: b.title })),
        )}`,
      },
    ],
  });

  const out = new Map<string, string>();
  if (res.stop_reason === "refusal") return out;

  const text = res.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") return out;

  // A truncated response (stop_reason "max_tokens") leaves invalid JSON. Losing
  // one batch is fine; letting it throw would abandon every batch after it.
  try {
    const parsed = JSON.parse(text.text) as { items?: { id: string; title_ko: string }[] };
    for (const it of parsed.items ?? []) {
      if (it?.id && it.title_ko) out.set(it.id, it.title_ko);
    }
  } catch {
    console.warn(`  ⚠ 배치 응답을 해석하지 못했습니다 (stop_reason: ${res.stop_reason})`);
  }
  return out;
}

async function save(items: { id: string; title_ko: string }[]): Promise<number> {
  if (items.length === 0) return 0;
  return rpc<number>("itk_apply_translations", {
    p_items: items.map((i) => ({ ...i, summary_ko: null })),
  });
}

async function main() {
  const limit = Number(arg("limit")) || 150;
  const maxTier = arg("tier") ? Number(arg("tier")) : 3;
  const engine =
    arg("engine") ?? (process.env.ANTHROPIC_API_KEY ? "claude" : "mymemory");

  const pending = (await fetchPending(limit, maxTier)).filter((p) => !isKorean(p.title));
  if (pending.length === 0) {
    console.log("번역할 기사가 없습니다.");
    return;
  }

  console.log(`${pending.length}건 · 엔진 ${engine}`);

  if (engine === "claude") {
    let done = 0;
    for (let i = 0; i < pending.length; i += 25) {
      const batch = pending.slice(i, i + 25);
      const map = await viaClaude(batch);
      done += await save([...map].map(([id, title_ko]) => ({ id, title_ko })));
      console.log(`  ${Math.min(i + 25, pending.length)}/${pending.length}`);
    }
    console.log(`✓ ${done}건 번역 완료 (claude)`);
    return;
  }

  const results: { id: string; title_ko: string }[] = [];
  let chars = 0;
  let failed = 0;
  let saved = 0;

  for (const item of pending) {
    if (chars + item.title.length > MYMEMORY_DAILY_CHARS) {
      console.log(
        `  일일 한도(${MYMEMORY_DAILY_CHARS.toLocaleString()}자)에 도달해 중단합니다.` +
          (process.env.MYMEMORY_EMAIL ? "" : " MYMEMORY_EMAIL을 넣으면 10배로 늘어납니다."),
      );
      break;
    }

    try {
      const ko = await viaMyMemory(item.title, item.lang);
      chars += item.title.length;
      if (ko) results.push({ id: item.id, title_ko: ko });
      else failed++;
    } catch {
      console.log("  MyMemory 쿼터 소진 — 중단합니다.");
      break;
    }

    // Flush periodically so a mid-run stop still saves progress.
    if (results.length >= 25) {
      saved += await save(results.splice(0, results.length));
    }
    await sleep(GAP_MS);
  }

  saved += await save(results);
  console.log(
    `✓ ${saved}건 번역 저장 · 사용 ${chars.toLocaleString()}자 / ` +
      `한도 ${MYMEMORY_DAILY_CHARS.toLocaleString()}자` +
      (failed ? ` · 실패 ${failed}건` : ""),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
