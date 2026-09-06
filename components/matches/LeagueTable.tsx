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
/**
 * Which positions mean something.
 *
 * A table without its zones is a list of numbers: the whole reason to look at
 * one in September is to see who is in the European places and who is in the
 * bottom three. The bands differ by competition - a 36 team league phase takes
 * the top eight straight through and the next sixteen to a play-off - so the
 * caller says how many rows are in play rather than this guessing from length.
 */
export interface TableZones {
  /** Positions 1..n are the top band. */
  top?: number;
  /** The band under it, for a play-off or a secondary competition. */
  second?: number;
  /** The last n positions go down. */
  drop?: number;
  /** What each band is called in this competition. */
  labels?: Partial<Record<"top" | "second" | "drop", string>>;
}

function zoneOf(rank: number, total: number, z: TableZones) {
  if (z.top && rank <= z.top) return "top";
  if (z.second && rank <= z.second) return "second";
  if (z.drop && rank > total - z.drop) return "drop";
  return null;
}

const DEFAULT_LABEL: Record<string, string> = {
  top: "상위",
  second: "다음 라운드",
  drop: "강등",
};

const ZONE_BAR: Record<string, string> = {
  top: "bg-emerald-400",
  second: "bg-sky-400",
  drop: "bg-red-400",
};

export function LeagueTable({
  rows,
  zones = {},
}: {
  rows: TableRow[];
  zones?: TableZones;
}) {
  if (rows.length === 0) {
    return (
      <p className="px-[var(--gutter)] py-12 text-center text-[14px] text-muted">
        아직 순위가 나오지 않았습니다
      </p>
    );
  }

  const shown = (["top", "second", "drop"] as const).filter(
    (k) => zones[k === "top" ? "top" : k === "second" ? "second" : "drop"],
  );

  return (
    <div className="overflow-x-auto px-[var(--gutter)] pb-8">
      <table className="w-full min-w-[30rem] border-collapse">
        <thead>
          <tr className="border-b border-border text-[11px] text-faint">
            <th className="w-2 py-2" aria-hidden />
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
              {/* A colour down the outside edge, which is how a table
                  says "these go up" without a legend in every row. */}
              <td className="w-2 py-0">
                {zoneOf(r.rank, rows.length, zones) && (
                  <span
                    aria-hidden
                    className={`block h-[34px] w-[3px] rounded-full ${
                      ZONE_BAR[zoneOf(r.rank, rows.length, zones)!]
                    }`}
                  />
                )}
              </td>
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
                      /* A row in a table is a standalone target, so the
                         link takes the row's height rather than its text's. */
                      className="-my-1.5 truncate py-1.5 text-[13.5px] font-semibold text-text transition-colors hover:text-accent"
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

      {shown.length > 0 && (
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-3 text-[11px] text-faint">
          {shown.map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={`h-2.5 w-[3px] rounded-full ${ZONE_BAR[k]}`}
              />
              {zones.labels?.[k] ?? DEFAULT_LABEL[k]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
