"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { animate, stagger } from "animejs";
import { ArrowDown, ArrowUp, Eye, EyeSlash } from "@phosphor-icons/react/dist/ssr";
import { loadWho, photoUrl, type WhoData } from "@/lib/games/data";
import { daily, dayNumber } from "@/lib/games/seed";
import { reducedMotion } from "@/lib/motion";
import { PlayerPicker, type PickerItem } from "./PlayerPicker";
import { share, useDaily } from "./useDaily";

const MAX = 8;
/** The mystery player comes from the best-known squads, by market value. */
const POOL = 300;

const POS_KO: Record<string, string> = { GK: "골키퍼", DF: "수비수", MF: "미드필더", FW: "공격수" };

/**
 * What fits in a tile a sixth of a phone wide. "프리미어리그" did not - it ran
 * off both edges at 390px - and these are the names Korean fans say anyway.
 */
const LEAGUE_TILE: Record<number, string> = { 47: "EPL", 87: "라리가", 55: "세리에A", 54: "분데스", 53: "리그1" };
const flag = (code: string) => `https://images.fotmob.com/image_resources/logo/teamlogo/${code.toLowerCase()}.png`;
const crest = (id: number) => `https://images.fotmob.com/image_resources/logo/teamlogo/${id}.png`;

interface WhoPlayer extends PickerItem {
  id: number;
  shirt: number | null;
  nation: string;
  pos: string;
  age: number | null;
  club: number;
  league: number;
  value: number;
}

function ageOn(dob: string | null, now = new Date()): number | null {
  if (!dob) return null;
  const [y, m, d] = dob.split("-").map(Number);
  let a = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) a--;
  return a;
}

type Mark = "hit" | "near" | "miss";
const TILE: Record<Mark, string> = {
  hit: "bg-emerald-500 text-black",
  near: "bg-amber-400 text-black",
  miss: "bg-surface-3 text-text",
};

/** Exact, within two, or which way to look. */
function compare(guess: number | null, target: number | null): { mark: Mark; dir: -1 | 0 | 1 } {
  if (guess === null || target === null) return { mark: "miss", dir: 0 };
  if (guess === target) return { mark: "hit", dir: 0 };
  return { mark: Math.abs(guess - target) <= 2 ? "near" : "miss", dir: target > guess ? 1 : -1 };
}

interface Save {
  guesses: number[];
  won: boolean;
  done: boolean;
}

/**
 * Who Are Ya?: guess today's player in eight.
 *
 * Every guess is compared with the mystery player on six things - nation,
 * league, club, position, age and shirt number - and the tiles say how close:
 * green for exact, amber for close (same continent; within two years or two
 * numbers), and an arrow for which way to go. The photograph starts blurred and
 * sharpens with every miss; hiding it makes the tiles do all the work.
 */
export function WhoGame() {
  const [data, setData] = useState<WhoData | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    loadWho().then(setData, () => setError(true));
  }, []);

  const day = dayNumber();
  const [save, setSave] = useDaily<Save>("who", day, { guesses: [], won: false, done: false });
  const [hide, setHide] = useState(false);
  const [copied, setCopied] = useState(false);
  const rows = useRef<HTMLDivElement>(null);

  const leagueOf = useMemo(() => new Map(data?.clubs.map((c) => [c.id, c.league]) ?? []), [data]);
  const clubName = useMemo(() => new Map(data?.clubs.map((c) => [c.id, c.ko]) ?? []), [data]);
  const leagueName = useMemo(() => new Map(data?.leagues.map((l) => [l.id, l.ko]) ?? []), [data]);

  const players = useMemo<WhoPlayer[]>(
    () =>
      data?.players.map(([id, ko, en, shirt, nation, pos, dob, club, value, wiki]) => ({
        key: id,
        id,
        ko: ko ?? en,
        en: ko ? en : "",
        alt: wiki ? [wiki] : [],
        fame: value,
        sub: clubName.get(club),
        shirt,
        nation,
        pos,
        age: ageOn(dob),
        club,
        league: leagueOf.get(club) ?? 0,
        value,
      })) ?? [],
    [data, clubName, leagueOf],
  );
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const answer = useMemo(() => {
    const pool = players
      .filter((p) => /[가-힣]/.test(p.ko))
      .sort((a, b) => b.value - a.value)
      .slice(0, POOL);
    return pool.length ? daily(pool, day, 7331) : null;
  }, [players, day]);

  // The newest row turns over one tile at a time.
  const count = save.guesses.length;
  const prev = useRef(count);
  useEffect(() => {
    const el = rows.current;
    if (!el || count <= prev.current || reducedMotion()) {
      prev.current = count;
      return;
    }
    prev.current = count;
    const tiles = el.querySelectorAll<HTMLElement>(`[data-row="${count - 1}"] [data-tile]`);
    animate(tiles, { rotateX: [-90, 0], duration: 420, ease: "outBack(1.4)", delay: stagger(90) });
  }, [count]);

  const guess = (p: WhoPlayer) => {
    if (!answer || save.done || save.guesses.includes(p.id)) return;
    const right = p.id === answer.id;
    setSave((s) => {
      const guesses = [...s.guesses, p.id];
      return { guesses, won: right, done: right || guesses.length >= MAX };
    });
  };

  if (error) return <p className="py-16 text-center text-muted">게임 데이터를 불러오지 못했습니다.</p>;
  if (!data || !answer) return <p className="py-16 text-center text-muted">불러오는 중…</p>;

  const blur = save.done ? 0 : [24, 19, 15, 11, 8, 5, 3, 1][Math.min(count, 7)];
  const cont = (code: string) => data.nations[code]?.cont ?? "";

  return (
    <div className="mx-auto max-w-[520px]">
      <div className="mb-3 flex items-center justify-between text-[12.5px] text-muted">
        <span className="font-semibold text-text">#{day}</span>
        <span className="tnum">
          {save.done ? (save.won ? `${count}번 만에 맞힘` : "실패") : `${count}/${MAX}`}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative size-28 shrink-0 overflow-hidden rounded-[10px] border border-border bg-surface-2">
          {hide && !save.done ? (
            <span className="flex h-full items-center justify-center text-[36px] font-bold text-faint">?</span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl(answer.id)}
              alt={save.done ? answer.ko : "오늘의 선수 (흐린 사진)"}
              className="h-full w-full object-cover transition-[filter] duration-700"
              style={{ filter: `blur(${blur}px)` }}
              draggable={false}
            />
          )}
        </div>
        <div className="min-w-0">
          {save.done ? (
            <>
              <p className="text-[12px] font-bold tracking-[0.2em] text-faint">{save.won ? "정답" : "오늘의 선수"}</p>
              <p className={`text-[22px] font-bold ${save.won ? "text-emerald-300" : "text-text"}`}>{answer.ko}</p>
              <p className="text-[12.5px] text-muted">
                {answer.en} · {clubName.get(answer.club)}
              </p>
            </>
          ) : (
            <>
              <p className="text-[14px] font-semibold text-text">5대 리그 현역 선수를 8번 안에</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
                틀릴 때마다 사진이 선명해집니다. 초록은 일치, 노랑은 근접(같은 대륙 · 2 이내), 화살표는 정답 쪽.
              </p>
              <button
                type="button"
                onClick={() => setHide((h) => !h)}
                className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-faint hover:text-muted"
              >
                {hide ? <Eye className="size-3.5" /> : <EyeSlash className="size-3.5" />}
                {hide ? "사진 보기" : "사진 숨기기 (어렵게)"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-4">
        {save.done ? (
          <button
            type="button"
            data-press
            onClick={async () => {
              const line = (id: number) => {
                const g = byId.get(id)!;
                const m = [
                  g.nation === answer.nation ? "🟩" : cont(g.nation) && cont(g.nation) === cont(answer.nation) ? "🟨" : "⬛",
                  g.league === answer.league ? "🟩" : "⬛",
                  g.club === answer.club ? "🟩" : "⬛",
                  g.pos === answer.pos ? "🟩" : "⬛",
                  { hit: "🟩", near: "🟨", miss: "⬛" }[compare(g.age, answer.age).mark],
                  { hit: "🟩", near: "🟨", miss: "⬛" }[compare(g.shirt, answer.shirt).mark],
                ];
                return m.join("");
              };
              setCopied(
                await share(
                  `ITK+ 후 아 유? #${day} ${save.won ? count : "X"}/${MAX}\n${save.guesses.map(line).join("\n")}\nhttps://itkplus.vercel.app/games/who`,
                ),
              );
            }}
            className="w-full rounded-[10px] border border-border-strong py-3 text-[14px] font-semibold text-text hover:bg-surface-2"
          >
            {copied ? "복사했습니다" : "결과 복사"}
          </button>
        ) : (
          <PlayerPicker items={players} onPick={guess} autoFocus placeholder="선수 이름 (한글·영문·초성)" />
        )}
      </div>

      {count > 0 && (
        /*
         * Name above, six equal tiles below.
         *
         * A name column beside the tiles needed 500px and scrolled sideways on
         * a phone, hiding age and shirt number - the two tiles with arrows.
         * `minmax(0, 1fr)` rather than `1fr` so a long nation name cannot
         * widen its own column: measured, it did, and every row came out a
         * different shape.
         */
        <div ref={rows} className="mt-4 [perspective:600px]">
          <div className="grid grid-cols-6 gap-1 pb-1 text-center text-[10.5px] font-semibold text-faint">
            <span>국적</span>
            <span>리그</span>
            <span>팀</span>
            <span>포지션</span>
            <span>나이</span>
            <span>등번호</span>
          </div>
          {save.guesses.map((id, i) => {
            const g = byId.get(id);
            if (!g) return null;
            const nat: Mark =
              g.nation === answer.nation ? "hit" : cont(g.nation) && cont(g.nation) === cont(answer.nation) ? "near" : "miss";
            const age = compare(g.age, answer.age);
            const num = compare(g.shirt, answer.shirt);
            const Dir = ({ d }: { d: -1 | 0 | 1 }) =>
              d === 1 ? <ArrowUp className="size-3" weight="bold" /> : d === -1 ? <ArrowDown className="size-3" weight="bold" /> : null;
            const tile =
              "flex h-12 min-w-0 flex-col items-center justify-center rounded-[6px] px-0.5 text-center text-[12px] font-bold leading-tight";
            return (
              <div key={id} data-row={i} className="mb-2">
                <p className="mb-1 truncate px-0.5 text-[13px] font-semibold text-text">
                  {g.ko}
                  <span className="ml-1.5 text-[11.5px] font-normal text-faint">{clubName.get(g.club)}</span>
                </p>
                <div className="grid grid-cols-[repeat(6,minmax(0,1fr))] gap-1">
                  <div data-tile className={`${tile} ${TILE[nat]}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={flag(g.nation)} alt="" className="size-5 object-contain" />
                    <span className="mt-0.5 w-full truncate text-[9.5px] font-semibold">
                      {data.nations[g.nation]?.ko ?? g.nation}
                    </span>
                  </div>
                  <div data-tile className={`${tile} ${TILE[g.league === answer.league ? "hit" : "miss"]} text-[10.5px]`}>
                    {LEAGUE_TILE[g.league] ?? leagueName.get(g.league)}
                  </div>
                  <div data-tile className={`${tile} ${TILE[g.club === answer.club ? "hit" : "miss"]}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={crest(g.club)} alt={clubName.get(g.club)} className="size-6 object-contain" />
                  </div>
                  <div data-tile className={`${tile} ${TILE[g.pos === answer.pos ? "hit" : "miss"]} text-[11px]`}>
                    {POS_KO[g.pos] ?? g.pos}
                  </div>
                  <div data-tile className={`${tile} ${TILE[age.mark]} tnum`}>
                    {g.age ?? "–"}
                    <Dir d={age.dir} />
                  </div>
                  <div data-tile className={`${tile} ${TILE[num.mark]} tnum`}>
                    {g.shirt ?? "–"}
                    <Dir d={num.dir} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
