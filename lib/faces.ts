import { unstable_cache } from "next/cache";

/**
 * Player photographs.
 *
 * The match source has none. Measured before reaching elsewhere: no headshot
 * exists on the athlete record, the roster entry or the usual headshot path,
 * which 404s for every footballer tried. TheSportsDB publishes cut-out photos
 * on a free tier that needs no account and no key of our own, so that is where
 * these come from.
 *
 * Two things about it decided the shape of this file.
 *
 * The squad endpoint is crippled on the free tier - measured, Liverpool came
 * back with ten players and Nottingham Forest with none - so a player has to be
 * found by name across the whole database. That means namesakes: searching the
 * twenty-two who started one match returned another Murillo at Al-Shamal,
 * another Igor Jesus at Los Angeles FC and a retired Víctor Muñoz. A wrong
 * face is worse than no face, so a result is only accepted when the club on it
 * matches the club we asked about, and the other four fall back to their squad
 * number. Eighteen of twenty-two came through on that rule with nothing wrong.
 *
 * That still left four of the twenty-two without a face, and they were not
 * missing so much as unreachable: the free search answers with exactly one
 * result per query and its team parameter is ignored, so Forest's Murillo
 * cannot be returned at all while another Murillo exists. Wikipedia has all of
 * them, so it is asked about whatever the first source could not place. It is
 * only asked about the few, because it rate limits - measured, ten quick
 * requests in a row and the eleventh onward came back empty.
 *
 * And a lookup is one request per player, so every answer is cached for a week,
 * including the misses - a player with no photo should not be asked about again
 * on every render.
 */

const API = "https://www.thesportsdb.com/api/v1/json/3";

/** Strips accents and punctuation so "Milos" finds "Miloš". */
function norm(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Do these two names refer to the same club?
 *
 * The two sources word clubs differently - "Manchester United" against "Man
 * United", "Internazionale" against "Inter Milan" - so this asks whether either
 * name's distinctive words are contained in the other, ignoring the filler that
 * half the clubs in Europe share.
 */
const FILLER = new Set([
  "fc", "afc", "cf", "sc", "ac", "as", "ss", "us", "united", "city", "club",
  "football", "de", "the",
]);

function sameClub(a: string, b: string): boolean {
  const words = (s: string) =>
    new Set(norm(s).split(" ").filter((w) => w.length > 2 && !FILLER.has(w)));
  const x = words(a);
  const y = words(b);
  if (x.size === 0 || y.size === 0) return false;
  for (const w of x) if (y.has(w)) return true;
  return false;
}

interface SportsDbPlayer {
  strPlayer?: string;
  strTeam?: string;
  strCutout?: string;
}

/**
 * One player's cut-out photo, or null.
 *
 * `club` is the club they are playing for in this match, and it is a
 * requirement rather than a hint: a photo whose club does not match is
 * discarded rather than shown.
 */
export async function lookupFace(name: string, club: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${API}/searchplayers.php?p=${encodeURIComponent(name)}`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { player?: SportsDbPlayer[] | null };
    const found = json.player ?? [];
    for (const p of found) {
      if (!p.strCutout) continue;
      if (!p.strTeam || !sameClub(p.strTeam, club)) continue;
      if (norm(p.strPlayer ?? "") !== norm(name)) continue;
      /*
       * The smallest rendition. Measured on one cut-out: the original is
       * 500x500 at 231kB, /preview and /small are 200x200 at 35kB, /medium
       * 350x350 at 97kB, and /tiny 100x100 at 10kB. A token is drawn at 32
       * pixels, so /tiny still has three times the pixels it needs and an
       * eleven costs a tenth of a megabyte instead of two and a half.
       */
      return `${p.strCutout}/tiny`;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Wikipedia's photograph of a player, or null.
 *
 * Three things have to agree before a picture is accepted, because the search
 * will always return something: the article has to be about a footballer, its
 * opening has to mention the club being asked about, and its title has to carry
 * the player's surname. Measured against the four this was written for, that
 * accepted Víctor Muñoz, Murillo and Igor Jesus and correctly refused "Jair
 * Cunha" for ESPN's "Jair Paula" - a different name, and possibly a different
 * person, which is exactly the case a face must not be guessed at.
 */
async function fromWikipedia(
  name: string,
  club: string,
): Promise<string | null> {
  const query = encodeURIComponent(`${name} ${club} footballer`);
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*" +
    `&generator=search&gsrlimit=4&gsrsearch=${query}` +
    "&prop=pageimages|description|extracts&exintro=1&explaintext=1&exchars=400" +
    "&piprop=thumbnail&pithumbsize=160&pilimit=4";
  try {
    const res = await fetch(url, {
      headers: {
        // Wikipedia asks that automated traffic identify itself.
        "User-Agent": "ITKplus/1.0 (https://itkplus.vercel.app)",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            index?: number;
            title?: string;
            description?: string;
            extract?: string;
            thumbnail?: { source?: string };
          }
        >;
      };
    };
    const pages = Object.values(json.query?.pages ?? {}).sort(
      (a, b) => (a.index ?? 99) - (b.index ?? 99),
    );
    const surname = norm(name).split(" ").slice(-1)[0];
    const clubWord = norm(club).split(" ")[0];

    for (const page of pages) {
      const src = page.thumbnail?.source;
      if (!src) continue;
      const about = norm(page.description ?? "");
      if (!about.includes("football")) continue;
      if (!norm(page.title ?? "").includes(surname)) continue;
      if (!norm(page.extract ?? "").includes(clubWord)) continue;
      return src;
    }
    return null;
  } catch {
    return null;
  }
}

const cached = unstable_cache(
  async (name: string, club: string) =>
    (await lookupFace(name, club)) ?? (await fromWikipedia(name, club)),
  ["player-face"],
  { revalidate: 604800, tags: ["player-face"] },
);

/**
 * Photos for a set of players, keyed by name.
 *
 * Looked up together so one slow answer does not hold up the rest, and missing
 * names simply do not appear in the map.
 */
export async function facesFor(
  players: { name: string; club: string }[],
): Promise<Record<string, string>> {
  const seen = new Map<string, string>();
  const unique = players.filter((p) => {
    if (seen.has(p.name)) return false;
    seen.set(p.name, p.club);
    return true;
  });

  const found = await Promise.all(
    unique.map(async (p) => [p.name, await cached(p.name, p.club)] as const),
  );
  const out: Record<string, string> = {};
  for (const [name, url] of found) if (url) out[name] = url;
  return out;
}
