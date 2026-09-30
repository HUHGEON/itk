import Link from "next/link";
import { seoul, type Match, type MatchSide } from "@/lib/matches";

/**
 * The rest of the competition's day, beside the match - FotMob keeps the
 * round's other fixtures in the column next to a match, so moving between the
 * games of one matchday is a click rather than a trip back to the list.
 */
export function SameDay({ current, matches }: { current: Match; matches: Match[] }) {
  if (matches.length < 2) return null;
  return (
    <section aria-labelledby="same-day" className="p-5">
      <h2 id="same-day" className="flex items-center gap-2 text-[15px] font-bold text-text">
        <span aria-hidden className="h-[15px] w-[3px] rounded-full" style={{ background: "var(--ribbon)" }} />
        {current.competition}
      </h2>
      <p className="mt-0.5 ml-[11px] text-[12.5px] text-faint">
        {seoul(current.kickoff).month}월 {seoul(current.kickoff).day}일 경기
      </p>
      <ul className="mt-3 space-y-1">
        {matches.map((m) => {
          const on = m.id === current.id;
          const t = seoul(m.kickoff);
          const played = m.state !== "pre";
          return (
            <li key={m.id}>
              <Link
                href={`/matches/game/${m.code}/${m.id}`}
                aria-current={on ? "page" : undefined}
                className={`-mx-2 flex items-center gap-3 rounded-xl px-2 py-2 transition-colors ${
                  on ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
                }`}
              >
                <span className="min-w-0 flex-1 space-y-1">
                  <Row side={m.home} score={played ? m.home.score : null} />
                  <Row side={m.away} score={played ? m.away.score : null} />
                </span>
                {!played && (
                  <span className="tnum shrink-0 border-l border-border pl-3 text-[12.5px] text-muted">{t.hm}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Row({ side, score }: { side: MatchSide; score: number | null }) {
  return (
    <span className="flex items-center gap-2 text-[13px]">
      {side.crest ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={side.crest} alt="" className="size-[18px] shrink-0 object-contain" />
      ) : (
        <span className="size-[18px] shrink-0" />
      )}
      <span className="min-w-0 flex-1 truncate text-text">{side.name}</span>
      {score !== null && <span className="tnum font-semibold text-text">{score}</span>}
    </span>
  );
}
