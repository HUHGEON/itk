import type { StatGroup } from "@/lib/matches";

/**
 * Team statistics as facing bars.
 *
 * Two numbers with a label between them is a table, and a table of twenty rows
 * is not read. The bar turns each row into a comparison that lands before the
 * numbers do, which is the only reason to show possession and pass counts at
 * all.
 *
 * The bar grows from the centre outward in both directions so the split is
 * legible at a glance; a single bar filled from the left would need reading
 * against its own track to mean anything.
 */
function Row({
  label,
  home,
  away,
  share,
}: {
  label: string;
  home: string;
  away: string;
  share: number;
}) {
  const leading = share > 0.5 ? "home" : share < 0.5 ? "away" : null;

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
        <span className="text-[11.5px] text-faint">{label}</span>
        <span
          className={`tnum text-[13px] ${
            leading === "away" ? "font-bold text-text" : "text-muted"
          }`}
        >
          {away}
        </span>
      </div>
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
    </div>
  );
}

export function StatBars({ groups }: { groups: StatGroup[] }) {
  if (groups.length === 0) return null;

  return (
    <section className="border-b border-border px-[var(--gutter)] py-5">
      <h2 className="pb-1 text-[12px] font-semibold text-muted">기록</h2>
      <div className="grid gap-x-10 gap-y-2 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g.title} className="min-w-0">
            <h3 className="pt-3 pb-1 text-[11px] font-medium text-faint">
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
