import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { fotmobPlayer, type FmRecentMatch } from "@/lib/fotmob";
import { seoul } from "@/lib/matches";
import { MatchRail } from "@/components/matches/MatchRail";
import { MEASURE } from "@/components/matches/Measure";
import { Shell } from "@/components/Shell";
import { SearchBox } from "@/components/SearchBox";
import { CollectButton } from "@/components/CollectButton";

/**
 * One player.
 *
 * Opened from a lineup, so it answers the question a lineup raises: who is this
 * and how has he been playing. The season's numbers first because they are the
 * summary, then the last few matches because they are the detail behind it.
 */
export const revalidate = 3600;

type Params = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const p = await fotmobPlayer(Number(id));
  if (!p) return { title: "선수 · ITK+" };
  return {
    title: `${p.name} · ITK+`,
    description: `${p.name}${p.team ? ` · ${p.team}` : ""} 기록과 최근 경기.`,
  };
}

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

function tone(r: number): string {
  if (r >= 7.5) return "bg-emerald-500 text-black";
  if (r >= 6.5) return "bg-amber-500 text-black";
  return "bg-zinc-500 text-white";
}

export default async function PlayerPage({ params }: { params: Params }) {
  const { id } = await params;
  const p = await fotmobPlayer(Number(id));
  if (!p) notFound();

  return (
    <Shell
      rail={<MatchRail />}
      actions={
        <>
          <Suspense fallback={null}>
            <SearchBox
              state={{ tiers: [], teams: [], league: "", who: "", q: "" }}
            />
          </Suspense>
          <CollectButton lastCollect={null} />
        </>
      }
    >
      <header className="border-b border-border">
        <div
          className={`${MEASURE} flex items-center gap-4 px-[var(--gutter)] py-6`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.image}
            alt=""
            width={72}
            height={72}
            className="size-[72px] shrink-0 rounded-full bg-surface-3 object-cover object-top"
          />
          <div className="min-w-0">
            <h1 className="truncate text-[22px] font-bold tracking-tight text-text">
              {p.name}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
              {p.team && <span>{p.team}</span>}
              {p.position && (
                <>
                  <span aria-hidden className="text-faint">
                    ·
                  </span>
                  <span>{p.position}</span>
                </>
              )}
              {p.injury && (
                <>
                  <span aria-hidden className="text-faint">
                    ·
                  </span>
                  <span className="text-red-400">{p.injury}</span>
                </>
              )}
            </p>
          </div>
        </div>
      </header>

      {p.facts.length > 0 && (
        <section className="border-b border-border">
          <dl
            className={`${MEASURE} grid grid-cols-2 gap-x-8 gap-y-2 px-[var(--gutter)] py-4 sm:grid-cols-4`}
          >
            {p.facts.map((f) => (
              <div key={f.label} className="min-w-0">
                <dt className="text-[11px] text-faint">{f.label}</dt>
                <dd className="truncate text-[13.5px] font-medium text-text">
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {p.stats.length > 0 && (
        <section className="border-b border-border">
          <div className={`${MEASURE} px-[var(--gutter)] py-5`}>
            <h2 className="pb-3 text-[12px] font-semibold text-muted">
              {p.league ?? "이번 시즌"}
              {p.season && (
                <span className="tnum ml-1.5 font-normal text-faint">
                  {p.season}
                </span>
              )}
            </h2>
            <dl className="grid grid-cols-3 gap-x-6 gap-y-3 sm:grid-cols-4">
              {p.stats.map((s) => (
                <div key={s.label} className="min-w-0">
                  <dt className="truncate text-[11px] text-faint">{s.label}</dt>
                  <dd className="tnum text-[17px] font-bold text-text">
                    {s.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      {p.recent.length > 0 && (
        <section>
          <div className={`${MEASURE} px-[var(--gutter)] py-5`}>
            <h2 className="pb-2 text-[12px] font-semibold text-muted">
              최근 경기
            </h2>
            <ul className="divide-y divide-border/60 border-t border-border/60">
              {p.recent.map((m) => (
                <Recent key={`${m.date}${m.opponent}`} m={m} />
              ))}
            </ul>
          </div>
        </section>
      )}
    </Shell>
  );
}

function Recent({ m }: { m: FmRecentMatch }) {
  const d = seoul(m.date);
  const badge =
    m.outcome === "승"
      ? "bg-emerald-500/15 text-emerald-400"
      : m.outcome === "패"
        ? "bg-red-500/15 text-red-400"
        : "bg-surface-3 text-muted";

  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2.5">
      <div className="tnum w-[52px] shrink-0 text-[11.5px] leading-tight text-faint">
        <div>
          {d.month}.{d.day}
        </div>
        <div className="text-[10.5px]">({WEEKDAY[d.weekday]})</div>
      </div>

      <div className="flex min-w-0 items-center gap-2.5">
        <span className="shrink-0 text-[11.5px] text-faint">
          {m.home ? "홈" : "원정"}
        </span>
        <span className="min-w-0 truncate text-[13.5px] text-text">
          {m.opponent}
        </span>
        {m.goals > 0 && (
          <span className="shrink-0 text-[11px]">
            ⚽{m.goals > 1 ? m.goals : ""}
          </span>
        )}
        {m.assists > 0 && (
          <span className="tnum shrink-0 text-[10.5px] font-bold text-sky-400">
            A{m.assists > 1 ? m.assists : ""}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {m.minutes != null && (
          <span className="tnum text-[11px] text-faint">{m.minutes}&apos;</span>
        )}
        <span className="tnum text-[13.5px] font-bold text-text">{m.score}</span>
        <span
          className={`rounded-[3px] px-1.5 py-[1px] text-[10.5px] font-bold ${badge}`}
        >
          {m.outcome}
        </span>
        {/* A rating of zero is the source saying it has none, not a nought. */}
        {m.rating != null && m.rating > 0 ? (
          <span
            className={`tnum w-[30px] rounded-[3px] text-center text-[11px] font-bold ${tone(m.rating)}`}
          >
            {m.rating.toFixed(1)}
          </span>
        ) : (
          <span className="w-[30px]" />
        )}
      </div>
    </li>
  );
}
