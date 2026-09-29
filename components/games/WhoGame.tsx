"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChartBar,
  Eye,
  EyeSlash,
  Info,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { loadWho, photoUrl, type WhoData } from "@/lib/games/data";
import { daily, dayNumber } from "@/lib/games/seed";
import { ArchiveNav, NextPuzzle } from "./ArchiveNav";
import { PlayerPicker, type PickerItem } from "./PlayerPicker";
import { useDaily } from "./useDaily";
import { StatsModal, recordResult, useRecord } from "./Stats";
import { Toast } from "./Toast";

/*
 * Numbers from the original's own code (who-are-ya App and stats modules):
 * eight guesses, six feedback columns revealed 350ms apart, the photograph
 * blurred by (12 - guesses) pixels, a compliment 2.1s after a win shown for
 * 1.5s, the stats 2.45s after a loss.
 */
const MAX = 8;
const STEP_MS = 350;
const COLUMNS = 6;
const TOAST_MS = 1500;
const LOST_STATS_MS = (COLUMNS + 1) * STEP_MS;
const blurFor = (guesses: number) => MAX + 4 - guesses;
/** The mystery player comes from the best-known squads, by market value. */
const POOL = 300;

const img = (path: string) => `https://images.fotmob.com/image_resources/logo/${path}.png`;
const flag = (code: string) => img(`teamlogo/${code.toLowerCase()}`);
const crest = (id: number) => img(`teamlogo/${id}`);
const leagueLogo = (id: number) => img(`leaguelogo/${id}`);

/** The quizzes: all five leagues together, or one of them - the original's "Play other leagues". */
const QUIZZES: { id: string; name: string; leagues: number[]; flagCode?: string }[] = [
  { id: "big5", name: "5대 리그", leagues: [47, 87, 55, 54, 53] },
  { id: "epl", name: "프리미어리그", leagues: [47], flagCode: "eng" },
  { id: "laliga", name: "라리가", leagues: [87], flagCode: "esp" },
  { id: "seriea", name: "세리에 A", leagues: [55], flagCode: "ita" },
  { id: "bundes", name: "분데스리가", leagues: [54], flagCode: "ger" },
  { id: "ligue1", name: "리그 1", leagues: [53], flagCode: "fra" },
];
const SEASON = "26/27";
const PRAISE = ["잘했어요!", "훌륭해요!", "대단해요!"];

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
  /** null until the reader picks: show the blurred photo or play without it */
  photo: boolean | null;
  /** a clue taken: which one */
  clue: "pos" | "nation" | "club" | null;
}
const FRESH: Save = { guesses: [], won: false, done: false, photo: null, clue: null };

/**
 * Who Are Ya?: guess the day's player in eight.
 *
 * Every guess is compared with the mystery player on nation, league, club,
 * position, age and shirt number: green when it matches, grey when it does
 * not, with arrows toward the answer's age and number. What has been found
 * out collects beside the photograph - the position, the flag, the crest - and
 * the photograph sharpens a pixel with every guess.
 */
export function WhoGame() {
  const [data, setData] = useState<WhoData | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    loadWho().then(setData, () => setError(true));
  }, []);

  const today = dayNumber();
  const [quizId, setQuizId] = useState("big5");
  const [game, setGame] = useState(today);
  // ?game=N and ?league=... open an archive game or another quiz, as links in the original do.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const g = Number(q.get("game"));
    if (g >= 1 && g <= today) setGame(g);
    const l = q.get("league");
    if (l && QUIZZES.some((x) => x.id === l)) setQuizId(l);
  }, [today]);
  const go = (g: number, quiz = quizId) => {
    setGame(g);
    setQuizId(quiz);
    const q = new URLSearchParams();
    if (quiz !== "big5") q.set("league", quiz);
    if (g !== today) q.set("game", String(g));
    window.history.replaceState(null, "", q.size ? `?${q}` : window.location.pathname);
  };

  const quiz = QUIZZES.find((q) => q.id === quizId)!;
  const multi = quiz.leagues.length > 1;
  const isToday = game === today;
  const statsKey = `who-${quiz.id}`;
  const [save, setSave] = useDaily<Save>(statsKey, game, FRESH);
  const [record, setRecord] = useRecord(statsKey);
  const [showStats, setShowStats] = useState(false);
  const [info, setInfo] = useState(false);
  const [praise, setPraise] = useState("");
  const [revealing, setRevealing] = useState(false);

  const closeInfo = () => setInfo(false);

  const leagueOf = useMemo(() => new Map(data?.clubs.map((c) => [c.id, c.league]) ?? []), [data]);
  const clubName = useMemo(() => new Map(data?.clubs.map((c) => [c.id, c.ko]) ?? []), [data]);

  const players = useMemo<WhoPlayer[]>(
    () =>
      (data?.players ?? [])
        .map(([id, ko, en, shirt, nation, pos, dob, club, value, wiki]) => ({
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
        }))
        .filter((p) => quiz.leagues.includes(p.league)),
    [data, clubName, leagueOf, quiz],
  );
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const answer = useMemo(() => {
    const pool = players
      .filter((p) => /[가-힣]/.test(p.ko))
      .sort((a, b) => b.value - a.value)
      .slice(0, multi ? POOL : Math.round(POOL / 3));
    return pool.length ? daily(pool, game, 7331 + quiz.leagues[0] * (multi ? 0 : 1)) : null;
  }, [players, game, multi, quiz]);

  const count = save.guesses.length;
  const playing = !save.done;

  const guess = (p: WhoPlayer) => {
    if (!answer || save.done || save.guesses.includes(p.id)) return;
    const right = p.id === answer.id;
    const guesses = [...save.guesses, p.id];
    const done = right || guesses.length >= MAX;
    setSave({ ...save, guesses, won: right, done });
    setRevealing(true);
    window.setTimeout(() => setRevealing(false), STEP_MS * COLUMNS);
    if (!done) return;
    // Only today's game counts toward the record, as in the original.
    if (isToday) setRecord(recordResult(statsKey, game, right, guesses.length));
    if (right) {
      window.setTimeout(() => {
        setPraise(PRAISE[Math.floor(Math.random() * PRAISE.length)]);
        window.setTimeout(() => {
          setPraise("");
          setShowStats(true);
        }, TOAST_MS);
      }, STEP_MS * COLUMNS);
    } else {
      window.setTimeout(() => setShowStats(true), LOST_STATS_MS);
    }
  };

  if (error) return <p className="py-16 text-center text-muted">게임 데이터를 불러오지 못했습니다.</p>;
  if (!data || !answer) return <p className="py-16 text-center text-muted">불러오는 중…</p>;

  const found = {
    pos: save.guesses.some((id) => byId.get(id)?.pos === answer.pos) || save.clue === "pos",
    nation: save.guesses.some((id) => byId.get(id)?.nation === answer.nation) || save.clue === "nation",
    club: save.guesses.some((id) => byId.get(id)?.club === answer.club) || save.clue === "club",
    league: save.guesses.some((id) => byId.get(id)?.league === answer.league),
  };
  const missing = (["pos", "nation", "club"] as const).filter((k) => !found[k]);


  const lost = save.done && !save.won;

  return (
    <div className="mx-auto max-w-[460px]">
      <Toast message={praise} variant="success" />
      <Toast message={lost && !revealing ? `정답은 ${answer.ko}였습니다` : ""} />

      <div className="mb-2 flex items-center justify-between text-muted">
        <button type="button" onClick={() => setInfo(true)} aria-label="하는 법" className="rounded-[6px] p-1 hover:text-text">
          <Info className="size-6" />
        </button>
        <button type="button" onClick={() => setShowStats(true)} aria-label="통계" className="rounded-[6px] p-1 hover:text-text">
          <ChartBar className="size-6" />
        </button>
      </div>

      {/* The card: white, as the original's, with the photograph in the middle
          and what has been found out collected to its left. */}
      <div className="relative min-h-[220px] rounded-lg border border-slate-200 bg-white px-3 pt-4 pb-3 text-sm text-gray-500 sm:p-4 md:min-h-[238px]">
        <div className="relative flex justify-center">
          <div className="relative mx-auto size-[150px] overflow-hidden rounded bg-white">
            {save.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl(answer.id)}
                alt={save.done ? answer.ko : "오늘의 선수"}
                width={150}
                height={150}
                draggable={false}
                className="pointer-events-none w-full transition-all duration-500"
                style={
                  playing
                    ? { filter: `blur(${blurFor(count)}px)` }
                    : { filter: "none", transitionDelay: `${STEP_MS * COLUMNS}ms` }
                }
              />
            ) : (
              <div className="flex h-full items-end justify-center text-[128px] leading-none font-bold text-gray-500">?</div>
            )}
          </div>

          <div className="absolute top-0 right-1/2 mr-[65px] flex w-[48px] flex-col items-end pt-1">
            <div
              className={`text-xl font-black text-black ${found.pos ? "" : "invisible"} ${save.clue === "pos" ? "animate-[kickoff-go_600ms_ease-out]" : ""}`}
            >
              {answer.pos}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={flag(answer.nation)}
              alt=""
              width={36}
              height={36}
              className={`mb-2 size-9 rounded-full object-cover ${found.nation ? "" : "invisible"}`}
            />
            {multi && !found.club && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={leagueLogo(answer.league)} alt="" className={`mb-2 h-12 w-auto ${found.league ? "" : "invisible"}`} />
            )}
            {found.club && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={crest(answer.club)} alt="" width={48} height={48} className="size-12 object-contain" />
            )}
          </div>
        </div>

        {playing && save.photo !== null && (
          <div className="mt-3 [&_input]:bg-white [&_input]:text-slate-900">
            <PlayerPicker
              items={players}
              onPick={guess}
              autoFocus
              placeholder={`${Math.min(count + 1, MAX)}번째 추측 (총 ${MAX}번)`}
            />
          </div>
        )}
        {save.done && (
          <p className="mt-3 text-center text-base font-black tracking-wider text-slate-900 uppercase">
            {answer.ko}
            <span className="ml-1.5 text-xs font-medium tracking-normal text-slate-500 normal-case">{answer.en}</span>
          </p>
        )}

        {playing && save.photo === null && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white py-2">
            <div className="m-auto w-full max-w-sm">
              <div className="px-5 sm:px-10">
                <p className="text-center text-base leading-5 font-black tracking-wider text-slate-500 uppercase sm:text-xl">
                  {quiz.name} {SEASON}
                </p>
                <div className="flex w-full items-end justify-center text-center text-[128px] leading-none font-bold text-gray-500">?</div>
              </div>
              <div className="mx-auto flex max-w-xs gap-3 px-3">
                <button
                  type="button"
                  onClick={() => setSave({ ...save, photo: false })}
                  className="mt-2 flex w-full items-center justify-center rounded-md bg-indigo-600 px-2 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
                >
                  사진 숨기기
                  <EyeSlash className="ml-1.5 size-4" weight="fill" />
                </button>
                <button
                  type="button"
                  onClick={() => setSave({ ...save, photo: true })}
                  className="mt-2 flex w-full items-center justify-center rounded-md bg-indigo-600 px-2 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
                >
                  사진 보기
                  <Eye className="ml-1.5 size-4" weight="fill" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ArchiveNav game={game} today={today} onGo={(g) => go(g)} />
      {save.done && <NextPuzzle storageKey={statsKey} game={game} today={today} onGo={(g) => go(g)} />}

      {count > 0 && (
        <div className="mt-2 w-full">
          {/* A clue, once three guesses have not turned one up. The original
              sells it for an advert; here it is free. */}
          {missing.length > 0 && count > 2 && playing && !save.clue && (
            <div className="mx-auto my-2 max-w-48">
              <button
                type="button"
                onClick={() => setSave({ ...save, clue: missing[Math.floor(Math.random() * missing.length)] })}
                className="w-full rounded-md bg-[#ceff27] py-2 text-sm font-bold text-slate-900 hover:bg-[#ceff27]/90"
              >
                힌트 보기
              </button>
            </div>
          )}

          {[...save.guesses]
            .map((id, i) => ({ id, i }))
            .reverse()
            .map(({ id, i }) => {
              const g = byId.get(id);
              if (!g) return null;
              const fresh = revealing && i === count - 1;
              return (
                <GuessRow key={id} g={g} answer={answer} multi={multi} fresh={fresh} club={clubName.get(g.club)} nation={data.nations[g.nation]?.ko} />
              );
            })}

          <Labels multi={multi} />
          <p className="text-center text-sm text-muted">
            데이터가 틀렸나요?{" "}
            <a className="ml-1 font-bold text-text" href="mailto:rjs2337@naver.com?subject=%ED%9B%84%20%EC%95%84%20%EC%9C%A0%20%EB%8D%B0%EC%9D%B4%ED%84%B0">
              알려 주세요
            </a>
          </p>
        </div>
      )}


      <section className="mt-6">
        <h3 className="text-sm font-bold tracking-wide text-text uppercase">다른 리그도 하기</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {QUIZZES.map((q) => (
            <button
              key={q.id}
              type="button"
              aria-pressed={q.id === quizId}
              onClick={() => go(today, q.id)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                q.id === quizId ? "border-[#ceff27] text-[#ceff27]" : "border-border text-muted hover:text-text"
              }`}
            >
              {q.flagCode && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={flag(q.flagCode)} alt="" className="size-4 rounded-full object-cover" />
              )}
              {q.name}
            </button>
          ))}
        </div>
      </section>

      {info && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/75 p-4" onClick={closeInfo}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="하는 법"
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-lg bg-gray-800 px-4 pt-5 pb-6 text-left text-white shadow-xl sm:px-6"
          >
            <button type="button" onClick={closeInfo} aria-label="닫기" className="absolute top-4 right-4 text-white/80 hover:text-white">
              <X className="size-6" />
            </button>
            <Rules quiz={quiz} modal />
          </div>
        </div>
      )}

      {showStats && (
        <StatsModal
          record={record}
          buckets={["1", "2", "3", "4", "5", "6", "7", "8"]}
          highlight={save.won && isToday ? String(count) : undefined}
          nextLabel="다음 선수까지"
          onClose={() => setShowStats(false)}
        />
      )}
    </div>
  );
}

/** One guess: the name, then the circles, each fading in 350ms after the last. */
function GuessRow({
  g,
  answer,
  multi,
  fresh,
  club,
  nation,
}: {
  g: WhoPlayer;
  answer: WhoPlayer;
  multi: boolean;
  fresh: boolean;
  club?: string;
  nation?: string;
}) {
  const a = dir(g.age, answer.age);
  const s = dir(g.shirt, answer.shirt);
  const arrow = (d: -1 | 0 | 1) =>
    d === 1 ? (
      <ArrowUp className="-mr-1.5 -ml-1 size-[18px] drop-shadow" weight="bold" />
    ) : d === -1 ? (
      <ArrowDown className="-mr-1.5 -ml-1 size-[18px] drop-shadow" weight="bold" />
    ) : null;
  const cells: { ok: boolean; body: React.ReactNode; title?: string }[] = [
    {
      ok: g.nation === answer.nation,
      title: nation,
      // eslint-disable-next-line @next/next/no-img-element
      body: <img src={flag(g.nation)} alt={nation ?? g.nation} className="w-[60%] rounded-full drop-shadow" />,
    },
    ...(multi
      ? [
          {
            ok: g.league === answer.league,
            // eslint-disable-next-line @next/next/no-img-element
            body: <img src={leagueLogo(g.league)} alt="" className="w-[60%] drop-shadow" />,
          },
        ]
      : []),
    {
      ok: g.club === answer.club,
      title: club,
      // eslint-disable-next-line @next/next/no-img-element
      body: <img src={crest(g.club)} alt={club ?? ""} className="w-[60%] drop-shadow" />,
    },
    { ok: g.pos === answer.pos, body: <span>{g.pos}</span> },
    {
      ok: a === 0 && g.age !== null,
      body: (
        <>
          <span className="tnum">{g.age ?? "–"}</span>
          {arrow(a)}
        </>
      ),
    },
    {
      ok: s === 0 && g.shirt !== null,
      body: (
        <>
          <span className="text-sm">#</span>
          <span className="tnum">{g.shirt ?? "–"}</span>
          {arrow(s)}
        </>
      ),
    },
  ];
  return (
    <div className="w-full py-2">
      <div
        className="w-full pb-2 text-center text-lg font-bold text-text uppercase"
        style={fresh ? { animation: "fade-in-down 500ms both" } : undefined}
      >
        {g.ko}
      </div>
      <div className="flex items-center justify-center">
        {cells.map((c, k) => (
          <div key={k} className="flex flex-[0_1_80px] justify-center">
            <div
              title={c.title}
              className={`mx-1 flex aspect-square w-full max-w-[60px] items-center justify-center overflow-hidden rounded-full text-lg font-bold text-white shadow-[0_2px_4px_rgba(0,0,0,0.25)] sm:text-xl ${
                c.ok ? "bg-green-500" : "bg-slate-400"
              }`}
              style={fresh ? { animation: `fade-in-down 500ms ${(k + 1) * STEP_MS}ms both` } : undefined}
            >
              {c.body}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Labels({ multi }: { multi: boolean }) {
  const labels = ["국적", ...(multi ? ["리그"] : []), "팀", "포지션", "나이", "등번호"];
  return (
    <div className="mb-4 flex w-full justify-center py-1 text-[13px] font-bold text-text uppercase">
      {labels.map((l) => (
        <div key={l} className="flex flex-[0_1_80px] justify-center">
          {l}
        </div>
      ))}
    </div>
  );
}

/** The rules as the original words them, with its worked example in Korean. */
function Rules({ quiz, modal = false }: { quiz: (typeof QUIZZES)[number]; modal?: boolean }) {
  const multi = quiz.leagues.length > 1;
  const leagues = multi ? "프리미어리그, 라리가, 세리에 A, 분데스리가, 리그 1" : quiz.name;
  /* eslint-disable @next/next/no-img-element */
  const Example = () => (
    <div className="my-1">
      <p>예시: 브루노 페르난드스</p>
      <div className="mt-1 flex max-w-[300px]">
        {[
          { ok: true, body: <img src={flag("por")} alt="" className="w-[60%] rounded-full" /> },
          ...(multi ? [{ ok: false, body: <img src={leagueLogo(47)} alt="" className="w-[60%]" /> }] : []),
          { ok: false, body: <img src={crest(10260)} alt="" className="w-[60%]" /> },
          { ok: true, body: <span>MF</span> },
          { ok: false, body: <span className="flex items-center">30<ArrowDown className="size-3.5" weight="bold" /></span> },
          { ok: false, body: <span className="flex items-center">#8<ArrowUp className="size-3.5" weight="bold" /></span> },
        ].map((c, k) => (
          <div key={k} className="flex flex-[0_1_48px] flex-col items-center">
            <div
              className={`mx-0.5 flex aspect-square w-full max-w-[44px] items-center justify-center rounded-full text-sm font-bold text-white ${
                c.ok ? "bg-green-500" : "bg-slate-400"
              }`}
            >
              {c.body}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex max-w-[300px] text-[11px] font-bold">
        {["국적", ...(multi ? ["리그"] : []), "팀", "포지션", "나이", "등번호"].map((l) => (
          <span key={l} className="flex-[0_1_48px] text-center">
            {l}
          </span>
        ))}
      </div>
      <p className="mt-1">
        …는 정답 선수가 포르투갈 사람이고{multi ? ", 프리미어리그에서 뛰지 않으며" : ""} 맨유 선수가 아니라는 뜻입니다.
        하지만 미드필더이고, 서른 살보다 어리며, 등번호는 8번보다 큽니다.
      </p>
    </div>
  );
  /* eslint-enable @next/next/no-img-element */
  return (
    <div className={modal ? "text-sm" : "mt-6 text-sm text-muted"}>
      <h2 className={`mb-2 text-base ${modal ? "text-center font-medium" : "text-text"}`}>
        <b>Who Are Ya?</b> 매일 하는 축구 선수 맞히기
      </h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>{leagues}에서 뛰는 선수를 8번 안에 맞히세요.</li>
        <li>‘사진 보기’를 고르면 흐린 사진을 보고 시작하고, ‘사진 숨기기’를 고르면 사진 없이 아무나 먼저 넣어 봅니다. 사진은 추측할수록 선명해집니다.</li>
        <li>추측할 때마다 정답과 얼마나 가까운지 여러 항목으로 알려 줍니다.</li>
        <li>
          <Example />
        </li>
        <li>
          매일 자정(한국 시간)에 새 {quiz.name} {SEASON} 선수가 나옵니다.
        </li>
        <li>하루를 놓쳤다면 ‘이전’으로 지난 게임을 할 수 있습니다. 다만 지난 게임은 통계에 들어가지 않습니다.</li>
      </ul>
    </div>
  );
}
