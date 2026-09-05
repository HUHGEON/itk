import type { EventKind, MatchEvent } from "@/lib/matches";

/**
 * What happened, in order, down a centre line.
 *
 * A match report is read as a sequence, so the minute runs down the middle and
 * each event sits on its own side of it. That geometry does the work of saying
 * who it happened to without a label repeating the club name nineteen times.
 *
 * Goals carry weight; bookings and substitutions are present but quiet. The
 * hierarchy is the whole point - someone scanning this wants the goals, and
 * finds them without reading.
 */

const MARK: Record<EventKind, { icon: string; label: string }> = {
  goal: { icon: "●", label: "골" },
  own: { icon: "●", label: "자책골" },
  pen: { icon: "●", label: "PK 골" },
  miss: { icon: "○", label: "PK 실축" },
  yellow: { icon: "▮", label: "경고" },
  red: { icon: "▮", label: "퇴장" },
  sub: { icon: "⇄", label: "교체" },
};

function tone(kind: EventKind) {
  switch (kind) {
    case "goal":
    case "pen":
      return "text-text";
    case "own":
      return "text-red-400";
    case "yellow":
      return "text-amber-400";
    case "red":
      return "text-red-500";
    default:
      return "text-faint";
  }
}

function Entry({ e, side }: { e: MatchEvent; side: "home" | "away" }) {
  const scored = e.kind === "goal" || e.kind === "pen" || e.kind === "own";
  const right = side === "away";

  return (
    <div
      className={`flex min-w-0 items-baseline gap-2 ${
        right ? "flex-row justify-start text-left" : "flex-row-reverse justify-start text-right"
      }`}
    >
      <span
        aria-label={MARK[e.kind].label}
        title={MARK[e.kind].label}
        className={`shrink-0 text-[11px] leading-none ${tone(e.kind)}`}
      >
        {MARK[e.kind].icon}
      </span>
      <div className="min-w-0">
        <div
          className={`truncate ${
            scored
              ? "text-[13.5px] font-semibold text-text"
              : "text-[12.5px] text-muted"
          }`}
        >
          {e.player ?? MARK[e.kind].label}
          {e.kind === "own" && (
            <span className="ml-1 text-[11px] font-normal text-red-400">자책</span>
          )}
          {e.kind === "pen" && (
            <span className="ml-1 text-[11px] font-normal text-faint">PK</span>
          )}
        </div>
        {e.second && (
          <div className="truncate text-[11px] text-faint">
            {e.kind === "sub" ? `▼ ${e.second}` : `도움 ${e.second}`}
          </div>
        )}
      </div>
    </div>
  );
}

export function Timeline({ events }: { events: MatchEvent[] }) {
  if (events.length === 0) return null;

  return (
    <section className="border-b border-border px-[var(--gutter)] py-5">
      <h2 className="pb-3 text-[12px] font-semibold text-muted">경기 기록</h2>
      <ol className="relative flex flex-col gap-3">
        {/* The spine. Sits behind the minutes and stops at the last event
            rather than running on into empty space. */}
        <span
          aria-hidden
          className="absolute inset-y-1 left-1/2 w-px -translate-x-1/2 bg-border"
        />
        {events.map((e) => (
          <li
            key={e.id}
            className="relative grid grid-cols-[1fr_auto_1fr] items-baseline gap-3"
          >
            <div className="min-w-0">
              {e.side === "home" && <Entry e={e} side="home" />}
            </div>
            <span className="tnum z-[1] rounded-[3px] bg-surface px-1.5 text-[11px] font-medium text-faint">
              {e.minute}
            </span>
            <div className="min-w-0">
              {e.side !== "home" && <Entry e={e} side="away" />}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
