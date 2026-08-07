"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import type { Team } from "@/lib/types";
import { ALL_TIERS } from "@/lib/types";
import { tierLabel } from "@/lib/format";
import { ownerKey } from "@/lib/owner-key";
import {
  addSubscription,
  listSubscriptions,
  removeSubscription,
  type Subscription,
} from "@/app/actions";
import { TeamCrest } from "./TeamCrest";
import { Modal } from "./Modal";

/**
 * Discord destinations, owned by this browser.
 *
 * The list loads client-side rather than during the server render because it is
 * keyed on a token in localStorage — the site is public, and a server-rendered
 * list showed every visitor's webhooks to everyone.
 */
export function DiscordPanel({ teams }: { teams: Team[] }) {
  const [subs, setSubs] = useState<Subscription[] | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [maxTier, setMaxTier] = useState(1.5);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    const key = ownerKey();
    if (!key) {
      setSubs([]);
      return;
    }
    void listSubscriptions(key).then(setSubs).catch(() => setSubs([]));
  }, []);

  useEffect(refresh, [refresh]);

  const teamName = (slug: string) => teams.find((t) => t.slug === slug)?.ko ?? slug;

  const reset = () => {
    setUrl("");
    setLabel("");
    setPicked([]);
    setMaxTier(1.5);
    setError("");
  };

  const submit = () => {
    const key = ownerKey();
    if (!key) {
      setError("브라우저 저장소를 쓸 수 없어 등록할 수 없습니다 (시크릿 모드?)");
      return;
    }
    setError("");
    startTransition(async () => {
      const res = await addSubscription({ owner: key, url, teams: picked, maxTier, label });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      reset();
      setOpen(false);
      refresh();
    });
  };

  const remove = (id: string) =>
    startTransition(async () => {
      await removeSubscription(ownerKey(), id);
      refresh();
    });

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-bold">디스코드 알림</h2>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[12px] font-semibold text-accent hover:underline"
        >
          + 추가
        </button>
      </div>

      {subs === null ? (
        <p className="mt-2 text-[11px] text-muted">불러오는 중…</p>
      ) : subs.length === 0 ? (
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          웹훅을 등록하면 브라우저를 닫아도 알림이 옵니다.
          <br />
          <span className="text-[10px]">이 목록은 이 브라우저에서만 보입니다.</span>
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {subs.map((s) => (
            <li key={s.id} className="rounded-lg border border-border bg-surface-2 p-2">
              <div className="flex items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">
                  {s.label || "디스코드"}
                  <span className="ml-1 font-normal text-muted">{s.hint}</span>
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => remove(s.id)}
                  className="shrink-0 text-[11px] text-muted hover:text-red-400 disabled:opacity-50"
                >
                  삭제
                </button>
              </div>
              <p className="mt-1 text-[11px] text-muted">
                {tierLabel(s.maxTier)}까지 · {s.teams.map(teamName).join(", ") || "팀 없음"}
              </p>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setError("");
        }}
        title="디스코드 알림 추가"
      >
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-muted">웹훅 주소</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/…"
              autoFocus
              className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-[12px] outline-none placeholder:text-muted focus:border-accent"
            />
            <p className="mt-1 text-[10px] leading-snug text-muted">
              디스코드 채널 → 편집 → 연동 → 웹후크 → 새 웹후크 → URL 복사
            </p>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted">이름 (선택)</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="예: 첼시방"
              className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-[12px] outline-none placeholder:text-muted focus:border-accent"
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label className="text-[11px] font-semibold text-muted">팀</label>
              {picked.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPicked([])}
                  className="text-[10px] text-muted hover:text-text"
                >
                  {picked.length}개 선택 · 해제
                </button>
              )}
            </div>
            <div className="mt-1 flex max-h-44 flex-wrap gap-1 overflow-y-auto rounded-lg border border-border bg-surface-2 p-2">
              {teams.map((t) => {
                const on = picked.includes(t.slug);
                return (
                  <button
                    key={t.slug}
                    type="button"
                    onClick={() =>
                      setPicked((p) =>
                        p.includes(t.slug) ? p.filter((x) => x !== t.slug) : [...p, t.slug],
                      )
                    }
                    className={`flex items-center gap-1 rounded-full border py-1 pr-2 pl-1 text-[11px] ${
                      on
                        ? "border-accent bg-accent/15 font-semibold text-accent"
                        : "border-border text-muted hover:text-text"
                    }`}
                  >
                    <TeamCrest team={t} size={14} />
                    {t.ko}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted">최소 신뢰도</label>
            <div className="mt-1 flex gap-1">
              {ALL_TIERS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setMaxTier(t)}
                  className={`flex-1 rounded-md border py-1.5 text-[11px] font-semibold ${
                    maxTier === t
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-border text-muted hover:text-text"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-muted">
              {tierLabel(maxTier)}까지 · 구단 공식 발표는 항상 포함
            </p>
          </div>

          {error && <p className="text-[11px] text-red-400">{error}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={pending || !url || picked.length === 0}
            className="w-full rounded-lg bg-accent px-3 py-2.5 text-[12px] font-bold text-black disabled:opacity-40"
          >
            {pending ? "등록 중…" : "등록"}
          </button>

          <p className="text-[10px] leading-snug text-muted">
            등록 시점 이후의 새 기사만 전송됩니다. 이 목록은 이 브라우저에서만 보이고,
            저장소를 지우면 목록은 사라지지만 알림은 계속 옵니다.
          </p>
        </div>
      </Modal>
    </section>
  );
}
