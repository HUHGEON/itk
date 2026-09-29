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
  keys: { ko: string[]; en: string; ini: string[]; words: string[]; koWords: string[] }[];
}

export function buildIndex<T extends Searchable>(items: T[]): Index<T> {
  return {
    items,
    keys: items.map((p) => ({
      ko: [p.ko, ...(p.alt ?? [])].map(fold),
      en: fold(p.en),
      ini: [p.ko, ...(p.alt ?? [])].map((n) => initials(n.replace(/\s+/g, ""))),
      // "Son Heung-min" → ["son", "heungmin"], so a surname alone ranks well.
      words: unaccent(p.en)
        .toLowerCase()
        .split(/[\s]+/)
        .map(fold)
        .filter(Boolean),
      // "웨인 루니" → ["웨인", "루니"]: a surname typed on its own.
      koWords: [p.ko, ...(p.alt ?? [])].flatMap((n) => n.split(/\s+/).map(fold)).filter(Boolean),
    })),
  };
}

export function search<T extends Searchable>(index: Index<T>, raw: string, limit = 8): T[] {
  const q = fold(raw);
  if (!q) return [];
  const jamo = ONLY_JAMO.test(q);
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
    // Fame nudges within a band (up to 8 points), never across a whole one.
    if (s) scored.push({ i, s: s + Math.min(8, index.items[i].fame / 12) });
  });

  scored.sort((a, b) => b.s - a.s || index.items[b.i].fame - index.items[a.i].fame);
  return scored.slice(0, limit).map((x) => index.items[x.i]);
}
