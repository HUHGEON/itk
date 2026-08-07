"use client";

import { useState, useTransition } from "react";
import type { Team } from "@/lib/types";
import { ALL_TIERS } from "@/lib/types";
import { tierLabel } from "@/lib/format";
import { addSubscription, removeSubscription, type Subscription } from "@/app/actions";
import { TeamCrest } from "./TeamCrest";

/**
 * Register Discord destinations from the UI.
 *
 * Previously the webhook and its team list lived in environment variables,
 * which meant one destination for the whole deployment and a redeploy to
 * change it. Rows in the database allow several team/tier combinations, each
 * tracked separately so one channel receiving a story doesn't silence it for
 * the others.
 */
export function DiscordPanel({
  teams,
  subscriptions,
}: {
  teams: Team[];
  subscriptions: Subscription[];
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [maxTier, setMaxTier] = useState(1.5);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const teamName = (slug: string) => teams.find((t) => t.slug === slug)?.ko ?? slug;

  const submit = () => {
    setError("");
    startTransition(async () => {
      const res = await addSubscription({ url, teams: picked, maxTier, label });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setUrl("");
      setLabel("");
      setPicked([]);
      setOpen(false);
    });
  };

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-bold">디스코드 알림</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-[12px] text-accent hover:underline"
        >
          {open ? "닫기" : "+ 추가"}
        </button>
      </div>

      {subscriptions.length === 0 && !open && (
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          웹훅을 등록하면 브라우저를 닫아도 알림이 옵니다.
        </p>
      )}

      {subscriptions.length > 0 && (
        <ul className="mt-3 space-y-2">
          {subscriptions.map((s) => (
            <li key={s.id} className="rounded-lg border border-border bg-surface-2 p-2">
              <div className="flex items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">
                  {s.label || "디스코드"}
                  <span className="ml-1 font-normal text-muted">{s.hint}</span>
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await removeSubscription(s.id);
                    })
                  }
                  className="shrink-0 text-[11px] text-muted hover:text-red-400 disabled:opacity-50"
                >
                  삭제
                </button>
              </div>
              <p className="mt-1 text-[11px] text-muted">
                {tierLabel(s.maxTier)}까지 ·{" "}
                {s.teams.map(teamName).join(", ") || "팀 없음"}
              </p>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="mt-3 space-y-2.5 border-t border-border pt-3">
          <div>
            <label className="text-[11px] font-semibold text-muted">웹훅 주소</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/…"
              className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-[12px] outline-none placeholder:text-muted focus:border-accent"
            />
            <p className="mt-1 text-[10px] leading-snug text-muted">
              디스코드 채널 → 설정 → 연동 → 웹후크에서 만들 수 있습니다.
            </p>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted">이름 (선택)</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="예: 첼시방"
              className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-[12px] outline-none placeholder:text-muted focus:border-accent"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted">
              팀 {picked.length > 0 && `(${picked.length})`}
            </label>
            <div className="mt-1 flex max-h-40 flex-wrap gap-1 overflow-y-auto">
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
                    className={`flex items-center gap-1 rounded-full border py-0.5 pr-2 pl-1 text-[11px] ${
                      on
                        ? "border-accent bg-accent/15 font-semibold text-accent"
                        : "border-border text-muted hover:text-text"
                    }`}
                  >
                    <TeamCrest team={t} size={13} />
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
                  className={`flex-1 rounded-md border py-1 text-[11px] font-semibold ${
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
            className="w-full rounded-lg bg-accent px-3 py-2 text-[12px] font-semibold text-black disabled:opacity-40"
          >
            {pending ? "등록 중…" : "등록"}
          </button>
        </div>
      )}
    </section>
  );
}
