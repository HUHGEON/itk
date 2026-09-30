/**
 * Finding a player by whatever the reader types.
 *
 * Korean or English, with or without spaces, accents or hyphens, and by
 * initial consonants: "손흥민", "손 흥민", "Son Heung-min", "heungmin" and
 * "ㅅㅎㅁ" all find the same row. Answers are judged on the row the reader
 * picks, never on the string they typed, so which language they used does not
 * matter once a row is chosen.
 */
const CHOSEONG = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];

/** "손흥민" → "ㅅㅎㅁ"; anything that is not a Hangul syllable passes through. */
export function initials(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.charCodeAt(0) - 0xac00;
    out += code >= 0 && code < 11172 ? CHOSEONG[Math.floor(code / 588)] : ch;
  }
  return out;
}

/**
 * Drops accents from Latin letters and leaves Hangul intact.
 *
 * NFD and back to NFC, not NFKD. NFKD takes the accent off "é", but it also
 * splits every Hangul syllable into conjoining jamo and maps "ㅅ" to a
 * different code point - measured: afterwards "손흥민" and "ㅅㅎㅁ" found
 * nothing and only "son" did. Composing again after the marks are gone puts
 * the syllables back, and compatibility jamo are untouched by NFD.
 */
function unaccent(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC");
}

/** Lower case, no accents, no spaces or punctuation. */
export function fold(s: string): string {
  return unaccent(s)
    .toLowerCase()
    .replace(/[^0-9a-zㄱ-ㆎ가-힣]/g, "");
}

/*
 * Where Korean spellings of one foreign name part ways. Wikipedia follows the
 * official transliteration rules; fans write what they hear. Van Hecke is
 * "판헤케" on Wikipedia and "반헤케" in comments, Tzolis "졸리스" and
 * "촐리스". So a second, looser key: the leading consonant without its
 * aspiration or doubling (ㅍ/ㅃ→ㅂ, ㅊ/ㅉ→ㅈ, ㅋ/ㄲ→ㄱ, ㅌ/ㄸ→ㄷ, ㅆ→ㅅ) and ㅐ
 * as ㅔ, which Korean speakers no longer tell apart. It only ever ranks below
 * the spelling as written.
 */
const LOOSE_L: Record<number, number> = {
  1: 0,
  15: 0,
  4: 3,
  16: 3,
  8: 7,
  17: 7,
  10: 9,
  13: 12,
  14: 12,
};
const LOOSE_V: Record<number, number> = { 1: 5, 3: 7 };

/** A folded string with the loose spellings merged (see above). */
export function loose(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.charCodeAt(0) - 0xac00;
    if (code < 0 || code >= 11172) {
      out += ch;
      continue;
    }
    const l = Math.floor(code / 588);
    const v = Math.floor((code % 588) / 28);
    out += String.fromCharCode(0xac00 + (LOOSE_L[l] ?? l) * 588 + (LOOSE_V[v] ?? v) * 28 + (code % 28));
  }
  return out;
}

const ONLY_JAMO = /^[\u3131-\u314e]+$/;

export interface Searchable {
  ko: string;
  en: string;
  /** higher is better known; breaks ties */
  fame: number;
  /**
   * Other Korean spellings of the same person. The name shown is the one fans
   * use ("티아고 실바"); the Wikipedia spelling ("치아구 시우바") and any
   * aliases ("티아구 실바") still find him.
   */
  alt?: string[];
}

export interface Index<T extends Searchable> {
  items: T[];
  keys: {
    ko: string[];
    en: string;
    ini: string[];
    words: string[];
    koWords: string[];
    /** the same Korean keys, loosely spelled */
    koLoose: string[];
    koWordsLoose: string[];
  }[];
}

export function buildIndex<T extends Searchable>(items: T[]): Index<T> {
  return {
    items,
    keys: items.map((p) => keyOf(p)),
  };
}

function keyOf(p: Searchable): Index<Searchable>["keys"][number] {
  const ko = [p.ko, ...(p.alt ?? [])].map(fold);
  const koWords = [p.ko, ...(p.alt ?? [])].flatMap((n) => n.split(/\s+/).map(fold)).filter(Boolean);
  return {
    ko,
    en: fold(p.en),
    ini: [p.ko, ...(p.alt ?? [])].map((n) => initials(n.replace(/\s+/g, ""))),
    // "Son Heung-min" → ["son", "heungmin"], so a surname alone ranks well.
    words: unaccent(p.en)
      .toLowerCase()
      .split(/[\s]+/)
      .map(fold)
      .filter(Boolean),
    // "웨인 루니" → ["웨인", "루니"]: a surname typed on its own.
    koWords,
    koLoose: ko.map(loose),
    koWordsLoose: koWords.map(loose),
  };
}

export function search<T extends Searchable>(index: Index<T>, raw: string, limit = 8): T[] {
  const q = fold(raw);
  if (!q) return [];
  const jamo = ONLY_JAMO.test(q);
  const lq = loose(q);
  const hangul = /[가-힣]/.test(q);
  const scored: { i: number; s: number }[] = [];

  index.keys.forEach((k, i) => {
    let s = 0;
    if (jamo) {
      if (k.ini.some((i) => i.startsWith(q))) s = 60;
      else if (k.ini.some((i) => i.includes(q))) s = 30;
    } else if (k.ko.some((n) => n === q)) s = 100;
    else if (k.en === q) s = 100;
    // A whole word of the name beats a name that merely starts the same way:
    // with 40,000 players, "루니" put 루니 바르다지 above 웨인 루니.
    else if (k.koWords.includes(q) || k.words.includes(q)) s = 90;
    else if (k.ko.some((n) => n.startsWith(q)) || k.en.startsWith(q)) s = 80;
    else if (k.words.some((w) => w.startsWith(q))) s = 70;
    else if (k.ko.some((n) => n.includes(q)) || k.en.includes(q)) s = 40;
    // The same bands again for the loose spelling, each just under its
    // strict one, and a loose match can lift a weak strict one.
    if (hangul && s < 85) {
      if (k.koLoose.some((n) => n === lq)) s = 85;
      else if (s < 75 && k.koWordsLoose.includes(lq)) s = 75;
      else if (s < 65 && k.koLoose.some((n) => n.startsWith(lq))) s = 65;
      else if (s < 35 && lq.length >= 2 && k.koLoose.some((n) => n.includes(lq))) s = 35;
    }
    // Fame nudges within a band (up to 8 points), never across a whole one.
    if (s) scored.push({ i, s: s + Math.min(8, index.items[i].fame / 12) });
  });

  scored.sort((a, b) => b.s - a.s || index.items[b.i].fame - index.items[a.i].fame);
  return scored.slice(0, limit).map((x) => index.items[x.i]);
}
