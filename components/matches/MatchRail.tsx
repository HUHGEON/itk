import Link from "next/link";
import { COMPETITIONS } from "@/lib/matches";
import { loadTeams } from "@/lib/registry";
import { TeamCrest } from "@/components/TeamCrest";

/**
 * The way around the match pages.
 *
 * Competitions first, then the clubs being followed. Both are destinations
 * rather than filters, because a table and a club's season are pages in their
 * own right - a filter chip on the fixture list could not carry either.
 *
 * Only competitions with a table are listed. A knockout cup has no standings
 * and no season shape, so it appears on the fixture list on the days it is
 * played and nowhere else.
 */
const RANKED = COMPETITIONS.filter(
  (c) => c.kind === "league" || c.code === "uefa.champions" || c.code === "uefa.europa",
);

export function MatchRail({ active }: { active?: string }) {
  const teams = loadTeams();

  return (
    <div className="flex flex-col">
      <Section title="대회">
        {RANKED.map((c) => (
          <Row
            key={c.code}
            href={`/matches/league/${c.code}`}
            on={active === c.code}
          >
            {c.ko}
          </Row>
        ))}
      </Section>

      <Section title="구단">
        {teams.map((t) => (
          <Row
            key={t.slug}
            href={`/matches/team/${t.slug}`}
            on={active === t.slug}
          >
            <span className="flex items-center gap-2">
              <TeamCrest team={t} size={16} />
              {t.ko}
            </span>
          </Row>
        ))}
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border py-3 last:border-b-0">
      <h2 className="px-[var(--gutter)] pb-1.5 text-[11px] font-semibold text-faint">
        {title}
      </h2>
      <nav className="flex flex-col">{children}</nav>
    </section>
  );
}

function Row({
  href,
  on,
  children,
}: {
  href: string;
  on: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={`px-[var(--gutter)] py-[7px] text-[12.5px] transition-colors ${
        on
          ? "border-l-2 border-accent bg-accent/[0.07] pl-[calc(var(--gutter)-2px)] font-medium text-accent"
          : "text-muted hover:bg-surface-2/50 hover:text-text"
      }`}
    >
      {children}
    </Link>
  );
}
