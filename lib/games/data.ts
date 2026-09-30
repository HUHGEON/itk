/**
 * The game data, fetched once per visit and shared by every game.
 *
 * Built by `npm run games:build` into /public/games, so it is a static file on
 * the CDN - there is no server call in any game. Answers are checked in the
 * browser against these lists, the same way the original checks its own.
 */

export type CatKind = "club" | "nation" | "league" | "region" | "trophy" | "group";

export interface Category {
  id: string;
  short: string;
  kind: CatKind;
  /** "t:9825" → a crest or flag on the image host */
  img?: string;
  /** how many players can answer it */
  n: number;
}

export interface GridPlayer {
  id: number;
  ko: string;
  en: string;
  born: number;
  fame: number;
  cats: Set<number>;
  alt: string[];
  /** "D", "MF": goalkeeper/defender/midfielder/forward, in pitch order */
  pos: string;
}

export interface Grid {
  /** when the data was built, for the "last updated" line */
  built?: string;
  cats: Category[];
  /** pairs of category indexes that share at least two players */
  pairs: Set<string>;
  players: GridPlayer[];
}

export const pairKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);

/** "t:9825" → a crest or flag; "l:47" → a league logo. */
export function imageUrl(img?: string): string | undefined {
  const base = "https://images.fotmob.com/image_resources/logo";
  if (img?.startsWith("t:")) return `${base}/teamlogo/${img.slice(2)}.png`;
  if (img?.startsWith("l:")) return `${base}/leaguelogo/${img.slice(2)}.png`;
  return undefined;
}

export const photoUrl = (id: number) =>
  `https://images.fotmob.com/image_resources/playerimages/${id}.png`;

const memo = new Map<string, Promise<unknown>>();
function load<T>(file: string): Promise<T> {
  if (!memo.has(file)) {
    memo.set(
      file,
      fetch(`/games/${file}`).then((r) => {
        if (!r.ok) throw new Error(`${file}: ${r.status}`);
        return r.json();
      }),
    );
  }
  return memo.get(file) as Promise<T>;
}

export async function loadGrid(): Promise<Grid> {
  const raw = await load<{
    built?: string;
    cats: Category[];
    pairs: [number, number, number][];
    players: [string, string, number, number, number[], string?, string?][];
  }>("grid.json");
  return {
    built: raw.built,
    cats: raw.cats,
    pairs: new Set(raw.pairs.map(([a, b]) => pairKey(a, b))),
    players: raw.players.map(([ko, en, born, fame, v, alt, pos], id) => ({
      id,
      ko,
      en,
      born,
      fame,
      cats: new Set(v),
      alt: alt ? alt.split("|") : [],
      pos: pos ?? "",
    })),
  };
}

export interface CareerAnswer {
  ko: string;
  en: string;
  born: number | null;
  /** [start, end|null, club, apps|null, goals|null, loan 0|1] */
  clubs: [number, number | null, string, number | null, number | null, number][];
  /** [start, end|null, nation, apps|null, goals|null] */
  intl: [number, number | null, string, number | null, number | null][];
}

export const loadCareer = () => load<CareerAnswer[]>("career.json");

export interface WhoData {
  leagues: { id: number; ko: string }[];
  clubs: { id: number; ko: string; league: number }[];
  nations: Record<string, { ko: string; cont: string }>;
  /** [fotmobId, ko|null, en, shirt|null, nation, pos, dob|null, clubId, value, wikipediaKo] */
  players: [number, string | null, string, number | null, string, string, string | null, number, number, string?][];
}

export const loadWho = () => load<WhoData>("whoareya.json");
