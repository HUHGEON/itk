import type { FmEvent, FmEventKind } from "@/lib/fotmob";

/**
 * What happened, in order, down a centre line.
 *
 * A match report is read as a sequence, so the minute runs down the middle and
 * each event sits on its own side of it. That geometry does the work of saying
 * who it happened to without a label repeating the club name nineteen times.
 *
 * Goals carry weight and the running scoreline beside them; bookings and
 * substitutions are present but quiet. Half time is a rule across the column
 * rather than an event, because that is what it is.
 */
const MARK: Record<FmEventKind, { icon: string; label: string }> = {
  goal: { icon: "⚽", label: "골" },
  own: { icon: "⚽", label: "자책골" },
  pen: { icon: "⚽", label: "PK 골" },
  yellow: { icon: "▮", label: "경고" },
  red: { icon: "▮", label: "퇴장" },
  sub: { icon: "⇄", label: "교체" },
  half: { icon: "", label: "" },
};

function tone(kind: FmEventKind) {
  switch (kind) {
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

function Entry({
  e,
  side,
  onOpen,
}: {
  e: FmEvent;
  side: "home" | "away";
  onOpen?: (id: number) => void;
}) {
  const scored = e.kind === "goal" || e.kind === "pen" || e.kind === "own";
  const right = side === "away";

  const name = (
    <span
      className={`truncate ${
        scored ? "text-[13.5px] font-semibold text-text" : "text-[12.5px] text-muted"
      }`}
    >
      {e.player}
      {e.kind === "own" && (
        <span className="ml-1 text-[11px] font-normal text-red-400">자책</span>
      )}
      {e.kind === "pen" && (
        <span className="ml-1 text-[11px] font-normal text-faint">PK</span>
      )}
    </span>
  );

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
        {e.playerId && onOpen ? (
          <button
            type="button"
            onClick={() => onOpen(e.playerId!)}
            className="flex max-w-full min-w-0 rounded-[4px] transition-colors hover:text-accent"
          >
            {name}
          </button>
        ) : (
          <div className="flex min-w-0">{name}</div>
        )}
        {e.second && (
          <div className="truncate text-[11px] text-faint">
            {e.kind === "sub" ? `▼ ${e.second}` : `도움 ${e.second}`}
          </div>
        )}
        {scored && e.score && (
          <div className="tnum text-[11px] font-semibold text-accent">
            {e.score}
          </div>
        )}
      </div>
    </div>
  );
}

export function Timeline({
  events,
  onOpen,
}: {
  events: FmEvent[];
  onOpen?: (id: number) => void;
}) {
  if (events.length === 0) return null;

  return (
    <section className="px-[var(--gutter)] py-5">
      <ol className="relative mx-auto flex max-w-[46rem] flex-col gap-3">
        <span
          aria-hidden
          className="absolute inset-y-1 left-1/2 w-px -translate-x-1/2 bg-border"
        />
        {events.map((e) =>
          e.kind === "half" ? (
            <li key={e.id} className="relative flex items-center justify-center">
              <span className="z-[1] rounded-[3px] bg-surface-2 px-2 py-[2px] text-[11px] font-medium text-muted">
                {e.note ?? e.minute}
              </span>
            </li>
          ) : (
            <li
              key={e.id}
              className="relative grid grid-cols-[1fr_auto_1fr] items-baseline gap-3"
            >
              <div className="min-w-0">
                {e.side === "home" && (
                  <Entry e={e} side="home" onOpen={onOpen} />
                )}
              </div>
              <span className="tnum z-[1] rounded-[3px] bg-surface px-1.5 text-[11px] font-medium text-faint">
                {e.minute}
              </span>
              <div className="min-w-0">
                {e.side !== "home" && (
                  <Entry e={e} side="away" onOpen={onOpen} />
                )}
              </div>
            </li>
          ),
        )}
      </ol>
    </section>
  );
}
