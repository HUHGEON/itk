import type { FmHeadToHead, FmMeeting } from "@/lib/fotmob";
import type { MatchSide } from "@/lib/matches";
import { koClub, seoul } from "@/lib/matches";

/**
 * What these two have done to each other before.
 *
 * The record leads, as a bar, because "who usually wins this" is the whole
 * question and three numbers in a row make a reader do the arithmetic. The
 * meetings follow, most recent first, with the winner carrying the weight.
 *
 * Only finished meetings count. A fixture already scheduled for next season
 * comes back in the same list and would otherwise sit at the top as a match
 * with no score.
 */
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

/** The source names competitions in English; the page is Korean. */
const COMP_KO: Record<string, string> = {
  "Premier League": "프리미어리그",
  "FA Cup": "FA컵",
  "EFL Cup": "EFL컵",
  "League Cup": "리그컵",
  "Community Shield": "커뮤니티 실드",
  Championship: "챔피언십",
  "Champions League": "챔피언스리그",
  "Europa League": "유로파리그",
  "Conference League": "컨퍼런스리그",
  "UEFA Super Cup": "UEFA 슈퍼컵",
  LaLiga: "라리가",
  "Copa del Rey": "코파 델 레이",
  "Super Cup": "슈퍼컵",
  "Serie A": "세리에 A",
  "Coppa Italia": "코파 이탈리아",
  Bundesliga: "분데스리가",
  "DFB Pokal": "DFB 포칼",
  "Ligue 1": "리그 1",
  "Coupe de France": "쿠프 드 프랑스",
  Eredivisie: "에레디비시",
  "Club Friendlies": "친선 경기",
};

function Bar({
  record,
  home,
  away,
}: {
  record: [number, number, number];
  home: MatchSide;
  away: MatchSide;
}) {
  const [h, d, a] = record;
  const total = h + d + a || 1;
  const pct = (n: number) => `${(n / total) * 100}%`;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 pb-2 text-[12.5px]">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate font-semibold text-text">{home.name}</span>
          <span className="tnum text-muted">{h}승</span>
        </span>
        <span className="tnum shrink-0 text-[12.5px] text-faint">{d}무</span>
        <span className="flex min-w-0 items-baseline justify-end gap-1.5">
          <span className="tnum text-muted">{a}승</span>
          <span className="truncate font-semibold text-text">{away.name}</span>
        </span>
      </div>
      <div className="flex h-[5px] gap-px overflow-hidden rounded-full">
        <span className="h-full rounded-l-full bg-accent" style={{ width: pct(h) }} />
        <span className="h-full bg-surface-3" style={{ width: pct(d) }} />
        <span className="h-full rounded-r-full bg-sky-500" style={{ width: pct(a) }} />
      </div>
      <p className="pt-1.5 text-[12px] text-faint">
        <span className="tnum">{total}</span>번 만났습니다
      </p>
    </div>
  );
}

/**
 * One meeting, laid out as FotMob lays a result: the two clubs either side of
 * a score in the middle, with the date and competition to the left. The
 * score used to follow the home side's name and ended up hard against the
 * right, beside the competition, where it read as belonging to neither club.
 */
function Meeting({ m, home, away }: { m: FmMeeting; home: MatchSide; away: MatchSide }) {
  const d = seoul(m.date);
  const hk = koClub(m.home);
  const ak = koClub(m.away);
  const crest = (name: string) => (name === home.name ? home.crest : name === away.name ? away.crest : null);
  // `outcome` is from this fixture's home side's view; which side of *that*
  // meeting won is read off its own score.
  const [a, b] = m.score.split("-").map((x) => Number(x.trim()));
  const homeWon = a > b;
  const awayWon = b > a;
  const badge = homeWon || awayWon ? "bg-text text-bg" : "bg-surface-3 text-text";

  return (
    <li className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-3 py-2.5 sm:grid-cols-[96px_minmax(0,1fr)]">
      <span className="min-w-0 leading-tight">
        <span className="tnum block text-[12.5px] text-muted">
          {d.year}.{d.month}.{d.day}
          <span className="ml-1 hidden text-[12px] text-faint sm:inline">({WEEKDAY[d.weekday]})</span>
        </span>
        <span className="block truncate text-[11.5px] text-faint">
          {m.competition ? (COMP_KO[m.competition] ?? m.competition) : null}
        </span>
      </span>
      <span className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2.5">
        <span className="flex min-w-0 items-center justify-end gap-2">
          <span className={`truncate text-right text-[13.5px] ${homeWon ? "font-semibold text-text" : "text-muted"}`}>
            {hk}
          </span>
          <Crest src={crest(hk)} />
        </span>
        <span className={`tnum min-w-[54px] rounded-md px-2 py-0.5 text-center text-[13px] font-bold ${badge}`}>
          {m.score}
        </span>
        <span className="flex min-w-0 items-center gap-2">
          <Crest src={crest(ak)} />
          <span className={`truncate text-[13.5px] ${awayWon ? "font-semibold text-text" : "text-muted"}`}>
            {ak}
          </span>
        </span>
      </span>
    </li>
  );
}

function Crest({ src }: { src: string | null }) {
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="size-5 shrink-0 object-contain" />;
}

export function HeadToHead({
  h2h,
  home,
  away,
}: {
  h2h: FmHeadToHead;
  home: MatchSide;
  away: MatchSide;
}) {
  return (
    <section className="px-[var(--gutter)] py-5">
      <div className="mx-auto max-w-[46rem]">
        <Bar record={h2h.record} home={home} away={away} />
        <ul className="divide-y divide-border/50 border-t border-border/60 pt-1">
          {h2h.meetings.slice(0, 20).map((m) => (
            <Meeting key={`${m.date}${m.home}`} m={m} home={home} away={away} />
          ))}
        </ul>
      </div>
    </section>
  );
}
