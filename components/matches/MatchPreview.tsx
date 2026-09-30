import type { FmAbsent, FmFormGame, FmPreview } from "@/lib/fotmob";
import { koClub, seoul, type MatchSide } from "@/lib/matches";

/**
 * A fixture before kick-off, laid out as FotMob lays its preview: who is
 * missing on each side, each side's last five results, and the ground.
 *
 * The page used to open an upcoming match on the head-to-head list alone,
 * which answered "who usually wins this" and nothing a reader wants to know
 * the day before - is Saliba fit, how have they been playing.
 */
export function MatchPreview({ preview, home, away }: { preview: FmPreview; home: MatchSide; away: MatchSide }) {
  const anyAbsent = preview.absent.home.length + preview.absent.away.length > 0;
  const anyForm = preview.form.home.length + preview.form.away.length > 0;

  return (
    <div className="divide-y divide-border">
      {anyAbsent && (
        <Section title="부상 및 출장 정지 선수">
          <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
            <Absent side={home} list={preview.absent.home} />
            <Absent side={away} list={preview.absent.away} />
          </div>
        </Section>
      )}

      {anyForm && (
        <Section title="최근 5경기">
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <Form side={home} list={preview.form.home} />
            <Form side={away} list={preview.form.away} />
          </div>
        </Section>
      )}

      {(preview.venue || preview.weather || preview.round) && (
        <Section title="경기 정보">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {preview.round && <Info label="라운드" value={`${preview.round}라운드`} />}
            {preview.venue && <Info label="경기장" value={preview.venue.name} sub={preview.venue.city} />}
            {preview.venue?.capacity && (
              <Info label="수용 인원" value={`${preview.venue.capacity.toLocaleString("ko-KR")}명`} />
            )}
            {preview.weather && <Info label="날씨" value={`${preview.weather.temp}°C`} sub={preview.weather.text} />}
          </dl>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-[var(--gutter)] py-6 sm:px-6">
      <h3 className="mb-4 text-center text-[15px] font-bold text-text">{title}</h3>
      {children}
    </section>
  );
}

function SideHead({ side }: { side: MatchSide }) {
  return (
    <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-muted">
      {side.crest && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={side.crest} alt="" className="size-5 object-contain" />
      )}
      {side.name}
    </p>
  );
}

function Absent({ side, list }: { side: MatchSide; list: FmAbsent[] }) {
  return (
    <div>
      <SideHead side={side} />
      {list.length === 0 ? (
        <p className="py-2 text-[13px] text-faint">알려진 결장자 없음</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {list.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://images.fotmob.com/image_resources/playerimages/${p.id}.png`}
                alt=""
                loading="lazy"
                className="size-9 shrink-0 rounded-full bg-surface-3 object-cover object-top"
              />
              <span
                aria-hidden
                className={`flex size-4 shrink-0 items-center justify-center rounded-full text-[11px] leading-none font-bold ${
                  p.kind === "출장 정지" ? "rounded-[3px] bg-red-500 text-transparent" : "bg-white text-red-600"
                }`}
              >
                +
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold text-text">{p.name}</span>
                <span className="block truncate text-[12.5px] text-muted">
                  {p.kind}
                  {p.back && ` · ${p.back}`}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const RESULT = {
  W: { bg: "bg-emerald-600", label: "승" },
  D: { bg: "bg-zinc-500", label: "무" },
  L: { bg: "bg-red-600", label: "패" },
};

function Form({ side, list }: { side: MatchSide; list: FmFormGame[] }) {
  return (
    <div>
      <SideHead side={side} />
      <ul className="space-y-1.5">
        {list.map((g) => {
          const d = seoul(g.date);
          return (
            <li
              key={`${g.date}${g.home}`}
              className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2.5 rounded-xl bg-surface-2/60 px-3 py-2"
              title={`${d.month}월 ${d.day}일`}
            >
              <span className="truncate text-right text-[13px] text-text">{koClub(g.home)}</span>
              <span
                className={`tnum min-w-[52px] rounded-md px-2 py-0.5 text-center text-[13px] font-bold text-white ${RESULT[g.result].bg}`}
              >
                <span className="sr-only">{RESULT[g.result].label} </span>
                {g.score}
              </span>
              <span className="truncate text-[13px] text-text">{koClub(g.away)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Info({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <div className="rounded-xl bg-surface-2/60 px-3.5 py-3">
      <dt className="text-[12px] text-faint">{label}</dt>
      <dd className="mt-1 truncate text-[14px] font-semibold text-text">{value}</dd>
      {sub && <dd className="truncate text-[12.5px] text-muted">{sub}</dd>}
    </div>
  );
}
