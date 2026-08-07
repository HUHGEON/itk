import Parser from "rss-parser";
import { rpc } from "../supabase";

/**
 * Polite feed fetching.
 *
 * Everything runs from one IP (a GitHub Actions runner), so hammering Google
 * News with 244 unthrottled requests every 20 minutes is a good way to get
 * 429'd into uselessness. This module adds the four things the naive version
 * was missing: a per-host rate limit, conditional requests, backoff that
 * honours Retry-After, and failures that are recorded instead of swallowed.
 */

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;

/** Minimum gap between two requests to the same host. */
const HOST_GAP_MS: Record<string, number> = {
  "news.google.com": 400,
};
const DEFAULT_HOST_GAP_MS = 200;

/** A feed that keeps failing is retried on an ever-longer cooldown. */
const COOLDOWN_BASE_MS = 10 * 60_000;
const COOLDOWN_MAX_MS = 6 * 3_600_000;
const COOLDOWN_AFTER_FAILURES = 3;

export interface FeedItem {
  link?: string;
  title?: string;
  isoDate?: string;
  creator?: string;
  contentSnippet?: string;
  content?: string;
  sourceTag?: unknown;
  /** every shape publishers use to attach an article image */
  enclosure?: { url?: string; type?: string };
  mediaContent?: unknown;
  mediaThumbnail?: unknown;
  itunesImage?: unknown;
}

export type FetchOutcome =
  | { kind: "ok"; items: FeedItem[] }
  | { kind: "not_modified" }
  | { kind: "skipped"; reason: string }
  | { kind: "failed"; error: string; status?: number };

interface FeedState {
  etag: string | null;
  lastModified: string | null;
  failCount: number;
  updatedAt: number;
}

const parser = new Parser<Record<string, unknown>, FeedItem>({
  customFields: {
    item: [
      ["dc:creator", "creator"],
      ["source", "sourceTag"],
      ["media:content", "mediaContent"],
      ["media:thumbnail", "mediaThumbnail"],
      ["itunes:image", "itunesImage"],
    ],
  },
});

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "unknown";
  }
}

/** Serialises requests per host so we never burst against one origin. */
class HostThrottle {
  private nextFree = new Map<string, number>();

  async acquire(url: string): Promise<void> {
    const host = hostOf(url);
    const gap = HOST_GAP_MS[host] ?? DEFAULT_HOST_GAP_MS;
    const now = Date.now();
    const free = this.nextFree.get(host) ?? 0;

    if (free > now) {
      this.nextFree.set(host, free + gap);
      await sleep(free - now);
    } else {
      this.nextFree.set(host, now + gap);
    }
  }
}

export class FeedFetcher {
  private throttle = new HostThrottle();
  private state = new Map<string, FeedState>();
  private updates = new Map<
    string,
    { etag: string | null; lastModified: string | null; status: number | null; error: string | null }
  >();

  /** One round trip for every feed's HTTP state, instead of one per fetch. */
  async loadState(urls: string[]): Promise<void> {
    if (urls.length === 0) return;
    const rows = await rpc<
      {
        url: string;
        etag: string | null;
        last_modified: string | null;
        fail_count: number;
        updated_at: string;
      }[]
    >("itk_feed_state_get", { p_urls: urls });

    for (const r of rows ?? []) {
      this.state.set(r.url, {
        etag: r.etag,
        lastModified: r.last_modified,
        failCount: Number(r.fail_count ?? 0),
        updatedAt: Date.parse(r.updated_at),
      });
    }
  }

  private cooldownRemaining(url: string): number {
    const s = this.state.get(url);
    if (!s || s.failCount < COOLDOWN_AFTER_FAILURES) return 0;
    const wait = Math.min(
      COOLDOWN_BASE_MS * 2 ** (s.failCount - COOLDOWN_AFTER_FAILURES),
      COOLDOWN_MAX_MS,
    );
    return Math.max(0, s.updatedAt + wait - Date.now());
  }

  async fetch(url: string): Promise<FetchOutcome> {
    const cooldown = this.cooldownRemaining(url);
    if (cooldown > 0) {
      return {
        kind: "skipped",
        reason: `연속 실패 ${this.state.get(url)?.failCount}회 — ${Math.round(cooldown / 60000)}분 후 재시도`,
      };
    }

    const prev = this.state.get(url);
    let lastError = "unknown";
    let lastStatus: number | undefined;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      await this.throttle.acquire(url);

      const headers: Record<string, string> = {
        "User-Agent": USER_AGENT,
        Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        "Accept-Encoding": "gzip, deflate",
      };
      if (prev?.etag) headers["If-None-Match"] = prev.etag;
      if (prev?.lastModified) headers["If-Modified-Since"] = prev.lastModified;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const res = await fetch(url, { headers, signal: controller.signal });
        clearTimeout(timer);
        lastStatus = res.status;

        if (res.status === 304) {
          this.updates.set(url, {
            etag: prev?.etag ?? null,
            lastModified: prev?.lastModified ?? null,
            status: 304,
            error: null,
          });
          return { kind: "not_modified" };
        }

        if (res.status === 429 || res.status >= 500) {
          // Respect Retry-After when the server tells us how long to wait.
          const retryAfter = Number(res.headers.get("retry-after"));
          const wait = Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, 60_000)
            : backoffMs(attempt);
          lastError = `HTTP ${res.status}`;
          if (attempt < MAX_ATTEMPTS) {
            await sleep(wait);
            continue;
          }
          break;
        }

        if (!res.ok) {
          // 4xx other than 429 won't fix itself — don't burn retries on it.
          lastError = `HTTP ${res.status}`;
          break;
        }

        const body = await res.text();
        const feed = await parser.parseString(body);

        this.updates.set(url, {
          etag: res.headers.get("etag"),
          lastModified: res.headers.get("last-modified"),
          status: res.status,
          error: null,
        });
        return { kind: "ok", items: (feed.items ?? []) as FeedItem[] };
      } catch (err) {
        clearTimeout(timer);
        lastError = err instanceof Error ? err.message : String(err);
        if (attempt < MAX_ATTEMPTS) {
          await sleep(backoffMs(attempt));
          continue;
        }
      }
    }

    this.updates.set(url, {
      etag: null,
      lastModified: null,
      status: lastStatus ?? null,
      error: lastError,
    });
    return { kind: "failed", error: lastError, status: lastStatus };
  }

  /** Writes accumulated HTTP state back in one round trip. */
  async flush(): Promise<void> {
    if (this.updates.size === 0) return;

    // A null last_error is what marks the attempt successful downstream.
    const rows = [...this.updates].map(([url, u]) => ({
      url,
      etag: u.etag,
      last_modified: u.lastModified,
      last_status: u.status,
      last_error: u.error,
    }));

    await rpc<number>("itk_feed_state_set", { p_items: rows });
    this.updates.clear();
  }
}

/** Exponential backoff with jitter, so parallel retries don't sync up. */
function backoffMs(attempt: number): number {
  const base = 1000 * 2 ** (attempt - 1);
  return base + Math.floor(Math.random() * 500);
}
