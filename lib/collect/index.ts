import crypto from "node:crypto";
import { rpc } from "../supabase";
import { detectCitation, detectTeams, loadJournalists, loadTeams } from "../registry";
import type { Journalist } from "../types";
import { FeedFetcher, type FeedItem, type FetchOutcome } from "./fetch";
import { OTHER_SPORT, OUTLET_FEEDS, googleNewsUrl } from "./sources";
import { fetchBluesky } from "./bluesky";
import { CLUB_SITEMAPS, fetchClubSitemap } from "./clubs";
import { detectLang, langForCountry } from "./lang";

export interface RawItem {
  url: string;
  title: string;
  snippet: string;
  source: string;
  publishedAt: number;
  journalistId: string | null;
  tier: number | null;
  teams: string[];
  imageUrl: string | null;
  /** journalist the story credits, when it isn't their own byline */
  citedId: string | null;
  /** the club's own announcement, not a report about it */
  official?: boolean;
  /** source language, so the translator can pick the right pair */
  lang?: string;
}

interface SourceResult {
  label: string;
  url: string;
  outcome: FetchOutcome;
  items: RawItem[];
}

function articleId(url: string): string {
  return crypto.createHash("sha1").update(url).digest("hex").slice(0, 16);
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Runs `worker` over `items` with at most `size` in flight, preserving order. */
async function pool<T, R>(
  items: T[],
  size: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await worker(items[idx]);
    }
  });

  await Promise.all(runners);
  return results;
}

/** Google News wraps every link; the real publisher lives in <source>. */
function googleSource(item: FeedItem): string {
  const tag = item.sourceTag;
  if (typeof tag === "string") return tag;
  if (tag && typeof tag === "object" && "_" in tag) {
    return String((tag as { _: unknown })._);
  }
  return "Google News";
}

function parseDate(iso: string | undefined): number {
  if (!iso) return Date.now();
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Date.now() : t;
}

/** Pulls a `url` out of the several shapes rss-parser hands back for media tags. */
function urlAttr(node: unknown): string | null {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = urlAttr(n);
      if (found) return found;
    }
    return null;
  }
  if (typeof node === "string") return node.startsWith("http") ? node : null;
  if (typeof node === "object") {
    const attrs = (node as { $?: Record<string, string> }).$;
    const url = attrs?.url ?? attrs?.href;
    return url && url.startsWith("http") ? url : null;
  }
  return null;
}

/**
 * Best-effort article image. Publishers scatter this across four different
 * tags, and a few only put it in the HTML body.
 */
function imageFrom(item: FeedItem): string | null {
  const enclosure =
    item.enclosure?.url && (item.enclosure.type ?? "image").startsWith("image")
      ? item.enclosure.url
      : null;

  const direct =
    enclosure ??
    urlAttr(item.mediaContent) ??
    urlAttr(item.mediaThumbnail) ??
    urlAttr(item.itunesImage);
  if (direct) return direct;

  const embedded = item.content?.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
  return embedded?.startsWith("http") ? embedded : null;
}

/**
 * Items from a feed the journalist writes themselves. Attribution is certain
 * and, unlike Google News, the entry carries an image and a body.
 */
function ownFeedItems(j: Journalist, items: FeedItem[]): RawItem[] {
  return items.flatMap((item) => {
    const link = item.link ?? "";
    const title = item.title ? stripHtml(item.title) : "";
    if (!link || !title) return [];

    const snippet = item.contentSnippet ? stripHtml(item.contentSnippet).slice(0, 400) : "";
    const detected = detectTeams(`${title} ${snippet}`);

    return [
      {
        url: link,
        title,
        snippet,
        source: j.outlet || j.en,
        publishedAt: parseDate(item.isoDate),
        journalistId: j.id,
        tier: j.tier,
        teams: detected.length > 0 ? detected : j.teams,
        imageUrl: imageFrom(item),
        citedId: null,
      },
    ];
  });
}

function journalistItems(j: Journalist, items: FeedItem[]): RawItem[] {
  return items.flatMap((item) => {
    const link = item.link ?? "";
    const title = item.title ? stripHtml(item.title) : "";
    if (!link || !title) return [];

    // Fall back to the journalist's own beat when the headline names no club.
    const detected = detectTeams(title);

    return [
      {
        url: link,
        title,
        snippet: "",
        source: googleSource(item),
        publishedAt: parseDate(item.isoDate),
        journalistId: j.id,
        tier: j.tier,
        teams: detected.length > 0 ? detected : j.teams,
        // Google News links are JS redirect pages — no image or body to read.
        // The hydrate pass resolves them afterwards and fills both in.
        imageUrl: null,
        citedId: null,
        // The reporter's country is the prior; detectLang overrides it in
        // persist() when the headline says otherwise.
        lang: langForCountry(j.country),
      },
    ];
  });
}

/**
 * Matches an outlet byline against the registry. Exact full-name match first —
 * substring matching on its own produced too many wrong attributions.
 */
function matchByline(creator: string, journalists: Journalist[]): Journalist | null {
  const cleaned = creator.replace(/\s+/g, " ").trim().toLowerCase();
  if (!cleaned) return null;

  const active = journalists.filter((j) => j.active);
  const exact = active.find((j) => cleaned === j.en.toLowerCase());
  if (exact) return exact;

  // "Matt Lawton, Chief Sports Reporter" must not match "Matt Law" just
  // because it comes first in the registry — take the longest name that fits.
  let best: Journalist | null = null;
  for (const j of active) {
    if (j.en.length <= 6) continue;
    if (!cleaned.includes(j.en.toLowerCase())) continue;
    if (!best || j.en.length > best.en.length) best = j;
  }
  return best;
}

function outletItems(
  feed: (typeof OUTLET_FEEDS)[number],
  items: FeedItem[],
  journalists: Journalist[],
): RawItem[] {
  return items.flatMap((item) => {
    const link = item.link ?? "";
    const title = item.title ? stripHtml(item.title) : "";
    if (!link || !title) return [];

    const match = item.creator ? matchByline(item.creator, journalists) : null;
    const snippet = item.contentSnippet ? stripHtml(item.contentSnippet).slice(0, 400) : "";
    const text = `${title} ${snippet}`;

    // A tracked journalist's byline outranks everything; otherwise drop stories
    // that are plainly about another sport before club aliases can misfire.
    if (!match && OTHER_SPORT.test(text)) return [];

    const teams = detectTeams(text);
    // "according to Fabrizio Romano" — the one free trace of an X-only scoop.
    const cited = match ? null : detectCitation(text);

    // Untiered general news is noise; keep only what names a tracked club or
    // credits a tracked reporter.
    if (!match && !cited && teams.length === 0) return [];

    return [
      {
        url: link,
        title,
        snippet,
        source: feed.name,
        publishedAt: parseDate(item.isoDate),
        journalistId: match?.id ?? null,
        // A credited scoop carries that reporter's trust level even though
        // someone else typed the article.
        tier: match?.tier ?? cited?.tier ?? null,
        teams: teams.length > 0 ? teams : (match?.teams ?? []),
        imageUrl: imageFrom(item),
        citedId: cited?.id ?? null,
        lang: feed.lang,
      },
    ];
  });
}

/** Keeps each RPC body well under PostgREST's request size limit. */
const CHUNK = 250;

/**
 * Transfer news is worthless after a couple of months, and the free Supabase
 * tier is 500MB. Old items are neither stored nor kept.
 */
export const RETENTION_DAYS = 60;

async function persist(items: RawItem[]): Promise<number> {
  const byId = new Map(items.map((i) => [articleId(i.url), i]));
  const rows = [...byId].map(([id, item]) => ({
    id,
    url: item.url,
    title: item.title,
    snippet: item.snippet,
    source: item.source,
    published_at: new Date(item.publishedAt).toISOString(),
    journalist_id: item.journalistId,
    tier: item.tier,
    teams: item.teams,
    image_url: item.imageUrl,
    cited_id: item.citedId,
    official: item.official ?? false,
    // The headline itself decides. A feed's declared language is only a
    // fallback: a Google News query for a Dutch reporter returns English
    // pieces too, and tagging those `nl` mistranslates them just as badly.
    lang: detectLang(item.title, item.lang ?? "en"),
  }));

  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    inserted += await rpc<number>("itk_upsert_articles", {
      p_items: rows.slice(i, i + CHUNK),
    });
  }
  return inserted;
}

export interface CollectOptions {
  /** Only query journalists at or above this trust level. 0 = tier 0 only. */
  maxTier?: number;
  /** Skip the outlet feeds and only run the per-journalist queries. */
  skipOutlets?: boolean;
  /**
   * Spread journalists across runs: `{ index: 1, of: 3 }` queries a third of
   * them. Keeps a single run's request count — and the odds of a 429 — low.
   */
  slice?: { index: number; of: number };
  concurrency?: number;
}

export interface CollectStats {
  journalistsQueried: number;
  blueskyQueried: number;
  clubsQueried: number;
  outletsQueried: number;
  ok: number;
  notModified: number;
  failed: number;
  skipped: number;
  itemsSeen: number;
  itemsUnique: number;
  inserted: number;
  /** dropped for being older than the retention window */
  tooOld: number;
  pruned: number;
  failures: { label: string; error: string }[];
  durationMs: number;
}

export async function collect(opts: CollectOptions = {}): Promise<CollectStats> {
  const { maxTier = 3, skipOutlets = false, slice, concurrency = 4 } = opts;
  const started = Date.now();

  const all = loadJournalists();
  let journalists = all.filter((j) => j.active && j.tier <= maxTier);
  if (slice && slice.of > 1) {
    journalists = journalists.filter((_, i) => i % slice.of === slice.index % slice.of);
  }

  const teams = loadTeams();
  const teamEn = new Map(teams.map((t) => [t.slug, t.en]));

  const jobs: { label: string; url: string; parse: (items: FeedItem[]) => RawItem[] }[] = [
    ...journalists.map((j) => ({
      label: `기자:${j.en}`,
      url: googleNewsUrl({
        name: j.en,
        country: j.country,
        teamNames: j.teams.map((s) => teamEn.get(s)).filter((n): n is string => Boolean(n)),
      }),
      parse: (items: FeedItem[]) => journalistItems(j, items),
    })),
    // Always cheap (one request each) and the highest-quality source we have.
    ...journalists.flatMap((j) =>
      (j.feeds ?? []).map((url) => ({
        label: `직접:${j.ko}`,
        url,
        parse: (items: FeedItem[]) => ownFeedItems(j, items),
      })),
    ),
    ...(skipOutlets
      ? []
      : OUTLET_FEEDS.map((f) => ({
          label: `매체:${f.name}`,
          url: f.url,
          parse: (items: FeedItem[]) => outletItems(f, items, all),
        }))),
  ];

  // Bluesky is a JSON API rather than RSS, so it runs beside the feed fetcher.
  // Posts are short and frequent — always fetched, never conditional.
  const bskyTargets = journalists.filter((j) => j.bluesky);
  const bskyResults = await pool<Journalist, SourceResult>(
    bskyTargets,
    concurrency,
    async (j) => {
      const label = `bsky:${j.ko}`;
      const url = `https://bsky.app/profile/${j.bluesky}`;
      try {
        return { label, url, outcome: { kind: "ok", items: [] }, items: await fetchBluesky(j) };
      } catch (err) {
        return {
          label,
          url,
          outcome: { kind: "failed", error: err instanceof Error ? err.message : String(err) },
          items: [],
        };
      }
    },
  );

  // Official club announcements — a signing confirmed by the club itself.
  const clubResults = skipOutlets
    ? []
    : await pool<(typeof CLUB_SITEMAPS)[number], SourceResult>(
        CLUB_SITEMAPS,
        concurrency,
        async (feed) => {
          const label = `공식:${feed.name}`;
          try {
            return {
              label,
              url: feed.url,
              outcome: { kind: "ok", items: [] },
              items: await fetchClubSitemap(feed),
            };
          } catch (err) {
            return {
              label,
              url: feed.url,
              outcome: {
                kind: "failed",
                error: err instanceof Error ? err.message : String(err),
              },
              items: [],
            };
          }
        },
      );

  const fetcher = new FeedFetcher();
  await fetcher.loadState(jobs.map((j) => j.url));

  const feedResults = await pool<(typeof jobs)[number], SourceResult>(
    jobs,
    concurrency,
    async (job) => {
      const outcome = await fetcher.fetch(job.url);
      const items = outcome.kind === "ok" ? job.parse(outcome.items) : [];
      return { label: job.label, url: job.url, outcome, items };
    },
  );

  const results = [...clubResults, ...bskyResults, ...feedResults];

  // Deliberately not flushed yet — see the end of the run. A failed state
  // write used to throw away every article the run had already fetched.

  const counts = { ok: 0, notModified: 0, failed: 0, skipped: 0 };
  const failures: { label: string; error: string }[] = [];
  for (const r of results) {
    switch (r.outcome.kind) {
      case "ok":
        counts.ok++;
        break;
      case "not_modified":
        counts.notModified++;
        break;
      case "skipped":
        counts.skipped++;
        break;
      case "failed":
        counts.failed++;
        failures.push({ label: r.label, error: r.outcome.error });
        break;
    }
  }

  const cutoff = Date.now() - RETENTION_DAYS * 86_400_000;
  const fetched = results.flatMap((r) => r.items);
  const seen = fetched.filter((i) => i.publishedAt >= cutoff);
  const tooOld = fetched.length - seen.length;

  // Same story arrives from several journalist queries; keep the best-tiered
  // attribution and union the team tags.
  const byUrl = new Map<string, RawItem>();
  for (const item of seen) {
    const existing = byUrl.get(item.url);
    if (!existing) {
      byUrl.set(item.url, { ...item, teams: [...item.teams] });
      continue;
    }
    // Keep the better-tiered attribution but carry over whatever the other
    // sighting had: replacing wholesale dropped the image and body that only
    // the outlet feed carries, and the citation only the article text has.
    const merged = [...new Set([...existing.teams, ...item.teams])];
    const better = (item.tier ?? 99) < (existing.tier ?? 99) ? item : existing;
    const other = better === item ? existing : item;

    byUrl.set(item.url, {
      ...better,
      teams: merged,
      snippet: better.snippet || other.snippet,
      imageUrl: better.imageUrl ?? other.imageUrl,
      citedId: better.citedId ?? other.citedId,
      official: better.official || other.official,
    });
  }

  const deduped = [...byUrl.values()];
  const inserted = await persist(deduped);

  // Conditional-request bookkeeping is best-effort: losing it costs one extra
  // full fetch next run, whereas losing the articles costs the articles.
  try {
    await fetcher.flush();
  } catch (err) {
    console.warn("feed_state 기록 실패:", err instanceof Error ? err.message : err);
  }
  const pruned = await rpc<number>("itk_prune", { p_days: RETENTION_DAYS });
  const durationMs = Date.now() - started;

  const stats: CollectStats = {
    journalistsQueried: journalists.length,
    blueskyQueried: bskyTargets.length,
    clubsQueried: clubResults.length,
    outletsQueried: skipOutlets ? 0 : OUTLET_FEEDS.length,
    ...counts,
    itemsSeen: seen.length,
    itemsUnique: deduped.length,
    inserted,
    tooOld,
    pruned,
    failures,
    durationMs,
  };

  await recordRun(stats);
  return stats;
}

async function recordRun(s: CollectStats): Promise<void> {
  try {
    await rpc<number>("itk_record_run", {
      p_stats: {
        duration_ms: s.durationMs,
        sources_ok: s.ok,
        sources_304: s.notModified,
        sources_failed: s.failed,
        items_seen: s.itemsSeen,
        inserted: s.inserted,
        failures: s.failures.slice(0, 50),
      },
    });
  } catch (err) {
    // Observability must never break collection.
    console.warn("collect_runs 기록 실패:", err instanceof Error ? err.message : err);
  }
}
