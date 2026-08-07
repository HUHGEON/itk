/**
 * Guesses the language of a headline.
 *
 * The translator needs the right pair — asking MyMemory for `en|ko` with a
 * Spanish headline returns the input unchanged, which is how a batch of Dutch
 * and Spanish stories sat untranslated. Tagging by outlet or by the reporter's
 * country isn't enough on its own: a Google News query for a Dutch reporter
 * returns English pieces too, and vice versa.
 *
 * Only the pairs MyMemory actually serves are worth distinguishing.
 */

/** Function words, which survive in even a short headline. */
const STOPWORDS: Record<string, string[]> = {
  en: ["the", "and", "for", "with", "his", "her", "from", "will", "has", "have",
       "after", "over", "into", "not", "but", "who", "than", "this", "that", "says"],
  es: ["el", "la", "los", "las", "de", "del", "que", "por", "para", "con",
       "una", "un", "su", "se", "no", "más", "como", "pero", "sobre", "al"],
  it: ["il", "lo", "la", "gli", "le", "di", "del", "che", "per", "con",
       "una", "un", "non", "più", "come", "ma", "su", "al", "dal", "nel"],
  fr: ["le", "la", "les", "des", "du", "de", "que", "pour", "avec", "une",
       "un", "sur", "pas", "plus", "dans", "au", "aux", "est", "son", "ses"],
  de: ["der", "die", "das", "und", "für", "mit", "von", "den", "dem", "ist",
       "nicht", "auch", "auf", "ein", "eine", "im", "zu", "bei", "nach", "wird"],
  nl: ["de", "het", "een", "van", "en", "voor", "met", "niet", "op", "dat",
       "is", "aan", "bij", "naar", "maar", "ook", "over", "zijn", "wordt", "om"],
  pt: ["o", "a", "os", "as", "de", "do", "da", "que", "para", "com",
       "uma", "um", "não", "mais", "como", "mas", "sobre", "no", "na", "ao"],
};

/** Characters that only appear in some of these languages. */
const HINTS: Array<[RegExp, string, number]> = [
  [/[ñ¿¡]/, "es", 3],
  [/[àèìòù]/, "it", 2],
  [/[çœ]|[éèê]/, "fr", 1],
  [/[äöüß]/, "de", 2],
  [/[ãõ]/, "pt", 3],
  [/\bij\b|\bzijn\b|\bheeft\b/i, "nl", 2],
];

const SUPPORTED = new Set(Object.keys(STOPWORDS));

/**
 * Returns a language code, or `fallback` when nothing scores clearly. A wrong
 * guess is worse than no guess: it burns quota and stores a mistranslation, so
 * ties resolve to the fallback rather than to the top scorer.
 */
export function detectLang(text: string, fallback = "en"): string {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length < 3) return fallback;

  const scores = new Map<string, number>();
  for (const [lang, list] of Object.entries(STOPWORDS)) {
    const set = new Set(list);
    let n = 0;
    for (const w of words) if (set.has(w)) n++;
    scores.set(lang, n);
  }

  for (const [re, lang, weight] of HINTS) {
    if (re.test(text)) scores.set(lang, (scores.get(lang) ?? 0) + weight);
  }

  const ranked = [...scores].sort((a, b) => b[1] - a[1]);
  const [top, topScore] = ranked[0];
  const secondScore = ranked[1]?.[1] ?? 0;

  // Needs both an absolute floor and a margin over the runner-up: "de" and "van"
  // are stopwords in several of these languages at once.
  if (topScore < 2 || topScore === secondScore) return fallback;
  return top;
}

export function isSupportedLang(lang: string): boolean {
  return SUPPORTED.has(lang);
}

/** The reporter's country as a prior, used when the text itself is ambiguous. */
export const COUNTRY_LANG: Record<string, string> = {
  Germany: "de", Austria: "de", Switzerland: "de",
  Spain: "es", Argentina: "es", Mexico: "es", Chile: "es", Colombia: "es",
  Italy: "it",
  France: "fr", Belgium: "fr",
  Netherlands: "nl",
  Portugal: "pt", Brazil: "pt",
};

export function langForCountry(country: string): string {
  return COUNTRY_LANG[country] ?? "en";
}
