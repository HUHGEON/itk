"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { animate, stagger } from "animejs";
import { ArrowDown, ArrowUp, ChartBar, Eye, EyeSlash } from "@phosphor-icons/react/dist/ssr";
import { loadWho, photoUrl, type WhoData } from "@/lib/games/data";
import { daily, dayNumber } from "@/lib/games/seed";
import { reducedMotion } from "@/lib/motion";
import { PlayerPicker, type PickerItem } from "./PlayerPicker";
import { share, useDaily } from "./useDaily";
import { StatsModal, recordResult, useRecord } from "./Stats";

const MAX = 8;
/** The mystery player comes from the best-known squads, by market value. */
const POOL = 300;

const img = (path: string) => `https://images.fotmob.com/image_resources/logo/${path}.png`;
const flag = (code: string) => img(`teamlogo/${code.toLowerCase()}`);
const crest = (id: number) => img(`teamlogo/${id}`);
const leagueLogo = (id: number) => img(`leaguelogo/${id}`);

/*
 * Two states and no third, as in the original (measured on its board: every
 * circle is rgb(34, 197, 94) or rgb(148, 163, 184)). An earlier version here
 * added an amber "close" state - same continent, within two - that the
 * original does not have; the arrows are the only hint of distance.
 */
const HIT = "#22c55e";
const MISS = "#94a3b8";

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

/** Equal, or which way the answer lies. */
const dir = (guess: number | null, target: number | null): -1 | 0 | 1 =>
  guess === null || target === null || guess === target ? 0 : target > guess ? 1 : -1;

interface Save {
  guesses: number[];
  won: boolean;
  done: boolean;
}

/**
 * Who Are Ya?: guess today's player in eight.
 *
 * Every guess is compared with the mystery player on six things - nation,
 * league, club, position, age and shirt number. A circle is green when it
 * matches and grey when it does not; age and shirt number carry an arrow
 * toward the answer. The newest guess goes on top. The photograph stays
 * blurred until the game ends.
 */
export function WhoGame() {
  const [data, setData] = useState<WhoData | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    loadWho().then(setData, () => setError(true));
  }, []);

  const day = dayNumber();
  const [save, setSave] = useDaily<Save>("who", day, { guesses: [], won: false, done: false });
  const [record, setRecord] = useRecord("who");
  const [hide, setHide] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [copied, setCopied] = useState(false);
  const rows = useRef<HTMLDivElement>(null);

  const leagueOf = useMemo(() => new Map(data?.clubs.map((c) => [c.id, c.league]) ?? []), [data]);
  const clubName = useMemo(() => new Map(data?.clubs.map((c) => [c.id, c.ko]) ?? []), [data]);

  const players = useMemo<WhoPlayer[]>(
    () =>
      data?.players.map(([id, ko, en, shirt, nation, pos, dob, club, value, wiki]) => ({
        key: id,
        id,
        ko: ko ?? en,
        en: ko ? en : "",
        alt: wiki ? [wiki] : [],
        fame: value,
        sub: `${pos} · ${clubName.get(club) ?? ""}`,
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

  // The newest row is drawn at the top and turns over one circle at a time.
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
    animate(tiles, { rotateY: [-90, 0], duration: 380, ease: "outBack(1.4)", delay: stagger(110) });
  }, [count]);

  const guess = (p: WhoPlayer) => {
    if (!answer || save.done || save.guesses.includes(p.id)) return;
    const right = p.id === answer.id;
    const guesses = [...save.guesses, p.id];
    const done = right || guesses.length >= MAX;
    setSave({ guesses, won: right, done });
    if (done) {
      setRecord(recordResult("who", day, right, guesses.length));
      // After the last row has turned over, as the original does.
      window.setTimeout(() => setShowStats(true), 1400);
    }
  };

  if (error) return <p className="py-16 text-center text-muted">게임 데이터를 불러오지 못했습니다.</p>;
  if (!data || !answer) return <p className="py-16 text-center text-muted">불러오는 중…</p>;

  const shareText = () => {
    const line = (id: number) => {
      const g = byId.get(id)!;
      const m = (ok: boolean) => (ok ? "🟩" : "⬜");
      return [
        m(g.nation === answer.nation),
        m(g.league === answer.league),
        m(g.club === answer.club),
        m(g.pos === answer.pos),
        m(g.age === answer.age),
        m(g.shirt === answer.shirt),
      ].join("");
    };
    return `ITK+ 후 아 유? #${day} ${save.won ? count : "X"}/${MAX}\n${save.guesses.map(line).join("\n")}\nhttps://itkplus.vercel.app/games/who`;
  };

  const blurred = !save.done;

  return (
    <div className="mx-auto max-w-[480px]">
      <div className="mb-2 flex items-center justify-between text-[12.5px] text-muted">
        <span className="font-semibold text-text">#{day}</span>
        <button
          type="button"
          onClick={() => setShowStats(true)}
          aria-label="통계"
          className="rounded-[6px] p-1 text-muted hover:text-text"
        >
          <ChartBar className="size-5" />
        </button>
      </div>

      {/* The card: photograph above, the guess box inside it. */}
      <div className="rounded-[10px] border border-border bg-surface p-4">
        <div className="relative mx-auto size-40 overflow-hidden rounded-[10px] bg-surface-2">
          {hide && !save.done ? (
            <span className="flex h-full items-center justify-center text-[44px] font-bold text-faint">?</span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl(answer.id)}
              alt={save.done ? answer.ko : "오늘의 선수 (흐린 사진)"}
              draggable={false}
              className="h-full w-full object-cover transition-[filter] duration-500"
              // One fixed blur until the end - measured on the original:
              // blur(9px) on the fourth guess, none once it was solved.
              style={{ filter: blurred ? "blur(9px)" : "none" }}
            />
          )}
          {save.done && (
            <span className="absolute top-1.5 left-1.5 flex flex-col items-center gap-1">
              <span className="rounded-[4px] bg-black/60 px-1 text-[11px] font-bold text-white">{answer.pos}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={flag(answer.nation)} alt="" className="size-6 object-contain" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={crest(answer.club)} alt="" className="size-6 object-contain" />
            </span>
          )}
        </div>

        <div className="mt-4">
          {save.done ? (
            <div className="text-center">
              <p className={`text-[20px] font-bold ${save.won ? "text-emerald-400" : "text-text"}`}>{answer.ko}</p>
              <p className="text-[12.5px] text-muted">
                {answer.en} · {clubName.get(answer.club)}
              </p>
            </div>
          ) : (
            <PlayerPicker
              items={players}
              onPick={guess}
              autoFocus
              placeholder={`${count + 1}번째 추측 (총 ${MAX}번) — 한글·영문·초성`}
            />
          )}
        </div>
        {!save.done && (
          <button
            type="button"
            onClick={() => setHide((h) => !h)}
            className="mt-2 inline-flex items-center gap-1 text-[12px] text-faint hover:text-muted"
          >
            {hide ? <Eye className="size-3.5" /> : <EyeSlash className="size-3.5" />}
            {hide ? "사진 보기" : "사진 숨기기 (어렵게)"}
          </button>
        )}
      </div>

      {/* Newest first, each name over its six circles, the labels at the foot. */}
      <div ref={rows} className="mt-5 [perspective:600px]">
        {[...save.guesses].reverse().map((id, j) => {
          const i = count - 1 - j;
          const g = byId.get(id);
          if (!g) return null;
          const a = dir(g.age, answer.age);
          const s = dir(g.shirt, answer.shirt);
          const Arrow = ({ d }: { d: -1 | 0 | 1 }) =>
            d === 1 ? <ArrowUp className="size-3.5" weight="bold" /> : d === -1 ? <ArrowDown className="size-3.5" weight="bold" /> : null;
          const circle = (ok: boolean) => ({ background: ok ? HIT : MISS });
          const cls =
            "mx-auto flex aspect-square w-full max-w-[60px] items-center justify-center rounded-full text-[14px] font-bold text-white";
          return (
            <div key={id} data-row={i} className="mb-3">
              <p className="mb-1.5 truncate text-center text-[14px] font-bold text-text">{g.ko}</p>
              <div className="grid grid-cols-6 gap-1.5">
                <div data-tile className={cls} style={circle(g.nation === answer.nation)} title={data.nations[g.nation]?.ko}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={flag(g.nation)} alt={data.nations[g.nation]?.ko ?? g.nation} className="size-[62%] rounded-full object-cover" />
                </div>
                <div data-tile className={cls} style={circle(g.league === answer.league)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={leagueLogo(g.league)} alt="" className="size-[58%] object-contain" />
                </div>
                <div data-tile className={cls} style={circle(g.club === answer.club)} title={clubName.get(g.club)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={crest(g.club)} alt={clubName.get(g.club)} className="size-[58%] object-contain" />
                </div>
                <div data-tile className={cls} style={circle(g.pos === answer.pos)}>
                  {g.pos}
                </div>
                <div data-tile className={`${cls} tnum`} style={circle(a === 0 && g.age !== null)}>
                  {g.age ?? "–"}
                  <Arrow d={a} />
                </div>
                <div data-tile className={`${cls} tnum text-[13px]`} style={circle(s === 0 && g.shirt !== null)}>
                  #{g.shirt ?? "–"}
                  <Arrow d={s} />
                </div>
              </div>
            </div>
          );
        })}
        {count > 0 && (
          <div className="grid grid-cols-6 gap-1.5 text-center text-[11px] font-bold tracking-wide text-muted">
            <span>국적</span>
            <span>리그</span>
            <span>팀</span>
            <span>포지션</span>
            <span>나이</span>
            <span>등번호</span>
          </div>
        )}
        {count === 0 && (
          <p className="text-center text-[13px] leading-relaxed text-muted">
            5대 리그 현역 선수를 8번 안에 맞히세요. 추측할 때마다 국적·리그·팀·포지션·나이·등번호가
            맞으면 초록, 아니면 회색으로 나오고, 나이와 등번호는 화살표로 방향을 알려줍니다.
          </p>
        )}
      </div>

      {showStats && (
        <StatsModal
          record={record}
          buckets={["1", "2", "3", "4", "5", "6", "7", "8"]}
          highlight={save.won ? String(count) : undefined}
          nextLabel="다음 선수까지"
          shared={copied}
          onShare={async () => setCopied(await share(shareText()))}
          onClose={() => setShowStats(false)}
        />
      )}
    </div>
  );
}
