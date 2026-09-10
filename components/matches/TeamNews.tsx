import Link from "next/link";
import type { FeedRow } from "@/lib/feed";
import { timeAgo, tierLabel, tierStyle } from "@/lib/format";

/**
 * The club's latest stories, under its fixtures.
 *
 * The two halves of this site had no door between them. A reader who came to
 * see when Liverpool play next was one line of small print away from the news
 * about them, and the news page had no idea a fixture list existed. Putting a
 * few headlines here joins the two where a reader is already thinking about
 * one club.
 *
 * Five, not fifty. This is a signpost to the feed, not a second feed.
 */
export function TeamNews({
  rows,
  slug,
  name,
  now,
}: {
  rows: FeedRow[];
  slug: string;
  name: string;
  now: number;
}) {
  if (rows.length === 0) return null;

  return (
    <section className="border-t border-border">
      <div className="mx-auto w-full max-w-[52rem] px-[var(--gutter)] py-5">
        <div className="flex items-baseline justify-between gap-3 pb-2">
          <h2 className="text-[12px] font-semibold text-muted">최근 소식</h2>
          <Link
            href={`/feed?team=${slug}`}
            className="text-[11.5px] text-faint underline-offset-4 transition-colors hover:text-muted hover:underline"
          >
            {name} 소식 전체
          </Link>
        </div>

        <ul className="divide-y divide-border/50 border-t border-border/60">
          {rows.slice(0, 5).map((r) => (
            <li key={r.id}>
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="-mx-2 flex items-start gap-2.5 rounded-[6px] px-2 py-2.5 transition-colors hover:bg-surface-2/40"
              >
                {r.tier !== null && (
                  <span
                    className="mt-[2px] shrink-0 rounded-[4px] px-1.5 py-[1px] text-[10px] font-semibold"
                    style={{
                      color: tierStyle(r.tier).color,
                      border: `1px solid ${tierStyle(r.tier).border}`,
                    }}
                  >
                    {tierLabel(r.tier)}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[13px] leading-[1.45] text-text">
                    {r.titleKo ?? r.title}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-faint">
                    {r.journalistKo && <span>{r.journalistKo}</span>}
                    <span>{r.outlet ?? r.source}</span>
                    <span className="tnum">{timeAgo(r.publishedAt, now)}</span>
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
