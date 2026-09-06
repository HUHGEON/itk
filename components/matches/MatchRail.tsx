import Link from "next/link";
import { COMPETITIONS } from "@/lib/matches";
import { loadTeams } from "@/lib/registry";
import { TeamCrest } from "@/components/TeamCrest";
import { FavouriteStar } from "./FavouriteStar";
import { MyTeamsRail } from "./MyTeamsRail";

/**
 * The way around the match pages.
 *
 * The competition list is the primary control on the fixture page, not a
 * secondary one. A Saturday runs to forty matches across a dozen competitions,
 * and stacking them all down one column means scrolling past five leagues to
 * reach the one being looked for. Picking a competition here narrows the day to
 * it; picking nothing shows everything.
 *
 * Clubs work the same way but lead somewhere else - a club has a season, which
 * is a page rather than a filtered day.
 */
const RANKED = COMPETITIONS.filter(
  (c) => c.kind === "league" || c.code === "uefa.champions" || c.code === "uefa.europa",
);
const CUPS = COMPETITIONS.filter((c) => c.kind === "cup");

export function MatchRail({
  active,
  day,
  counts,
}: {
  active?: string;
  /** Carried on every competition link so switching does not lose the date. */
  day?: string;
  /** Matches per competition on the day being shown, keyed by Korean name. */
  counts?: Record<string, number>;
}) {
  const teams = loadTeams();
  const playedCups = counts
    ? CUPS.filter((c) => (counts[c.ko] ?? 0) > 0 || active === c.code)
    : [];
  const to = (code: string) => {
    const p = new URLSearchParams();
    if (day) p.set("d", day);
    p.set("comp", code);
    return `/matches?${p}`;
  };

  return (
    <div className="flex flex-col">
      {/* Followed clubs first, because they are the reason someone opened the
          rail at all. Renders nothing until there are some. */}
      <MyTeamsRail teams={teams} active={active} />

      <Section title="대회">
        <Row href={day ? `/matches?d=${day}` : "/matches"} on={!active}>
          전체 경기
        </Row>
        {RANKED.map((c) => (
          <Row key={c.code} href={to(c.code)} on={active === c.code}>
            {c.ko}
            <Count n={counts?.[c.ko]} />
          </Row>
        ))}
      </Section>

      {/*
        Cups only when there are cup matches.
        
        Eleven domestic cups and super cups exist across these six countries,
        and on a normal weekend none of them is being played: the FA Cup starts
        in January, the super cups are single summer fixtures. Listing all
        eleven every day buried the clubs below them under names that lead
        nowhere. They appear on the days they are on.
      */}
      {playedCups.length > 0 && (
        <Section title="컵">
          {playedCups.map((c) => (
            <Row key={c.code} href={to(c.code)} on={active === c.code}>
              {c.ko}
              <Count n={counts?.[c.ko]} />
            </Row>
          ))}
        </Section>
      )}

      <Section title="구단">
        {teams.map((t) => (
          <Row
            key={t.slug}
            href={`/matches/team/${t.slug}`}
            on={active === t.slug}
            after={<FavouriteStar slug={t.slug} name={t.ko} />}
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

/** How many matches a competition has today. Absent means none. */
function Count({ n }: { n?: number }) {
  if (!n) return null;
  return <span className="tnum ml-1.5 text-[11px] opacity-60">{n}</span>;
}

function Row({
  href,
  on,
  children,
  after,
}: {
  href: string;
  on: boolean;
  children: React.ReactNode;
  /** Sits at the end of the row and does not navigate. */
  after?: React.ReactNode;
}) {
  const inner = (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={`flex min-w-0 flex-1 items-center transition-colors ${
        on ? "font-medium text-accent" : "text-muted group-hover:text-text"
      }`}
    >
      {children}
    </Link>
  );

  return (
    <div
      className={`group flex items-center px-[var(--gutter)] py-[7px] text-[12.5px] transition-colors ${
        on
          ? "border-l-2 border-accent bg-accent/[0.07] pl-[calc(var(--gutter)-2px)]"
          : "hover:bg-surface-2/50"
      }`}
    >
      {inner}
      {after}
    </div>
  );
}
