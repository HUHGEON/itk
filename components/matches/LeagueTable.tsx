import Link from "next/link";
import type { TableRow } from "@/lib/matches";

/**
 * A league table.
 *
 * Read down the left for position and across for the record, so rank, crest and
 * name hold the left edge and every number is right-aligned and tabular. The
 * columns narrow on a phone by dropping the ones that can be recovered from the
 * others: played, won, drawn and lost survive, goals for and against do not,
 * because the difference between them is already there.
 *
 * Clubs the feed follows are links. The rest are the table, not the point.
 */
export function LeagueTable({ rows }: { rows: TableRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="px-[var(--gutter)] py-12 text-center text-[14px] text-muted">
        아직 순위가 나오지 않았습니다
      </p>
    );
  }

  return (
    <div className="overflow-x-auto px-[var(--gutter)] pb-8">
      <table className="w-full min-w-[30rem] border-collapse">
        <thead>
          <tr className="border-b border-border text-[11px] text-faint">
            <th className="w-8 py-2 text-left font-medium">#</th>
            <th className="py-2 text-left font-medium">구단</th>
            <th className="w-9 py-2 text-right font-medium">경기</th>
            <th className="w-8 py-2 text-right font-medium">승</th>
            <th className="w-8 py-2 text-right font-medium">무</th>
            <th className="w-8 py-2 text-right font-medium">패</th>
            <th className="hidden w-12 py-2 text-right font-medium sm:table-cell">
              득실
            </th>
            <th className="w-10 py-2 text-right font-medium">차</th>
            <th className="w-11 py-2 text-right font-medium">승점</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={`${r.rank}-${r.name}`}
              className={`border-b border-border/60 last:border-b-0 ${
                r.slug ? "bg-accent/[0.04]" : ""
              }`}
            >
              <td className="tnum py-2.5 text-[12.5px] text-muted">{r.rank}</td>
              <td className="py-2.5">
                <span className="flex items-center gap-2">
                  {r.crest ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.crest}
                      alt=""
                      width={18}
                      height={18}
                      loading="lazy"
                      className="size-[18px] shrink-0 object-contain"
                    />
                  ) : (
                    <span className="size-[18px] shrink-0" />
                  )}
                  {r.slug ? (
                    <Link
                      href={`/matches/team/${r.slug}`}
                      className="truncate text-[13.5px] font-semibold text-text transition-colors hover:text-accent"
                    >
                      {r.name}
                    </Link>
                  ) : (
                    <span className="truncate text-[13.5px] text-muted">
                      {r.name}
                    </span>
                  )}
                </span>
              </td>
              <td className="tnum py-2.5 text-right text-[12.5px] text-muted">
                {r.played}
              </td>
              <td className="tnum py-2.5 text-right text-[12.5px] text-muted">
                {r.won}
              </td>
              <td className="tnum py-2.5 text-right text-[12.5px] text-muted">
                {r.drawn}
              </td>
              <td className="tnum py-2.5 text-right text-[12.5px] text-muted">
                {r.lost}
              </td>
              <td className="tnum hidden py-2.5 text-right text-[12.5px] text-faint sm:table-cell">
                {r.for}:{r.against}
              </td>
              <td className="tnum py-2.5 text-right text-[12.5px] text-muted">
                {r.diff > 0 ? `+${r.diff}` : r.diff}
              </td>
              <td className="tnum py-2.5 text-right text-[13.5px] font-bold text-text">
                {r.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
