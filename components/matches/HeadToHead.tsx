import type { FmHeadToHead, FmMeeting } from "@/lib/fotmob";
import type { MatchSide } from "@/lib/matches";
import { seoul } from "@/lib/matches";

/**
 * What these two have done to each other before.
 *
 * The record leads, as a bar, because "who usually wins this" is the whole
 * question and three numbers in a row make a reader do the arithmetic. The
 * meetings follow, most recent first, with the winner carrying the weight.
 *
 * Only finished meetings count. A fixture already scheduled for next season
 * comes back in the same list and would otherwise sit at the top as a match
 * with no score.
 */
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

function Bar({
  record,
  home,
  away,
}: {
  record: [number, number, number];
  home: MatchSide;
  away: MatchSide;
}) {
  const [h, d, a] = record;
  const total = h + d + a || 1;
  const pct = (n: number) => `${(n / total) * 100}%`;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 pb-2 text-[12.5px]">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate font-semibold text-text">{home.name}</span>
          <span className="tnum text-muted">{h}승</span>
        </span>
        <span className="tnum shrink-0 text-[11.5px] text-faint">{d}무</span>
        <span className="flex min-w-0 items-baseline justify-end gap-1.5">
          <span className="tnum text-muted">{a}승</span>
          <span className="truncate font-semibold text-text">{away.name}</span>
        </span>
      </div>
      <div className="flex h-[5px] gap-px overflow-hidden rounded-full">
        <span className="h-full rounded-l-full bg-accent" style={{ width: pct(h) }} />
        <span className="h-full bg-surface-3" style={{ width: pct(d) }} />
        <span className="h-full rounded-r-full bg-sky-500" style={{ width: pct(a) }} />
      </div>
      <p className="pt-1.5 text-[11px] text-faint">
        <span className="tnum">{total}</span>번 만났습니다
      </p>
    </div>
  );
}

function Meeting({ m }: { m: FmMeeting }) {
  const d = seoul(m.date);
  const tone =
    m.outcome === "home"
      ? "text-accent"
      : m.outcome === "away"
        ? "text-sky-400"
        : "text-muted";

  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2">
      <span className="tnum w-[74px] shrink-0 text-[11.5px] leading-tight text-faint">
        {d.year}.{d.month}.{d.day}
        <span className="ml-1 text-[10.5px]">({WEEKDAY[d.weekday]})</span>
      </span>
      <span className="flex min-w-0 items-center justify-end gap-2.5">
        <span
          className={`min-w-0 truncate text-right text-[12.5px] ${
            m.outcome === "draw" ? "text-muted" : "text-text"
          }`}
        >
          {m.home}
        </span>
        <span className={`tnum shrink-0 text-[13px] font-bold ${tone}`}>
          {m.score}
        </span>
        <span
          className={`min-w-0 truncate text-[12.5px] ${
            m.outcome === "draw" ? "text-muted" : "text-text"
          }`}
        >
          {m.away}
        </span>
      </span>
      <span className="w-[92px] shrink-0 truncate text-right text-[10.5px] text-faint">
        {m.competition}
      </span>
    </li>
  );
}

export function HeadToHead({
  h2h,
  home,
  away,
}: {
  h2h: FmHeadToHead;
  home: MatchSide;
  away: MatchSide;
}) {
  return (
    <section className="px-[var(--gutter)] py-5">
      <div className="mx-auto max-w-[46rem]">
        <Bar record={h2h.record} home={home} away={away} />
        <ul className="divide-y divide-border/50 border-t border-border/60 pt-1">
          {h2h.meetings.slice(0, 20).map((m) => (
            <Meeting key={`${m.date}${m.home}`} m={m} />
          ))}
        </ul>
      </div>
    </section>
  );
}
