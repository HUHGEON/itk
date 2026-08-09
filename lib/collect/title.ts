/**
 * Headline hygiene.
 *
 * Google News — and a good half of the RSS feeds behind it — append the
 * publisher to every title: "Lecce, l'a.d. Mencucci ha presentato le dimissioni
 * - Gianluca Di Marzio". Left alone that suffix is stored, shown, and then
 * *translated*, which is where it stops being cosmetic: "Defensa Central" came
 * back as "중앙 수비" and "Gianluca Di Marzio" was rendered as the name of a new
 * Cagliari player. The outlet is already on screen as its own chip.
 *
 * Cutting at the last dash would be wrong — plenty of real headlines use one
 * ("Fernandes replacement, academy sales and Rashford plan - Manchester United
 * questions answered"). So the cut is anchored to the publisher we already
 * know: strip the tail only when it *is* the source. Over fourteen days that
 * matched 1,207 of 1,318 dashed headlines, and every one it passed over was a
 * genuine headline dash.
 */

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  laquo: "«",
  raquo: "»",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  egrave: "è",
  eacute: "é",
  agrave: "à",
  ograve: "ò",
  igrave: "ì",
  ugrave: "ù",
  ccedil: "ç",
  ntilde: "ñ",
  uuml: "ü",
  ouml: "ö",
  auml: "ä",
  szlig: "ß",
};

/**
 * Decodes entities the feeds ship as literal text.
 *
 * Several Italian outlets double-encode, so "&amp;egrave;" arrives and one pass
 * only gets it back to "&egrave;" — hence the second round.
 */
export function decodeEntities(s: string): string {
  const once = (t: string) =>
    t
      .replace(/&#(\d+);/g, (_, n: string) =>
        String.fromCodePoint(Number(n)),
      )
      .replace(/&#x([0-9a-f]+);/gi, (_, n: string) =>
        String.fromCodePoint(parseInt(n, 16)),
      )
      .replace(/&([a-z]+);/gi, (m, name: string) => NAMED[name.toLowerCase()] ?? m);

  return once(once(s));
}

/**
 * Publisher names reach us in whatever form the feed felt like: "kicker.ch"
 * against a source of "Kicker", "defensacentral.com" against "Defensa Central".
 * Comparing the squashed forms catches those without ever matching two
 * different outlets, because it demands equality — not a substring.
 */
function key(s: string): string {
  return s
    .toLowerCase()
    .replace(/\.(com|net|org|co\.uk|ch|nl|it|es|de|fr|be|pt|tr)$/g, "")
    .replace(/[^a-z0-9À-ɏ]/g, "");
}

const SEPARATORS = [" - ", " – ", " — ", " | "];

/**
 * Publishers that file under a parent's name.
 *
 * Google News reports an Athletic story with a source of "The New York Times" —
 * which owns it — but leaves "- The Athletic" in the title, so the
 * source-anchored rule strips the outer name and stops one layer short. 114
 * rows do this. Keyed and valued through `key()` at match time, so the entries
 * can be written the way a human would.
 *
 * Only exact ownership belongs here. Anything looser and this becomes the
 * blind "cut at the last dash" the whole module exists to avoid.
 */
const IMPRINTS: Record<string, string[]> = {
  "The New York Times": ["The Athletic", "nytimes.com"],
};

const IMPRINT_KEYS = new Map(
  Object.entries(IMPRINTS).map(([parent, kids]) => [
    key(parent),
    kids.map(key),
  ]),
);

function isPublisher(tail: string, source: string): boolean {
  const t = key(tail);
  if (!t) return false;
  if (t === key(source)) return true;
  return IMPRINT_KEYS.get(key(source))?.includes(t) ?? false;
}

/**
 * Strips the publisher suffix a feed appended to a headline.
 *
 * `source` is the publisher we recorded for the row. Anything else in the tail
 * is left alone — a headline is allowed to contain a dash.
 */
export function stripOutletSuffix(title: string, source: string): string {
  const src = source.trim();
  if (!src) return title;

  let out = title.trim();

  // Twice: "… - Kicker - kicker.ch" and "… | CN24 - Notizie sul Calcio Napoli"
  // both put the publisher on twice, in two different shapes.
  for (let pass = 0; pass < 2; pass++) {
    let cut: string | null = null;

    for (const sep of SEPARATORS) {
      const at = out.lastIndexOf(sep);
      if (at <= 0) continue;

      const tail = out.slice(at + sep.length).trim();
      if (!tail || tail.length > 60) continue;
      if (!isPublisher(tail, src)) continue;

      const head = out.slice(0, at).trim();
      // A title that is *only* the publisher is not a suffix to strip.
      if (head.length < 12) continue;

      // Longest sep wins when two match, so " - Kicker" never wins over
      // " | CN24 - Notizie sul Calcio Napoli".
      if (cut === null || head.length < cut.length) cut = head;
    }

    if (cut === null) break;
    out = cut;
  }

  // "Del Piero: "Alajbegovic? ..." -" — a few feeds leave the separator behind
  // once the name is gone.
  return out.replace(/[\s ]*[-–—|:]+$/, "").trim();
}

/** Everything a stored headline should have had done to it. */
export function cleanTitle(title: string, source: string): string {
  return stripOutletSuffix(decodeEntities(title), source);
}
