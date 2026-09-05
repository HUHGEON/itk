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

/** Words half the clubs in Europe share, which therefore prove nothing. */
const FILLER = new Set([
  "fc", "afc", "cf", "sc", "ac", "as", "ss", "us", "united", "city", "club",
  "football", "de", "the", "town", "county", "athletic", "real",
]);

/**
 * Do these two names refer to the same club?
 *
 * Asks whether they share a distinctive word, ignoring the filler. "Ipswich
 * Town" and "Ipswich" share "ipswich"; "Manchester United" and "Manchester
 * City" share only "manchester", which is why that one is not filler and this
 * check is paired with something narrower wherever it matters.
 */
export function sameClub(a: string, b: string): boolean {
  const words = (s: string) =>
    new Set(norm(s).split(" ").filter((w) => w.length > 2 && !FILLER.has(w)));
  const x = words(a);
  const y = words(b);
  if (x.size === 0 || y.size === 0) return false;
  for (const w of x) if (y.has(w)) return true;
  return false;
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
