/**
 * Translates headlines into Korean and stores them, so every browser gets
 * Korean without depending on a client-side API.
 *
 * Three engines, all reached the same way — whichever produced the Korean, the
 * result goes through `headlineKo` before it is stored, because no translator
 * writes headlines. That pass is where 서술체 becomes 명사형 and where Chelsea
 * becomes 첼시.
 *
 *   google    default. Google's public web-translate backend: no key, no quota
 *             to budget, and clearly better than MyMemory on this feed's
 *             languages. Unsupported, so every failure falls through.
 *   mymemory  the fallback, and the engine before Google. Free and documented,
 *             but weak — it renders a name as "브루노 기마랑이스 (Bruno
 *             Guimarães)". MYMEMORY_EMAIL raises its allowance from 5,000 to
 *             50,000 characters a day; as a fallback it now barely spends any.
 *   claude    used automatically when ANTHROPIC_API_KEY is set. The only engine
 *             that gets football naming and headline register right on its own,
 *             at roughly $2–8/month for this feed's ~145 stories a day.
 *
 *   npm run translate
 *   npm run translate -- --limit 200 --tier 1.5
 *   npm run translate -- --engine mymemory
 */
import "../lib/load-env";
import { rpc } from "../lib/supabase";
import { headlineKo } from "../lib/collect/korean";

const MYMEMORY_DAILY_CHARS = process.env.MYMEMORY_EMAIL ? 50_000 : 5_000;
/**
 * MyMemory throttles hard on bursts; Google is far more tolerant, and pacing a
 * 150-headline run at MyMemory's rate made every run take three minutes for no
 * reason once Google became the default.
 */
const GAP_MS = 700;
const GOOGLE_GAP_MS = 200;

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
 * Google's public web-translate backend — the one the translate.google.com page
 * itself calls. No key, no signup, and markedly better than MyMemory on the
 * languages this feed is actually in: it keeps names intact instead of
 * rendering "Bruno Guimarães" as "브루노 기마랑이스 (🗣️Bruno Guimarães)".
 *
 * It is not a supported API. There is no quota to budget against and no
 * contract either — it can rate-limit or change shape without notice — so every
 * failure falls through to MyMemory rather than dropping the headline.
 *
 * Its one systematic weakness, leaving club names in Latin script, is repaired
 * afterwards by `headlineKo` against the club registry.
 */
async function viaGoogle(text: string): Promise<string | null> {
  const params = new URLSearchParams({
    client: "gtx",
    sl: "auto",
    tl: "ko",
    dt: "t",
    q: text,
  });

  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?${params}`,
      { signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok) return null;

    // [[[chunk, source, ...], ...], ...] — a long headline arrives split.
    const body = (await res.json()) as [[string, string][]] | unknown;
    if (!Array.isArray(body) || !Array.isArray(body[0])) return null;

    const out = (body[0] as [string, string][])
      .map((seg) => (Array.isArray(seg) ? (seg[0] ?? "") : ""))
      .join("")
      .trim();

    if (!out || out === text) return null;
    return out;
  } catch {
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
    model: process.env.TRANSLATE_MODEL ?? "claude-opus-5",
    // Opus 5 thinks by default, and max_tokens caps thinking *plus* the
    // response — the 4,000 that was ample on Opus 4.8 truncates a 25-headline
    // batch here, and a truncated batch is lost JSON, not a short answer.
    max_tokens: 16000,
    system:
      "해외 축구 기사 제목을 한국 스포츠 매체의 헤드라인으로 옮긴다.\n\n" +
      "[문체] title_ko 는 기사 본문이 아니라 제목이다. 짧고 단정하게, 서술 종결어미" +
      "(~입니다/~습니다/~한다/~했다)를 쓰지 않는다.\n" +
      "  나쁨: 다니엘 말디니는 칼리아리의 새로운 선수입니다\n" +
      "  좋음: 말디니, 칼리아리행 확정\n" +
      "  나쁨: 브라이튼의 스쿼드 메이크업은 이번 여름에 바뀌고 있습니다\n" +
      "  좋음: 브라이튼 스쿼드, 이번 여름 세대교체\n" +
      "큰따옴표 안의 발언은 말투를 살리되 제목 길이로 줄인다.\n\n" +
      "[표기] 선수·감독·구단명은 국내 축구 커뮤니티 통용 표기를 따른다 " +
      "(Haaland→홀란, Tottenham→토트넘, Mbappé→음바페).\n" +
      "outlet 은 그 기사를 실은 매체 이름이다. 매체명과 기자 이름은 번역하지 않는다 — " +
      "제목에 남아 있으면 사람 이름이나 일반 명사로 옮기지 말고 그대로 두거나 뺀다.\n" +
      "(Defensa Central 을 '중앙 수비'로, Gianluca Di Marzio 를 선수 이름으로 옮기는 것이 " +
      "실제로 있었던 오역이다.)\n\n" +
      "[내용] 원문에 없는 내용을 덧붙이지 않고, 확정되지 않은 이적설을 확정처럼 쓰지 않는다. " +
      "summary 가 비어 있으면 summary_ko 도 빈 문자열로 둔다.",
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
          batch.map((b) => ({
            id: b.id,
            title: b.title,
            summary: b.snippet,
            outlet: b.source,
          })),
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
    p_items: items.map((i) => ({
      ...i,
      // Applied to every engine, not just the free ones. No translator can be
      // told "write a headline, not a sentence" for free, and even Claude's
      // output benefits from the club registry — this is the only place that
      // knows 첼시 is what we call Chelsea.
      title_ko: headlineKo(i.title_ko),
      summary_ko: i.summary_ko || null,
    })),
  });
}

async function main() {
  const limit = Number(arg("limit")) || 150;
  const maxTier = arg("tier") ? Number(arg("tier")) : 3;
  // Google needs no key and beats MyMemory on this feed, so it leads whenever
  // there is no Anthropic key. MyMemory stays behind it as the fallback, which
  // also means its daily character budget is now barely touched.
  const engine =
    arg("engine") ?? (process.env.ANTHROPIC_API_KEY ? "claude" : "google");

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

  // MyMemory meters by IP address, not by account — an anonymous request from
  // the same machine gets the same 429. Hosted CI runners draw a different IP
  // each run, so each run really does have its own allowance and the budget is
  // per run. The database total is a record of the day across all of them, not
  // the thing that gates a run.
  let spent = 0;
  const dayBefore = await rpc<number>("itk_translate_usage", { p_add: 0 });

  const flush = async () => {
    if (results.length) saved += await save(results.splice(0, results.length));
    if (misses.length) {
      await rpc<number>("itk_translate_failed", { p_ids: misses.splice(0, misses.length) });
    }
  };

  for (const item of pending) {
    const overBudget = spent + item.title.length > MYMEMORY_DAILY_CHARS;
    // Only MyMemory meters characters. Under Google the exhausted budget just
    // removes the fallback — stopping the run there would strand headlines
    // Google could still have handled.
    if (overBudget && engine !== "google") {
      console.log(
        `  오늘 한도(${MYMEMORY_DAILY_CHARS.toLocaleString()}자)에 도달해 중단합니다.` +
          (process.env.MYMEMORY_EMAIL ? "" : " MYMEMORY_EMAIL을 넣으면 10배로 늘어납니다."),
      );
      break;
    }

    try {
      // Google first when it is the chosen engine; MyMemory only picks up what
      // Google could not do, so it costs budget only on the exceptions.
      let ko = engine === "google" ? await viaGoogle(item.title) : null;
      if (!ko && !overBudget) {
        ko = await viaMyMemory(item.title, item.lang);
        spent += item.title.length;
      }
      if (ko) results.push({ id: item.id, title_ko: ko });
      // Recorded, so a headline the provider cannot handle stops returning to
      // the front of the queue and spending the budget again.
      else {
        misses.push(item.id);
        failed++;
      }
    } catch {
      // This IP is done for the day. The next run comes from another one, so
      // stopping here must not speak for it.
      console.log("  이 IP의 오늘 한도 소진 — 이번 실행만 중단합니다.");
      break;
    }

    // Flush periodically so a mid-run stop still saves progress.
    if (results.length + misses.length >= 25) await flush();
    await sleep(engine === "google" ? GOOGLE_GAP_MS : GAP_MS);
  }

  await flush();
  const dayTotal = await rpc<number>("itk_translate_usage", { p_add: spent });

  console.log(
    `✓ ${saved}건 번역 저장${failed ? ` · 실패 ${failed}건` : ""} · ` +
      `이번 실행 ${spent.toLocaleString()} / ${MYMEMORY_DAILY_CHARS.toLocaleString()}자` +
      ` · 오늘 누적 ${dayTotal.toLocaleString()}자 (이전 ${dayBefore.toLocaleString()})`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
