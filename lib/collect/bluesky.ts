import type { Journalist } from "../types";
import { isJunkTitle } from "./sources";
import { detectTeams } from "../registry";
import type { RawItem } from "./index";

/**
 * Bluesky ingestion.
 *
 * This is the only free, first-party way to read what these reporters actually
 * break. X charges per post read and Instagram has no public read at all, so
 * everything from those two arrives second-hand via whoever re-reported it.
 * `public.api.bsky.app` is unauthenticated by design — no key, no scraping.
 */

const API = "https://public.api.bsky.app/xrpc";

interface BskyImage {
  thumb?: string;
  fullsize?: string;
}

interface BskyPost {
  uri: string;
  cid: string;
  author: { handle: string };
  record: { text?: string; createdAt?: string };
  embed?: {
    images?: BskyImage[];
    media?: { images?: BskyImage[] };
    external?: { uri?: string; thumb?: string; title?: string; description?: string };
  };
}

interface FeedResponse {
  feed: { post: BskyPost; reason?: unknown }[];
}

/** `at://did:plc:xxx/app.bsky.feed.post/3k...` → the public web URL. */
function postUrl(post: BskyPost): string | null {
  const rkey = post.uri.split("/").pop();
  if (!rkey) return null;
  return `https://bsky.app/profile/${post.author.handle}/post/${rkey}`;
}

function imageOf(post: BskyPost): string | null {
  const embed = post.embed;
  const direct = embed?.images?.[0] ?? embed?.media?.images?.[0];
  return direct?.fullsize ?? direct?.thumb ?? embed?.external?.thumb ?? null;
}

/**
 * A post is one line of breaking news, not an article: the headline is its
 * first sentence and the body is the rest.
 */
function splitText(text: string): { title: string; snippet: string } {
  const clean = text.replace(/\s+/g, " ").trim();
  let firstLine = text.split("\n").find((l) => l.trim().length > 0)?.trim() ?? clean;

  // Plenty of posts open with a greeting or a label — "Hello friends.",
  // "The ratings." — and the news is on the next line. Taking that as the
  // headline put a card in the feed that said nothing, so fall back to the
  // whole post and let the length rules below trim it.
  if (firstLine.length < 25 && clean.length > firstLine.length) firstLine = clean;

  if (firstLine.length <= 140) {
    // Only keep a body when it actually adds something — a one-line post would
    // otherwise render the same sentence twice in the expanded card.
    const adds = clean.length > firstLine.length + 40;
    return { title: firstLine, snippet: adds ? clean : "" };
  }
  // Cut at a sentence boundary when there is one, otherwise at a word.
  const stop = firstLine.slice(0, 140).lastIndexOf(". ");
  const cut = stop > 60 ? stop + 1 : firstLine.slice(0, 140).lastIndexOf(" ");
  return { title: firstLine.slice(0, cut > 60 ? cut : 140) + "…", snippet: clean };
}

/**
 * These are personal accounts, so the feed carries family photos and domestic
 * politics alongside the transfer news. Keep a post only when it names a
 * tracked club or reads like football.
 */
const FOOTBALL_POST =
  /transfer|signing|signed|sign |deal|contract|medical|agreed|loan|bid|fee|club|manager|head coach|squad|goal|lineup|kick-?off|fichaje|traspaso|cedido|mercato|acuerdo|wechsel|vertrag|ablöse|transferts?|prêt|overgang|contrato|#\w*fc\b|\bfc\b|\bcfc\b|\bmufc\b|\blfc\b|\bafc\b/i;

export async function fetchBluesky(j: Journalist, limit = 30): Promise<RawItem[]> {
  if (!j.bluesky) return [];

  const url = `${API}/app.bsky.feed.getAuthorFeed?${new URLSearchParams({
    actor: j.bluesky,
    limit: String(limit),
    filter: "posts_no_replies",
  })}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Bluesky HTTP ${res.status}`);

  const body = (await res.json()) as FeedResponse;

  return (body.feed ?? []).flatMap(({ post, reason }) => {
    // `reason` marks a repost — someone else's words under their name.
    if (reason) return [];

    const text = post.record.text?.trim();
    if (!text) return [];

    const link = postUrl(post);
    if (!link) return [];

    const detected = detectTeams(text);
    if (detected.length === 0 && !FOOTBALL_POST.test(text)) return [];

    const { title, snippet } = splitText(text);
    // "The ratings." / "Hello friends." — the opening post of a thread whose
    // substance is in replies we don't fetch. A card with nothing on it.
    if (isJunkTitle(title) && !snippet) return [];

    return [
      {
        url: link,
        title,
        snippet,
        source: "Bluesky",
        publishedAt: post.record.createdAt ? Date.parse(post.record.createdAt) : Date.now(),
        journalistId: j.id,
        tier: j.tier,
        teams: detected.length > 0 ? detected : j.teams,
        imageUrl: imageOf(post),
        citedId: null,
      },
    ];
  });
}
