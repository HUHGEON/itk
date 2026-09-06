import type { FmStatGroup } from "@/lib/fotmob";

/**
 * Team statistics as facing bars.
 *
 * Two numbers with a label between them is a table, and a table of forty rows
 * is not read. The bar turns each row into a comparison that lands before the
 * numbers do, growing from the centre outward in both directions so the split
 * is legible at a glance.
 *
 * A few figures have no meaningful bar - a distance in kilometres is not a
 * contest in the way possession is - so a row whose two values cannot be
 * compared simply shows them.
 */
function Row({ label, home, away, share }: FmStatGroup["rows"][number]) {
  const leading =
    share === null ? null : share > 0.5 ? "home" : share < 0.5 ? "away" : null;

  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-3">
        <span
          className={`tnum text-[13px] ${
            leading === "home" ? "font-bold text-text" : "text-muted"
          }`}
        >
          {home}
        </span>
        <span className="text-center text-[11.5px] text-faint">{label}</span>
        <span
          className={`tnum text-[13px] ${
            leading === "away" ? "font-bold text-text" : "text-muted"
          }`}
        >
          {away}
        </span>
      </div>
      {share !== null && (
        <div className="mt-1.5 flex h-[3px] gap-px overflow-hidden rounded-full">
          <span
            className={`h-full rounded-l-full transition-[width] duration-500 ${
              leading === "home" ? "bg-accent" : "bg-surface-3"
            }`}
            style={{ width: `${share * 100}%` }}
          />
          <span
            className={`h-full flex-1 rounded-r-full ${
              leading === "away" ? "bg-accent" : "bg-surface-3"
            }`}
          />
        </div>
      )}
    </div>
  );
}

export function StatBars({ groups }: { groups: FmStatGroup[] }) {
  if (groups.length === 0) return null;

  return (
    <section className="px-[var(--gutter)] py-5">
      <div className="mx-auto grid max-w-[64rem] gap-x-12 gap-y-2 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g.title} className="min-w-0">
            <h3 className="pt-3 pb-1 text-[11.5px] font-semibold text-muted">
              {g.title}
            </h3>
            <div className="divide-y divide-border/50">
              {g.rows.map((r) => (
                <Row key={r.label} {...r} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
