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
 * Two shapes exist. A Google News sitemap (Roma, Inter, Barcelona, Real Madrid,
 * Juventus) carries a real `<news:title>`. The plain sitemaps (Chelsea, Arsenal,
 * United, Villa, Spurs, Newcastle, PSG) carry only `<loc>` and `<lastmod>`, so
 * the headline is recovered from the URL slug — readable, if lower-case in the
 * middle.
 *
 * **Every entry below was re-fetched on 2026-09-24**, because four of the nine
 * sources this list used to hold had quietly stopped producing anything and
 * nothing said so: a sitemap that answers 200 with nothing we can use looks
 * exactly like a quiet week. Inter and Barcelona turned out fine (a nine-entry
 * live window that simply had no squad news in it at that moment), but PSG was
 * yielding literally nothing, and Man City had started answering every request
 * with a Cloudflare challenge.
 *
 * Verified unusable, and why — recorded so the next person does not spend the
 * afternoon rediscovering it:
 *
 *   Man City   `cf-mitigated: challenge` on everything — sitemap.xml, the
 *              dedicated newssitemap.xml, /rss, /rss.xml, /feed — under a
 *              browser UA, a bare curl UA and Googlebot's alike. robots.txt is
 *              the only path that answers 200, so it is not the address that is
 *              wrong; nothing short of a real browser gets in. Dropped from the
 *              list rather than left to fail: it was the single failing source
 *              in every scheduled run.
 *   Atlético   403 on robots.txt itself.
 *   AC Milan   37,030 URLs, 33,724 of them articles, and not one `<lastmod>`.
 *              No news sitemap exists — /news-sitemap.xml and /sitemap-news.xml
 *              both answer 500.
 *   Liverpool  No news sitemap (404). The main index is 348 paginated maps
 *              that are not in date order — page 348 is squad profiles, page 1
 *              is 2021 — so there is no page that means "recent".
 *   Strasbourg rcsa.fr/sitemap.xml 404s and rcstrasbourgalsace.fr's index is
 *              empty.
 */
export interface ClubFeed {
  /** team slug in the registry */
  slug: string;
  name: string;
  url: string;
  /** sitemap index → the sub-map holding articles */
  submap?: RegExp;
  /**
   * Which URLs on this site are articles, when they are not under /news/.
   *
   * PSG files everything under /content/, so the shared rule below matched two
   * of its 7,499 entries and the club contributed nothing at all. Measured
   * after: 5,539 of those are articles, and the sitemap carries the signings —
   * 46 "rejoint", 41 "signe", 23 "contrat".
   */
  path?: RegExp;
}

export const CLUB_SITEMAPS: ClubFeed[] = [
  // News sitemaps — real titles. Small live windows: these carry only the
  // newest handful, which is fine at a twenty-minute collection interval.
  {
    slug: "roma",
    name: "AS Roma",
    url: "https://www.asroma.com/sitemaps/news-sitemap-en.xml",
  },
  {
    // The English map holds one entry, the Italian one five, and the club
    // publishes to both. `notizie` is already an article path and the filter
    // already reads Italian, so this is five times the window for one request.
    slug: "roma",
    name: "AS Roma (IT)",
    url: "https://www.asroma.com/sitemaps/news-sitemap-it.xml",
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
  {
    // Reached directly rather than through /sitemap.xml, which is an index of
    // per-locale indexes — two levels down, and this only follows one.
    slug: "real-madrid",
    name: "Real Madrid",
    url: "https://www.realmadrid.com/sitemap-latest-news-en-US.xml",
  },
  {
    // Same reason: /xml-sitemap/sitemap_news.xml is itself an index, of 1,547
    // monthly maps going back to 1897. `latest` is the one that means today.
    slug: "juventus",
    name: "Juventus",
    url: "https://www.juventus.com/en/xml-sitemap/news/latest.xml",
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
    slug: "aston-villa",
    name: "Aston Villa",
    url: "https://www.avfc.co.uk/sitemap.xml",
  },
  {
    // news_1 is the newest of sixty numbered maps, not the oldest — measured:
    // news_1 is dated today, news_60 stops in August 2012.
    slug: "tottenham",
    name: "Tottenham Hotspur",
    url: "https://www.tottenhamhotspur.com/sitemap/index.xml",
    submap: /news_1\.xml/,
  },
  {
    // The index also holds news-2020 through news-2026 and a pile of category
    // and tag maps; this is the only one that means "recent".
    slug: "newcastle",
    name: "Newcastle United",
    url: "https://www.newcastleunited.com/sitemap.xml",
    submap: /latest-news-sitemap/,
  },
  {
    slug: "psg",
    name: "Paris Saint-Germain",
    url: "https://www.psg.fr/sitemap.xml",
    path: /\/content\//i,
  },
];


const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** These sitemaps list the entire site history; only the newest matter. */
const MAX_PER_CLUB = 40;

/**
 * Club sitemaps list everything the site publishes — ticket info, matchday
 * previews, galleries. Only squad news is worth a slot in the feed.
 *
 * The weak words came out. `confirmed`, `announce`, `unveil`, `welcome`,
 * `extend` and `sale` were each matching far more matchday and commercial posts
 * than transfers: counted across Spurs, Newcastle, Chelsea and Arsenal, about
 * three in ten accepted titles were things like "Confirmed line-ups | Spurs vs
 * West Ham", "Club announces HP as Official Workplace Solutions Partner" and
 * "Chelsea foundation extends grants helping to tackle homelessness" — sitting
 * at tier 0, the most trusted slot on the site, because a club published them.
 *
 * Every real story those words were catching is caught by a strong word
 * anyway ("Welcome Tosin! Adarabioyo **joins** from Chelsea"), with one
 * exception worth keeping explicitly: a shirt or squad number, which is the
 * post that follows a signing.
 *
 * Two more went for being the wrong language or the wrong noun. `exit` was
 * catching cup exits and nothing else — "must get back to winning after
 * carabao cup exit", "Gale's England exit Under-20 World Cup" — and a real
 * departure says departs, leaves or joins. And `departs?` matched the French
 * *départ*, so PSG's team-coach slideshows read as transfers; English club
 * posts all use the inflected "departs", so requiring it costs nothing.
 */
const SQUAD_NEWS =
  /\bsigns?\b|signed|signing|joins?\b|transfer|sold|loan|contract|renew|deal\b|agreement|\bdeparts\b|departure|leaves?\b|medical|(?:shirt|squad) number|fichaje|traspaso|cedido|acuerdo|firma|ufficiale|ceduto|prestito|rinnovo|mercato|recrue|arriv[ée]e|prolong|rejoint|\bsigne\b|contrat|transfert/i;

/**
 * What still slips through, and is never a transfer.
 *
 * `loan` catches "Loan Watch: Woltemade off the mark", `signing` catches "Win a
 * shirt signed by new signing …", `deal` catches a sponsorship. Deliberately
 * not `report`: "New medical report on Valverde" is exactly the kind of squad
 * news this is here to keep.
 */
const NOT_SQUAD =
  /line[- ]?ups?\b|team news|match officials|kick[- ]?off|fixtures?\b|tickets?\b|partner|sponsor|foundation|hall of fame|loan watch|loan report|\bwin a\b|quiz|podcast|gallery|diaporama|preview|highlights|matchday|kit colours?|in training|membership|ownership|\bfpl\b|carpool/i;

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
    if (!link || !(feed.path ?? ARTICLE_PATH).test(link)) return [];

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
      .filter(
        (r) =>
          SQUAD_NEWS.test(r.title) &&
          !NOT_SQUAD.test(r.title) &&
          !WOMENS_FOOTBALL.test(r.title),
      )
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
