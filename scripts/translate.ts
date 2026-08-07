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
  /** already translated — the row is only here for its body */
  titleKo: string | null;
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

async function fetchPending(
  limit: number,
  maxTier: number,
  bodies: boolean,
): Promise<Pending[]> {
  const rows = await rpc<
    {
      id: string; title: string; title_ko: string | null; snippet: string | null;
      source: string | null; tier: number | null; lang: string | null;
    }[]
  >("itk_pending_translations", {
    p_limit: limit,
    p_max_tier: maxTier,
    p_bodies: bodies,
  });

  return (rows ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    titleKo: r.title_ko,
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

async function askMyMemory(text: string, source: string): Promise<string | null> {
  const params = new URLSearchParams({ q: text, langpair: `${source}|ko` });
  if (process.env.MYMEMORY_EMAIL) params.set("de", process.env.MYMEMORY_EMAIL);

  try {
    const res = await fetch(`https://api.mymemory.translated.net/get?${params}`, {
      signal: AbortSignal.timeout(15_000),
    });
    // 429 is the daily allowance, not a bad headline.
    if (res.status === 429) throw new Error("QUOTA");
    if (!res.ok) return null;

    const body = (await res.json()) as {
      responseData?: { translatedText?: string };
      responseStatus?: number | string;
      responseDetails?: string;
      quotaFinished?: boolean;
    };

    // The warning arrives as prose in a 200 as often as it does as a 429.
    // Counting it as a failure marked good headlines untranslatable.
    if (body.quotaFinished || /USED ALL AVAILABLE/i.test(body.responseDetails ?? "")) {
      throw new Error("QUOTA");
    }
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

/**
 * MyMemory's own detector, with ours as the fallback.
 *
 * Asking for the wrong pair returns the input unchanged, and our detector is
 * right about 91% of the time — `Autodetect` gets the remainder without a
 * second request in the common case.
 */
async function viaMyMemory(text: string, lang: string): Promise<string | null> {
  const auto = await askMyMemory(text, "Autodetect");
  if (auto) return auto;

  const source = PAIRS.has(lang) ? lang : "en";
  if (source === "en") return null;
  await sleep(GAP_MS);
  return askMyMemory(text, source);
}

interface Translated {
  title_ko: string;
  summary_ko: string;
}

async function viaClaude(batch: Pending[]): Promise<Map<string, Translated>> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();

  const res = await client.messages.create({
    model: process.env.TRANSLATE_MODEL ?? "claude-opus-4-8",
    max_tokens: 4000,
    system:
      "해외 축구 기사를 한국어로 옮긴다. 선수·감독·구단명은 국내 축구 커뮤니티 통용 표기를 " +
      "따른다 (Haaland→홀란, Tottenham→토트넘). 원문에 없는 내용을 덧붙이지 않고, 확정되지 않은 " +
      "이적설을 확정처럼 쓰지 않는다. summary 가 비어 있으면 summary_ko 도 빈 문자열로 둔다.",
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
                properties: {
                  id: { type: "string" },
                  title_ko: { type: "string" },
                  summary_ko: { type: "string" },
                },
                required: ["id", "title_ko", "summary_ko"],
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
          batch.map((b) => ({ id: b.id, title: b.title, summary: b.snippet })),
        )}`,
      },
    ],
  });

  const out = new Map<string, Translated>();
  if (res.stop_reason === "refusal") return out;

  const text = res.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") return out;

  // A truncated response (stop_reason "max_tokens") leaves invalid JSON. Losing
  // one batch is fine; letting it throw would abandon every batch after it.
  try {
    const parsed = JSON.parse(text.text) as { items?: (Translated & { id: string })[] };
    for (const it of parsed.items ?? []) {
      if (it?.id && it.title_ko) {
        out.set(it.id, { title_ko: it.title_ko, summary_ko: it.summary_ko ?? "" });
      }
    }
  } catch {
    console.warn(`  ⚠ 배치 응답을 해석하지 못했습니다 (stop_reason: ${res.stop_reason})`);
  }
  return out;
}

async function save(
  items: { id: string; title_ko: string; summary_ko?: string }[],
): Promise<number> {
  if (items.length === 0) return 0;
  return rpc<number>("itk_apply_translations", {
    p_items: items.map((i) => ({ ...i, summary_ko: i.summary_ko || null })),
  });
}

async function main() {
  const limit = Number(arg("limit")) || 150;
  const maxTier = arg("tier") ? Number(arg("tier")) : 3;
  const engine =
    arg("engine") ?? (process.env.ANTHROPIC_API_KEY ? "claude" : "mymemory");

  const pending = (await fetchPending(limit, maxTier, engine === "claude")).filter(
    (p) => !isKorean(p.title),
  );
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
      done += await save([...map].map(([id, t]) => ({ id, ...t })));
      console.log(`  ${Math.min(i + 25, pending.length)}/${pending.length}`);
    }
    console.log(`✓ ${done}건 번역 완료 (claude)`);
    return;
  }

  const results: { id: string; title_ko: string }[] = [];
  const misses: string[] = [];
  let saved = 0;
  // Counted separately: flush() empties `misses`, so its length is not a total.
  let failed = 0;

  // The day's spend lives in the database. CI starts a fresh process every
  // twenty minutes, and a counter in a local variable meant each of those runs
  // believed it had the whole day's allowance to itself.
  let spent = await rpc<number>("itk_translate_usage", { p_add: 0 });
  const startedAt = spent;

  const flush = async () => {
    if (results.length) saved += await save(results.splice(0, results.length));
    if (misses.length) {
      await rpc<number>("itk_translate_failed", { p_ids: misses.splice(0, misses.length) });
    }
  };

  for (const item of pending) {
    if (spent + item.title.length > MYMEMORY_DAILY_CHARS) {
      console.log(
        `  오늘 한도(${MYMEMORY_DAILY_CHARS.toLocaleString()}자)에 도달해 중단합니다.` +
          (process.env.MYMEMORY_EMAIL ? "" : " MYMEMORY_EMAIL을 넣으면 10배로 늘어납니다."),
      );
      break;
    }

    try {
      const ko = await viaMyMemory(item.title, item.lang);
      spent = await rpc<number>("itk_translate_usage", { p_add: item.title.length });
      if (ko) results.push({ id: item.id, title_ko: ko });
      // Recorded, so a headline the provider cannot handle stops returning to
      // the front of the queue and spending the budget again.
      else {
        misses.push(item.id);
        failed++;
      }
    } catch {
      // Park the rest of the day: the next CI run in twenty minutes would
      // otherwise spend a request rediscovering the same limit.
      spent = await rpc<number>("itk_translate_usage", { p_add: MYMEMORY_DAILY_CHARS });
      console.log("  MyMemory 오늘 한도 소진 — 중단합니다 (내일 재개).");
      break;
    }

    // Flush periodically so a mid-run stop still saves progress.
    if (results.length + misses.length >= 25) await flush();
    await sleep(GAP_MS);
  }

  await flush();

  console.log(
    `✓ ${saved}건 번역 저장${failed ? ` · 실패 ${failed}건` : ""} · ` +
      `오늘 사용 ${spent.toLocaleString()} / ${MYMEMORY_DAILY_CHARS.toLocaleString()}자` +
      ` (이번 실행 ${(spent - startedAt).toLocaleString()}자)`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
