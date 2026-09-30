import Link from "next/link";
import type { Journalist } from "@/lib/types";
import { tierLabel, tierStyle } from "@/lib/format";

/**
 * The week's busiest reporters, as a leaderboard.
 *
 * It started as a grid of ten initial circles, which said little - an
 * initial is not a face, and ten of them in two rows read as decoration. A
 * ranked list says what the card is for: who, which outlet, how trusted, and
 * how much, with a bar for the count so the gap between first and fifth is
 * seen rather than read.
 */
export function TopReporters({ journalists, counts }: { journalists: Journalist[]; counts: Record<string, number> }) {
  const top = journalists
    .filter((j) => (counts[j.id] ?? 0) > 0)
    .sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0))
    .slice(0, 5);
  if (top.length === 0) return null;
  const max = counts[top[0].id] ?? 1;

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

      <ol className="mt-3 space-y-1">
        {top.map((j, i) => {
          const st = tierStyle(j.tier);
          const n = counts[j.id] ?? 0;
          return (
            <li key={j.id}>
              <Link
                href={`/feed?tier=${j.tier}&who=${j.id}`}
                className="group -mx-2 flex items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.04]"
              >
                <span
                  className={`tnum w-4 shrink-0 text-center text-[15px] leading-[21px] font-bold ${i === 0 ? "text-accent" : "text-faint"}`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[14px] leading-[21px] font-semibold text-text group-hover:text-accent-soft">{j.ko}</span>
                    <span
                      className="shrink-0 rounded-[5px] px-1 py-px text-[10.5px] font-bold"
                      style={{ background: st.bg, color: st.ink, boxShadow: `inset 0 0 0 1px ${st.border === "transparent" ? st.bg : st.border}` }}
                    >
                      {tierLabel(j.tier)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${Math.max(6, (n / max) * 100)}%`, background: st.color }}
                      />
                    </span>
                    <span className="tnum w-9 shrink-0 text-right text-[12px] font-semibold text-muted">{n}건</span>
                  </div>
                  {j.outlet && <p className="mt-1 truncate text-[11.5px] text-faint">{j.outlet}</p>}
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
