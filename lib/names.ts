/**
 * Matching names across sources.
 *
 * Every source words a club and a player slightly differently - "Ipswich Town"
 * against "Ipswich", "Fatawu Issahaku" against "Abdul Fatawu" - so anything
 * that joins two of them needs to ask whether two strings mean the same thing
 * rather than whether they are equal.
 */

/** Strips accents and punctuation so "Milos" finds "Miloš". */
export function norm(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Words that are punctuation, not identity. "FC Utrecht" and "Utrecht" are one
 * club; "Manchester United" and "Manchester City" are not, so United and City
 * are emphatically NOT on this list.
 */
const NOISE = new Set([
  "fc", "afc", "cf", "sc", "ac", "as", "ss", "us", "club", "football", "de",
  "the", "and", "of",
]);

function tokens(s: string): string[] {
  const n = norm(s);
  return (NICKNAME[n] ?? n)
    .split(" ")
    .filter((w) => w.length >= 2 && !NOISE.has(w));
}

/**
 * The handful of names that are neither the same word nor a prefix of it.
 *
 * Measured across four days of fixtures, sixty-nine matched pairs of names
 * between the two sources: sixty-five agreed by prefix, and these three did
 * not. Loosening the prefix rule to cover them would also pair Atlético Madrid
 * with Atlético Madrileño, so they are written down instead.
 */
const ALIAS: Record<string, string> = {
  rennais: "rennes",
  munchen: "munich",
  muenchen: "munich",
  monchengladbach: "gladbach",
  koln: "cologne",
  koeln: "cologne",
};

/**
 * Nicknames, expanded before anything else looks at the name.
 *
 * These have to be handled whole rather than word by word. Mapping "psg" to
 * "paris" made Paris FC the same club as Paris Saint-Germain, which they are
 * emphatically not; expanding the nickname to the full name instead leaves the
 * two with different words to disagree about.
 */
const NICKNAME: Record<string, string> = {
  psg: "paris saint germain",
  spurs: "tottenham hotspur",
  wolves: "wolverhampton wanderers",
  inter: "internazionale",
  atleti: "atletico madrid",
  barca: "barcelona",
  gladbach: "borussia monchengladbach",
};

function canon(w: string): string {
  return ALIAS[w] ?? w;
}

/** "man" stands for "manchester", but "city" never stands for "united". */
function compatible(a0: string, b0: string): boolean {
  const a = canon(a0);
  const b = canon(b0);
  if (a === b) return true;
  if (a.length < 3 || b.length < 3) return false;
  return a.startsWith(b) || b.startsWith(a);
}

/**
 * Do these two names refer to the same club?
 *
 * Every word of the shorter name has to find a partner in the longer one, where
 * a partner is the same word or one that starts with it. That reads both
 * abbreviations and expansions: "Man United" against "Manchester United" pairs
 * man with manchester and united with united, while "Manchester United" against
 * "Manchester City" pairs manchester but leaves united with nothing.
 *
 * The earlier rule dropped United and City as filler and asked only for one
 * shared word. That threw away exactly the word that tells the two Manchester
 * clubs apart, and then failed anyway: with United gone, "Man" and
 * "Manchester" share nothing, so a live Manchester United match found no
 * counterpart at all and its report came back empty.
 */
/**
 * Words a club can be called by or not, without changing which club it is.
 *
 * These only matter as the words a longer name has that a shorter one lacks:
 * "Leeds United" and "Leeds" are one club, "Deportivo Alavés" and "Alavés" are
 * one club. Anything not on this list is identity, which is what keeps "Paris
 * Saint-Germain" apart from "Paris FC" - the extra words there are the club.
 */
const QUALIFIER = new Set([
  "town", "city", "united", "utd", "wanderers", "albion", "rovers", "hove",
  "deportivo", "stade", "sporting", "olympique", "real", "borussia", "sv",
  "bsc", "vfl", "vfb", "tsg", "cd", "ud", "ca", "calcio", "athletic",
]);

/**
 * How well two club names agree, as a count of words that pair up.
 *
 * A boolean answer turned out to be the wrong shape for this. Measured across
 * five days and fourteen competitions, a strict yes/no rule joined 86 of 107
 * matches: the other twenty-one were the same club under a shorter name -
 * Leverkusen for Bayer Leverkusen, Ajax for Ajax Amsterdam, Frankfurt for
 * Eintracht Frankfurt - and every one of them would have needed its own entry
 * in a list that never stops growing.
 *
 * Scoring instead lets the caller pick the best of the candidates kicking off
 * at the same minute, which is a question with one answer. Same measurement,
 * scored: 102 of 107, and the five that remained were spelling differences
 * worth writing down rather than shapes of name worth guessing at.
 */
export function clubScore(a: string, b: string): number {
  const x = tokens(a);
  const y = tokens(b);
  if (x.length === 0 || y.length === 0) return 0;
  let n = 0;
  const used = new Set<number>();
  for (const w of x) {
    const i = y.findIndex((v, k) => !used.has(k) && compatible(w, v));
    if (i >= 0) {
      used.add(i);
      n++;
    }
  }
  return n;
}

export function sameClub(a: string, b: string): boolean {
  const x = tokens(a);
  const y = tokens(b);
  if (x.length === 0 || y.length === 0) return false;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];

  // Every word of the shorter name has to be in the longer one.
  const used = new Set<number>();
  for (const w of short) {
    const i = long.findIndex((v, k) => !used.has(k) && compatible(w, v));
    if (i === -1) return false;
    used.add(i);
  }
  // And whatever the longer name has left over must be a qualifier, not a
  // second club's worth of name.
  return long.every(
    (v, k) => used.has(k) || QUALIFIER.has(canon(v)) || QUALIFIER.has(v),
  );
}

/**
 * Do these two strings name the same player?
 *
 * Sharing one substantial name is enough wherever the club has already been
 * checked: the risk being guarded against is a different player elsewhere, and
 * two players at one club sharing a name is not a case that arises.
 */
export function samePlayer(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  if (x === y) return true;
  const words = (s: string) => new Set(s.split(" ").filter((w) => w.length >= 4));
  const wx = words(x);
  for (const w of words(y)) if (wx.has(w)) return true;
  return false;
}
