import Link from "next/link";
import type { Journalist } from "@/lib/types";
import { tierLabel, tierStyle } from "@/lib/format";

/**
 * The week's busiest reporters, as a grid of faces - the "top following"
 * card of a sports dashboard, with the one thing about a reporter this site
 * exists to show standing in for the photo we do not have: their tier, as
 * the colour of the circle.
 */
export function TopReporters({ journalists, counts }: { journalists: Journalist[]; counts: Record<string, number> }) {
  const top = journalists
    .filter((j) => (counts[j.id] ?? 0) > 0)
    .sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0))
    .slice(0, 10);
  if (top.length === 0) return null;

  return (
    <section aria-labelledby="top-reporters" className="p-5">
      <div className="flex items-baseline justify-between">
        <h2 id="top-reporters" className="flex items-center gap-2 text-[15px] font-bold text-text">
          <span aria-hidden className="h-[15px] w-[3px] rounded-full" style={{ background: "var(--ribbon)" }} />
          이번 주 많이 쓴 기자
        </h2>
        <Link href="/journalists" className="text-[12.5px] text-faint transition-colors hover:text-text">
          전체
        </Link>
      </div>
      <ul className="mt-4 grid grid-cols-5 gap-x-2 gap-y-4">
        {top.map((j) => {
          const st = tierStyle(j.tier);
          const ring = st.border === "transparent" ? st.bg : st.border;
          return (
            <li key={j.id} className="min-w-0">
              <Link
                href={`/feed?tier=${j.tier}&who=${j.id}`}
                title={`${j.ko} · ${tierLabel(j.tier)} · 이번 주 ${counts[j.id]}건`}
                className="group flex flex-col items-center gap-1.5"
              >
                <span
                  className="flex size-11 items-center justify-center rounded-full text-[16px] font-bold transition-transform duration-200 group-hover:-translate-y-0.5"
                  style={{ background: st.bg, color: st.ink, boxShadow: `inset 0 0 0 1.5px ${ring}` }}
                >
                  {j.ko.slice(0, 1)}
                </span>
                <span className="w-full truncate text-center text-[11.5px] text-muted group-hover:text-text">
                  {j.ko.split(" ").at(-1)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
