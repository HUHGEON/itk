import { unstable_cache } from "next/cache";
import { norm, sameClub, samePlayer } from "@/lib/names";

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

interface SportsDbPlayer {
  strPlayer?: string;
  strTeam?: string;
  /** Portrait: head and shoulders. */
  strThumb?: string;
  /** Three-quarter body with the background removed. */
  strCutout?: string;
}

/**
 * One player's cut-out photo, or null.
 *
 * `club` is the club they are playing for in this match, and it is a
 * requirement rather than a hint: a photo whose club does not match is
 * discarded rather than shown.
 */
async function search(term: string): Promise<SportsDbPlayer[]> {
  try {
    const res = await fetch(
      `${API}/searchplayers.php?p=${encodeURIComponent(term)}`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { player?: SportsDbPlayer[] | null };
    return json.player ?? [];
  } catch {
    return [];
  }
}

function pick(
  found: SportsDbPlayer[],
  name: string,
  club: string,
): string | null {
  for (const p of found) {
    if (!p.strTeam || !sameClub(p.strTeam, club)) continue;
    if (!samePlayer(p.strPlayer ?? "", name)) continue;
    const portrait = p.strThumb ?? p.strCutout;
    if (!portrait) continue;
    /*
     * `strThumb` first, and only then `strCutout`.
     *
     * The two are different pictures. A cut-out is a three-quarter body shot
     * with the background removed, so getting a face out of it means cropping
     * hard into a photograph never framed for it. `strThumb` is the portrait -
     * head and shoulders, facing the camera - which is what every board that
     * shows faces uses. Measured on one match: twenty of twenty-two starters
     * had one.
     *
     * /preview is 200x200 at about 18kB, drawn at 48.
     */
    return `${portrait}/preview`;
  }
  return null;
}

/**
 * One player's portrait, or null.
 *
 * `club` is the club they are playing for in this match, and it is a
 * requirement rather than a hint: a photo whose club does not match is
 * discarded rather than shown.
 *
 * Two queries at most. The free search answers with a single result, so a full
 * name that the other source words differently returns nothing useful - asking
 * for "Fatawu Issahaku" found no one while "Fatawu" found him at Ipswich. The
 * second query only runs when the first found nothing, which keeps the cost at
 * one request for almost every player.
 */
export async function lookupFace(
  name: string,
  club: string,
): Promise<string | null> {
  const first = pick(await search(name), name, club);
  if (first) return first;

  // The most distinctive single word, which is usually the one the other
  // source leads with.
  const words = norm(name)
    .split(" ")
    .filter((w) => w.length >= 5)
    .sort((a, b) => b.length - a.length);
  if (words.length === 0) return null;
  return pick(await search(words[0]), name, club);
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
  // The key names the rendition as well as the lookup: changing which size is
  // returned has to invalidate what was already stored, and a week-long cache
  // otherwise keeps serving the old one.
  ["player-face-portrait-3"],
  { revalidate: 604800, tags: ["player-face"] },
);

/**
 * Portraits for a set of players, keyed by name.
 *
 * Run a few at a time rather than all at once. A full match sheet is around
 * forty players across both benches, and firing forty requests together at a
 * free tier is how a rate limit is found - this one answered 429 during
 * development at roughly that volume. Eight in flight keeps a cold match under
 * a second while staying well inside what the service will take, and a warm one
 * costs nothing at all because every answer is cached for a week.
 *
 * Names that could not be placed simply do not appear in the map.
 */
export async function facesFor(
  players: { name: string; club: string }[],
): Promise<Record<string, string>> {
  const seen = new Map<string, string>();
  for (const p of players) if (!seen.has(p.name)) seen.set(p.name, p.club);
  const unique = [...seen.entries()];

  const out: Record<string, string> = {};
  const BATCH = 8;
  for (let i = 0; i < unique.length; i += BATCH) {
    const slice = unique.slice(i, i + BATCH);
    const found = await Promise.all(
      slice.map(async ([name, club]) => [name, await cached(name, club)] as const),
    );
    for (const [name, url] of found) if (url) out[name] = url;
  }
  return out;
}
