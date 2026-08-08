/**
 * Fills in the summary and image for stories that arrived with neither.
 *
 * Google News RSS carries no description — only a link back to Google — and
 * club sitemaps carry nothing but a URL, so more than half of the attributable
 * feed had nothing to expand. This pass resolves the real article address and
 * reads the summary out of the page's own metadata.
 */
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const PAGE_TIMEOUT_MS = 12_000;
/** Enough for a lede; the card is a preview, not a reader. */
const MAX_SNIPPET = 400;

/** Numeric escapes matter here: og:description is full of &#8217; and &#x27;. */
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function stripTags(s: string): string {
  return s
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]*>/g, " ");
}

export interface Hydrated {
  id: string;
  snippet: string;
  image_url: string;
  resolved_url: string;
  /** the fetched page revealed this is women's football */
  womens?: boolean;
}

async function get(
  url: string,
  timeoutMs = PAGE_TIMEOUT_MS,
): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      signal: ctrl.signal,
      redirect: "follow",
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html") && !type.includes("text")) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Google no longer 302s these links; the destination comes back from the
 * internal endpoint the page itself calls, keyed by a signature baked into the
 * HTML. Returns null whenever any part of that handshake is missing, so a
 * format change degrades to "not resolved" rather than to a wrong URL.
 */
export async function resolveGoogleNews(gUrl: string): Promise<string | null> {
  const id = gUrl.match(/\/articles\/([^?]+)/)?.[1];
  if (!id) return null;

  const html = await get(gUrl);
  if (!html) return null;

  const sig = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
  const ts = html.match(/data-n-a-ts="([^"]+)"/)?.[1];
  if (!sig || !ts) return null;

  const inner = JSON.stringify([
    "garturlreq",
    [
      [
        "X",
        "X",
        ["X", "X"],
        null,
        null,
        1,
        1,
        "US:en",
        null,
        1,
        null,
        null,
        null,
        null,
        null,
        0,
        1,
      ],
      "X",
      "X",
      1,
      [1, 1, 1],
      1,
      1,
      null,
      0,
      0,
      null,
      0,
    ],
    id,
    Number(ts),
    sig,
  ]);
  const payload = JSON.stringify([[["Fbv4je", inner, null, "generic"]]]);

  try {
    const res = await fetch(
      "https://news.google.com/_/DotsSplashUi/data/batchexecute",
      {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: "f.req=" + encodeURIComponent(payload),
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      },
    );
    if (!res.ok) return null;
    const text = await res.text();
    const hit = text.match(/https?:\/\/(?!news\.google\.com)[^"\\]+/)?.[0];
    return hit ? hit.replace(/[.,;]+$/, "") : null;
  } catch {
    return null;
  }
}

function metaContent(html: string, keys: string[]): string {
  for (const key of keys) {
    // Attribute order varies, so match either arrangement rather than assuming
    // property-then-content.
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["']`,
        "i",
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${key}["']`,
        "i",
      ),
    ];
    for (const re of patterns) {
      const hit = html.match(re)?.[1];
      if (hit && hit.trim()) return decodeEntities(hit.trim());
    }
  }
  return "";
}

/** JSON-LD often carries a real description where og: tags are boilerplate. */
function fromJsonLd(html: string): string {
  const blocks = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  if (!blocks) return "";
  for (const block of blocks) {
    const body = block.replace(/^[\s\S]*?>/, "").replace(/<\/script>$/i, "");
    try {
      const seen = JSON.parse(body);
      const nodes = Array.isArray(seen)
        ? seen
        : [seen, ...(seen["@graph"] ?? [])];
      for (const node of nodes) {
        const d = node?.description;
        if (typeof d === "string" && d.trim().length > 40)
          return decodeEntities(d.trim());
      }
    } catch {
      // A malformed block is not a reason to skip the rest of the page.
    }
  }
  return "";
}

/** The first substantial paragraph, when the page ships no metadata at all. */
function firstParagraph(html: string): string {
  const paras = html.match(/<p[^>]*>([\s\S]{60,1200}?)<\/p>/gi) ?? [];
  for (const p of paras) {
    const text = decodeEntities(stripTags(p)).replace(/\s+/g, " ").trim();
    if (text.length < 60) continue;
    // Cookie banners and subscription nags outnumber real ledes on some sites.
    if (/cookie|subscri|sign in|newsletter|advertis|javascript/i.test(text))
      continue;
    return text;
  }
  return "";
}

export function extractMeta(html: string): { snippet: string; image: string } {
  const snippet =
    metaContent(html, [
      "og:description",
      "twitter:description",
      "description",
    ]) ||
    fromJsonLd(html) ||
    firstParagraph(html);

  const image = metaContent(html, [
    "og:image",
    "twitter:image",
    "twitter:image:src",
  ]);

  return {
    snippet: snippet.replace(/\s+/g, " ").trim().slice(0, MAX_SNIPPET),
    image: /^https?:\/\//.test(image) ? image : "",
  };
}

/**
 * Women's football that the headline never admits to.
 *
 * A club posts "Confirmed Chelsea line up vs Auckland FC" under the same URL
 * shape as the men's team; only the body ("Katie McCabe makes her maiden
 * Chelsea start") and the image path give it away. The image path is the
 * reliable half — clubs file women's-team photos in their own folder — so this
 * runs after the fetch rather than on the title.
 */
function looksWomens(snippet: string, image: string, url: string): boolean {
  const path = decodeURIComponent(image + " " + url).toLowerCase();
  if (
    /wom[ae]n|\bcfcw\b|\bmufcw\b|femenin|femminil|féminin|frauen|vrouwen/.test(
      path,
    )
  ) {
    return true;
  }

  const t = snippet.toLowerCase();
  // Football business is not the women's game: a takeover led by a woman, or a
  // chairman whose story merely mentions one, kept getting swept up.
  if (
    /shareholder|stake|co-owner|consortium|takeover|chairman|voorzitter|chief executive|president/.test(
      t,
    )
  ) {
    return false;
  }
  return (
    /wom[ae]n|\bwsl\b|\bnwsl\b|femminil|femenin|féminin|feminin|frauen|vrouwen|jugadora|jogadora/.test(
      t,
    ) ||
    (/\b(her|she)\b/.test(t) && !/\b(his|he|him)\b/.test(t))
  );
}

/**
 * Resolves and reads one article. A row that yields nothing still comes back,
 * because the caller stamps every attempt — retrying a paywall on every run
 * would spend the whole budget on the same dead links.
 */
export async function hydrateOne(row: {
  id: string;
  url: string;
}): Promise<Hydrated> {
  const empty = { id: row.id, snippet: "", image_url: "", resolved_url: "" };

  let target = row.url;
  if (/(^|\.)news\.google\.com$/.test(new URL(row.url).hostname)) {
    const real = await resolveGoogleNews(row.url);
    if (!real) return empty;
    target = real;
  }

  const html = await get(target);
  if (!html)
    return { ...empty, resolved_url: target === row.url ? "" : target };

  const { snippet, image } = extractMeta(html);
  return {
    id: row.id,
    snippet,
    image_url: image,
    resolved_url: target === row.url ? "" : target,
    womens: looksWomens(snippet, image, target),
  };
}
