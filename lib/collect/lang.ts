/**
 * Guesses the language of a headline.
 *
 * The translator needs the right pair — asking MyMemory for `en|ko` with a
 * Spanish headline returns the input unchanged, which is how a batch of Dutch
 * and Spanish stories sat untranslated. Tagging by outlet or by the reporter's
 * country isn't enough on its own: a Google News query for a Dutch reporter
 * returns English pieces too, and vice versa.
 *
 * Accuracy is measured against real headlines from single-language outlets —
 * `npm run lang:bench`. Only the pairs MyMemory serves are distinguished.
 */

/**
 * Function words. A headline is short, so this needs to be wide enough that
 * something lands: with twenty words per language, most Dutch headlines scored
 * one and fell through to the fallback.
 */
const STOPWORDS: Record<string, string[]> = {
  en: [
    "the", "and", "for", "with", "his", "her", "from", "will", "has", "have",
    "after", "over", "into", "not", "but", "who", "than", "this", "that", "says",
    "was", "were", "are", "been", "their", "they", "them", "its", "out", "off",
    "back", "new", "how", "why", "what", "when", "where", "could", "would",
    "should", "about", "before", "still", "just", "more", "most", "against",
    "under", "amid", "ahead", "deal", "signing", "transfer", "reveals",
  ],
  es: [
    "el", "la", "los", "las", "de", "del", "que", "por", "para", "con",
    "una", "un", "su", "se", "no", "más", "como", "pero", "sobre", "al",
    "y", "es", "son", "fue", "ha", "han", "hay", "está", "están", "muy",
    "ya", "sin", "hasta", "desde", "entre", "tras", "según", "aún", "así",
    "también", "año", "años", "dos", "tres", "todo", "todos", "otro", "cada",
    "fichaje", "fichar", "millones", "jugador", "equipo", "temporada", "técnico",
  ],
  it: [
    "il", "lo", "la", "gli", "le", "di", "del", "che", "per", "con",
    "una", "un", "non", "più", "come", "ma", "su", "al", "dal", "nel",
    "è", "sono", "stato", "essere", "viene", "così", "ancora", "dopo", "prima",
    "tutto", "tutti", "perché", "però", "anche", "solo", "già", "tra", "fra",
    "alla", "della", "dei", "delle", "nella", "sul", "ecco", "ora", "anni",
    "calciomercato", "squadra", "giocatore", "allenatore", "rinnovo", "trattativa",
  ],
  fr: [
    "le", "la", "les", "des", "du", "de", "que", "pour", "avec", "une",
    "un", "sur", "pas", "plus", "dans", "au", "aux", "est", "son", "ses",
    "qui", "ont", "sont", "était", "cette", "ces", "leur", "être", "fait",
    "veut", "peut", "aussi", "encore", "toujours", "depuis", "chez", "mais",
    "après", "avant", "entre", "vers", "chez", "joueur", "entraîneur", "saison",
    "selon", "recrue", "prêt", "signature",
  ],
  de: [
    "der", "die", "das", "und", "für", "mit", "von", "den", "dem", "ist",
    "nicht", "auch", "auf", "ein", "eine", "im", "zu", "bei", "nach", "wird",
    "sind", "hat", "haben", "werden", "kann", "soll", "muss", "noch", "schon",
    "wieder", "gegen", "aus", "über", "beim", "einen", "sich", "aber", "vor",
    "wechsel", "verein", "spieler", "trainer", "saison", "ablöse",
  ],
  nl: [
    "de", "het", "een", "van", "en", "voor", "met", "niet", "op", "dat",
    "is", "aan", "bij", "naar", "maar", "ook", "over", "zijn", "wordt", "om",
    "heeft", "werd", "hebben", "worden", "deze", "dit", "er", "al", "uit",
    "door", "nog", "weer", "tegen", "volgens", "kan", "gaat", "komt", "moet",
    "wil", "geen", "meer", "wel", "zo", "dan", "want", "speler", "trainer",
    "seizoen", "aanvaller", "verdediger", "middenvelder",
  ],
  pt: [
    "o", "a", "os", "as", "de", "do", "da", "que", "para", "com",
    "uma", "um", "não", "mais", "como", "mas", "sobre", "no", "na", "ao",
    "dos", "das", "nos", "nas", "pelo", "pela", "são", "está", "já", "ainda",
    "depois", "até", "sem", "muito", "seu", "sua", "ser", "foi", "tem", "têm",
    "jogador", "técnico", "temporada", "contrato", "reforço", "elenco",
  ],
};

/**
 * Signals that essentially do not occur in the other six. Weighted heavily
 * because the shared function words ("de", "que", "un") tie constantly —
 * Spanish and Portuguese in particular — and a tie falls through to the
 * fallback, which was most of the Spanish and French misses.
 */
const MARKERS: Array<[RegExp, string, number]> = [
  // Orthography beats vocabulary on a short headline. "Real Madrid : 3
  // nouveaux clubs foncent sur Endrick" has one French function word and
  // nothing else to go on; the elisions and accents are what identify it.
  [/\b(?:qu|c|n|j|m|t|s|l|d)['’](?=[a-zà-ÿ])/i, "fr", 3],
  [/\b(?:dell|nell|sull|all|dall|quell|l|un)['’](?=[a-zà-ÿ])/i, "it", 3],
  [/\bà\b|\b(?:nouveau|nouveaux|nouvelle|jours|prêt|selon|mercato)\b/i, "fr", 3],
  [/\b(?:amichevole|infortunio|attaccante|difensore|centrocampista|ultime|verso)\b/i, "it", 3],
  [/(?:zione|mento|issimo|ità|tissim)\b/i, "it", 3],
  [/(?:ción|mente|miento)\b/i, "es", 3],
  [/(?:lijk|heid|ingen)\b/i, "nl", 2],
  [/(?:ung|keit|schaft|lich)\b/i, "de", 3],

  [/[ñ]|[¿¡]/, "es", 4],
  [/\b(?:y|del|al|con|una|muy|hasta|según|fichaje)\b/i, "es", 2],
  [/[ãõ]|\b(?:não|são|até|então)\b/i, "pt", 4],
  [/\b(?:dos|das|pelo|pela|uma|nas|nos)\b/i, "pt", 2],
  [/[ß]|[äöü]/, "de", 4],
  [/\b(?:der|die|das|und|für|nicht)\b/i, "de", 2],
  [/\b(?:gli|perché|però|calciomercato|è)\b/i, "it", 4],
  [/\b(?:della|delle|nella|dello|sulla|degli|dalla|agli|alle|allo|nei)\b/i, "it", 3],
  // A word ending in a stressed vowel is Italian orthography — "sarà", "può",
  // "più", "città". Spanish and Portuguese accent earlier syllables far more.
  // Two letters minimum, so the bare French preposition "à" is not counted.
  [/\b\w{2,}[àèìòù]\b/i, "it", 3],
  [/\b(?:per|si|ci|non|che|lo|gli|questo|questa|queste|dopo|verso)\b/i, "it", 2],
  [/\b(?:tifosi|partita|scudetto|prestito|dichiarazioni|conferenza|panchina|azzurri)\b/i, "it", 3],
  [/\b(?:qui|dont|aux|leur|être|est|sont|était|ont|cette|ces|dans|pour|avec)\b/i, "fr", 3],
  [/\b(?:mercato|recrue|transfert|entraîneur|effectif|milieu|attaquant|défenseur)\b/i, "fr", 3],
  [/\b(?:vers|chez|depuis|toujours|encore|aussi|déjà|très|après|avant)\b/i, "fr", 3],
  [/\b(?:les|des|une|cette|selon|joueur)\b/i, "fr", 2],
  [/\bij\b|\b(?:zijn|heeft|wordt|naar|volgens|seizoen)\b/i, "nl", 4],
  [/\b(?:het|een|voor|niet|maar|ook)\b/i, "nl", 2],
];

const SUPPORTED = new Set(Object.keys(STOPWORDS));

/**
 * Returns a language code, or `fallback` when nothing scores clearly. A wrong
 * guess is worse than no guess — it burns quota and stores a mistranslation —
 * so a tie resolves to the fallback rather than to the top scorer.
 */
/** Titles reach us with entities intact — "&egrave; ufficiale" is Italian. */
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+)(?:acute|grave|circ|uml|tilde|cedil);/gi, (_, l) => l)
    .replace(/&(?:nbsp|amp|quot|apos|lt|gt);/gi, " ");
}

/**
 * Accents inside a lower-case word. Capitalised ones are player names —
 * "Gyökeres", "Mbappé" — which English headlines carry constantly, and
 * penalising those cost English twelve points of accuracy.
 */
const FOREIGN_WORD = /(?:^|\s)[a-z]*[àáâãäåçèéêëìíîïñòóôõöùúûüýÿœß][a-z]*/u;

/**
 * Elision, as distinct from an English possessive. `Chelsea's` and `won't` end
 * in an apostrophe too, so the pattern is anchored to the short particles that
 * actually elide in French and Italian.
 */
const ELISION = /\b(?:qu|c|n|j|m|t|l|d|dell|nell|sull|all|dall|un)['’](?=[a-zà-ÿ])/i;

export function detectLang(raw: string, fallback = "en"): string {
  const text = decodeEntities(raw);
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}'\s]/gu, " ")
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

  for (const [re, lang, weight] of MARKERS) {
    if (re.test(text)) scores.set(lang, (scores.get(lang) ?? 0) + weight);
  }

  // An English headline does not carry accents or elisions. When they are
  // present, English has to win on its own words rather than by being the
  // fallback — otherwise every short foreign headline came back "en".
  if (FOREIGN_WORD.test(text) || ELISION.test(text)) {
    scores.set("en", Math.max(0, (scores.get("en") ?? 0) - 3));
  }

  const ranked = [...scores].sort((a, b) => b[1] - a[1]);
  const [top, topScore] = ranked[0];
  const secondScore = ranked[1]?.[1] ?? 0;

  // English is the fallback and the majority language, so it does not need to
  // clear a margin — the others do, or a stray "de" turns an English headline
  // Portuguese.
  if (topScore < 2) return fallback;
  if (top !== fallback && topScore === secondScore) return fallback;
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
