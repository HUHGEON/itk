"use client";

/**
 * On-device translation via Chrome's built-in Translator API (stable in 138+).
 *
 * The alternative was paying an LLM per headline — roughly $3/month at this
 * volume. This runs in the browser, costs nothing, needs no key, and only
 * translates what is actually on screen. Unsupported browsers simply keep the
 * original text.
 *
 * Requires a user gesture for the first model download, which is why
 * translation is opt-in behind a toggle rather than automatic.
 */

interface TranslatorInstance {
  translate(text: string): Promise<string>;
}

interface TranslatorFactory {
  availability(opts: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
  create(opts: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (m: EventTarget) => void;
  }): Promise<TranslatorInstance>;
}

interface DetectorFactory {
  create(): Promise<{
    detect(text: string): Promise<{ detectedLanguage: string; confidence: number }[]>;
  }>;
}

declare global {
  // eslint-disable-next-line no-var
  var Translator: TranslatorFactory | undefined;
  // eslint-disable-next-line no-var
  var LanguageDetector: DetectorFactory | undefined;
}

const TARGET = "ko";

/** Languages our feeds actually publish in. */
const SUPPORTED = new Set(["en", "es", "it", "de", "fr", "nl", "pt"]);

export function translatorSupported(): boolean {
  return typeof globalThis.Translator !== "undefined";
}

const translators = new Map<string, Promise<TranslatorInstance | null>>();
const cache = new Map<string, string>();
let detector: ReturnType<DetectorFactory["create"]> | null = null;

async function detectLanguage(text: string): Promise<string> {
  if (typeof globalThis.LanguageDetector === "undefined") return "en";
  try {
    detector ??= globalThis.LanguageDetector.create();
    const results = await (await detector).detect(text);
    const best = results[0];
    // Below this the guess is worse than just assuming English.
    if (!best || best.confidence < 0.5) return "en";
    return SUPPORTED.has(best.detectedLanguage) ? best.detectedLanguage : "en";
  } catch {
    return "en";
  }
}

function translatorFor(source: string): Promise<TranslatorInstance | null> {
  const existing = translators.get(source);
  if (existing) return existing;

  const created = (async () => {
    const factory = globalThis.Translator;
    if (!factory) return null;
    try {
      const state = await factory.availability({
        sourceLanguage: source,
        targetLanguage: TARGET,
      });
      if (state === "unavailable") return null;
      return await factory.create({ sourceLanguage: source, targetLanguage: TARGET });
    } catch {
      return null;
    }
  })();

  translators.set(source, created);
  return created;
}

/** Returns Korean, or the original string when translation isn't possible. */
export async function toKorean(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return text;

  const hit = cache.get(trimmed);
  if (hit !== undefined) return hit;

  // Already Korean — the Hangul range is a cheap and reliable check.
  if (/[가-힣]/.test(trimmed)) {
    cache.set(trimmed, trimmed);
    return trimmed;
  }

  const source = await detectLanguage(trimmed);
  const translator = await translatorFor(source);
  if (!translator) {
    cache.set(trimmed, trimmed);
    return trimmed;
  }

  try {
    const out = await translator.translate(trimmed);
    cache.set(trimmed, out);
    return out;
  } catch {
    cache.set(trimmed, trimmed);
    return trimmed;
  }
}
