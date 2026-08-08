import { detectTeams } from "../registry";
import { WOMENS_FOOTBALL } from "./sources";
import type { RawItem } from "./index";

/**
 * Official club announcements.
 *
 * A club saying "X signs for us" is the end of a transfer story, not a rumour
 * about it — the one source that outranks any reporter. Almost every club has
 * dropped RSS for a single-page app, but most still publish a sitemap, which is
 * a public machine-readable format carrying the URL and a timestamp.
 *
 * Two shapes exist. A Google News sitemap (Roma, Inter, Barcelona) carries a
 * real `<news:title>`. The plain sitemaps (Chelsea, Arsenal, United, City,
 * Villa, PSG) carry only `<loc>` and `<lastmod>`, so the headline is recovered
 * from the URL slug — readable, if lower-case in the middle.
 *
 * Absent by design, each verified as unusable rather than left to fail
 * silently: Tottenham, Juventus, Atlético and Strasbourg block the request;
 * Newcastle's news sitemap 403s; Real Madrid and Liverpool publish no dated
 * article URLs; Milan's 36k entries carry no timestamps at all.
 */
export interface ClubFeed {
  /** team slug in the registry */
  slug: string;
  name: string;
  url: string;
  /** sitemap index → the sub-map holding articles */
  submap?: RegExp;
}

export const CLUB_SITEMAPS: ClubFeed[] = [
  // News sitemaps — real titles
  {
    slug: "roma",
    name: "AS Roma",
    url: "https://www.asroma.com/sitemaps/news-sitemap-en.xml",
  },
  {
    slug: "inter",
    name: "Inter",
    url: "https://www.inter.it/sitemap-news-detail-en.xml",
  },
  {
    slug: "barcelona",
    name: "FC Barcelona",
    url: "https://www.fcbarcelona.com/en/sitemap/articles/detailed.xml",
  },

  // Plain sitemaps — title recovered from the slug
  {
    slug: "chelsea",
    name: "Chelsea",
    url: "https://www.chelseafc.com/en/sitemap.xml",
  },
  {
    slug: "arsenal",
    name: "Arsenal",
    url: "https://www.arsenal.com/sitemaps/articles/sitemap.xml",
    submap: /articles/,
  },
  {
    slug: "man-utd",
    name: "Manchester United",
    url: "https://www.manutd.com/sitemap.xml",
    submap: /sitemap\/0\.xml|news/,
  },
  {
    slug: "man-city",
    name: "Manchester City",
    url: "https://www.mancity.com/sitemap.xml",
  },
  {
    slug: "aston-villa",
    name: "Aston Villa",
    url: "https://www.avfc.co.uk/sitemap.xml",
  },
  {
    slug: "psg",
    name: "Paris Saint-Germain",
    url: "https://www.psg.fr/sitemap.xml",
  },
];

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** These sitemaps list the entire site history; only the newest matter. */
const MAX_PER_CLUB = 40;

/**
 * Club sitemaps list everything the site publishes — ticket info, matchday
 * previews, galleries. Only squad news is worth a slot in the feed.
 */
const SQUAD_NEWS =
  /\bsigns?\b|signed|signing|joins?\b|transfer|sold|sale|loan|contract|renew|extend|deal\b|agreement|departs?\b|leaves?\b|exit|welcome|unveil|medical|announce|confirmed|fichaje|traspaso|cedido|acuerdo|firma|ufficiale|ceduto|prestito|rinnovo|mercato|recrue|arrivée|prolonge/i;

const ARTICLE_PATH = /\/(news|article|noticia|notizie|actualites)\//i;

async function get(url: string): Promise<string | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function tag(block: string, name: string): string | null {
  const m = block.match(
    new RegExp(`<${name}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`),
  );
  return m ? m[1].trim() : null;
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * "…/new-deal-and-loan-move-for-hudson-sands" → "New deal and loan move for
 * hudson sands". Imperfect casing, but the alternative is no headline at all.
 */
function titleFromSlug(url: string): string | null {
  const last = url.replace(/\/+$/, "").split("/").pop() ?? "";
  // Some slugs are CMS artefacts — an author's email, a bare id.
  if (!last || last.includes("%40") || last.includes("@") || /^\d+$/.test(last))
    return null;

  const words = decodeURIComponent(last)
    .replace(/\.(html?|aspx)$/i, "")
    // Trailing CMS id: arsenal.com appends one to every slug, and it was
    // landing in the headline — "Christian norgaard joins everton a7fZT9g6dECY".
    // Both cases plus a digit is what separates an id from a real word.
    .replace(
      /[-_](?=[A-Za-z0-9]{8,}$)(?=[A-Za-z0-9]*[0-9])(?=[A-Za-z0-9]*[A-Z])[A-Za-z0-9]+$/,
      "",
    )
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (words.length < 12) return null;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export async function fetchClubSitemap(feed: ClubFeed): Promise<RawItem[]> {
  let xml = await get(feed.url);
  if (!xml) return [];

  // One level of indirection: a sitemap index pointing at the article map.
  if (/<sitemapindex/.test(xml)) {
    const subs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const pick =
      subs.find((u) => feed.submap?.test(u)) ??
      subs.find((u) => /news|article/i.test(u)) ??
      subs[0];
    if (!pick) return [];
    xml = await get(pick);
    if (!xml) return [];
  }

  // `<url id="...">` — the attribute is why a bare `<url>` match found nothing.
  const blocks = xml.match(/<url\b[^>]*>[\s\S]*?<\/url>/g) ?? [];

  const rows = blocks.flatMap((block) => {
    const link = tag(block, "loc");
    if (!link || !ARTICLE_PATH.test(link)) return [];

    const published =
      tag(block, "news:publication_date") ?? tag(block, "lastmod") ?? "";
    const at = Date.parse(published);
    if (Number.isNaN(at)) return [];

    const raw = tag(block, "news:title");
    const title = raw ? decode(raw) : titleFromSlug(link);
    if (!title) return [];

    return [{ link, at, title, image: tag(block, "image:loc") }];
  });

  // Whole-history sitemaps: sort before truncating or we'd keep 2015.
  rows.sort((a, b) => b.at - a.at);

  return (
    rows
      // Filter before truncating. Slicing first meant a club whose newest 40
      // posts were all ticket info and match previews — Man City and PSG both
      // are — yielded nothing at all, silently.
      // The club sitemap was the one path with no topic filter, so every
      // women's-team post came through it — seven of them on the first run
      // after the filter went in everywhere else.
      .filter((r) => SQUAD_NEWS.test(r.title) && !WOMENS_FOOTBALL.test(r.title))
      .slice(0, MAX_PER_CLUB)
      .map((r) => {
        const detected = detectTeams(r.title);
        return {
          url: r.link,
          title: r.title,
          snippet: "",
          source: feed.name,
          publishedAt: r.at,
          // No byline — but a club announcing its own business is as confirmed as
          // football news gets, so it sits at the top of the trust scale.
          journalistId: null,
          tier: 0,
          teams: detected.length > 0 ? detected : [feed.slug],
          imageUrl: r.image,
          citedId: null,
          official: true,
        };
      })
  );
}
