"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import type { League, Team } from "@/lib/types";
import { ALL_TIERS, LEAGUE_LABEL } from "@/lib/types";
import { tierLabel } from "@/lib/format";
import { ownerKey } from "@/lib/owner-key";
import {
  addSubscription,
  claimSubscriptions,
  getSubscription,
  listSubscriptions,
  removeSubscription,
  updateSubscription,
  type Subscription,
} from "@/app/actions";
import { TeamCrest } from "./TeamCrest";
import { RailSection } from "./RailSection";
import { Modal } from "./Modal";

/**
 * Discord destinations, owned by this browser.
 *
 * The list loads client-side rather than during the server render because it is
 * keyed on a token in localStorage — the site is public, and a server-rendered
 * list showed every visitor's webhooks to everyone.
 */
const LEAGUE_ORDER: League[] = [
  "EPL",
  "LaLiga",
  "SerieA",
  "Ligue1",
  "Bundesliga",
  "Eredivisie",
];

/**
 * Shows enough of a webhook to recognise it, not enough to post with.
 * The id identifies the channel; the token after it is the credential, so only
 * its ends survive.
 */
function maskWebhook(url: string): string {
  const m = url.match(/^(https:\/\/[^/]+\/api\/webhooks\/)(\d+)\/(.+)$/);
  if (!m) return "…";
  const [, prefix, id, token] = m;
  const shortId = id.length > 6 ? `${id.slice(0, 4)}…${id.slice(-2)}` : id;
  const shortToken =
    token.length > 10
      ? `${token.slice(0, 4)}${"•".repeat(12)}${token.slice(-4)}`
      : "•".repeat(12);
  return `${prefix}${shortId}/${shortToken}`;
}

export function DiscordPanel({ teams }: { teams: Team[] }) {
  const [subs, setSubs] = useState<Subscription[] | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [maxTier, setMaxTier] = useState(1.5);
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");

  // Edit: null while adding, the id of the row being changed otherwise.
  const [editing, setEditing] = useState<string | null>(null);
  const [hasPass, setHasPass] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [loading, setLoading] = useState(false);
  // The destination's own passphrase. Held only for the life of the modal —
  // the browser token says which rows are yours, this says it is really you.
  const [auth, setAuth] = useState("");
  const [locked, setLocked] = useState(false);

  // Delete needs the same proof, and its own small prompt.
  const [removing, setRemoving] = useState<Subscription | null>(null);
  const [removeAuth, setRemoveAuth] = useState("");
  const [removeErr, setRemoveErr] = useState("");

  // Recovery: pulls destinations registered elsewhere into this browser.
  const [listOpen, setListOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimPass, setClaimPass] = useState("");
  const [claimMsg, setClaimMsg] = useState("");

  const refresh = useCallback(() => {
    const key = ownerKey();
    if (!key) {
      setSubs([]);
      return;
    }
    void listSubscriptions(key)
      .then(setSubs)
      .catch(() => setSubs([]));
  }, []);

  useEffect(refresh, [refresh]);

  const teamName = (slug: string) =>
    teams.find((t) => t.slug === slug)?.ko ?? slug;

  // 17 clubs in one wrap is a wall; grouping by league makes the picker
  // scannable and gives each league a select-all.
  const byLeague = useMemo(
    () =>
      LEAGUE_ORDER.map((league) => ({
        league,
        members: teams.filter((t) => t.league === league),
      })).filter((g) => g.members.length > 0),
    [teams],
  );

  const reset = () => {
    setUrl("");
    setLabel("");
    setPicked([]);
    setMaxTier(1.5);
    setPass("");
    setError("");
    setEditing(null);
    setHasPass(false);
    setReveal(false);
    setAuth("");
    setLocked(false);
  };

  const openAdd = () => {
    reset();
    setOpen(true);
  };

  const load = (id: string, pass: string) => {
    setLoading(true);
    setError("");
    return getSubscription(ownerKey(), id, pass)
      .then((d) => {
        if (!d) {
          setError("알림을 찾을 수 없습니다");
          return false;
        }
        if ("error" in d) {
          setError(d.error);
          return false;
        }
        setUrl(d.webhookUrl);
        setLabel(d.label);
        setPicked(d.teams);
        setMaxTier(d.maxTier);
        setHasPass(d.hasPass);
        return true;
      })
      .catch(() => {
        setError("불러오지 못했습니다");
        return false;
      })
      .finally(() => setLoading(false));
  };

  const openEdit = (sub: Subscription) => {
    reset();
    setListOpen(false);
    setEditing(sub.id);
    setOpen(true);
    // A protected destination stays sealed until the passphrase is entered,
    // even here — the browser token alone was letting anyone with the profile
    // read the webhook and repoint the channel.
    if (sub.hasPass) {
      setLocked(true);
      setHasPass(true);
      return;
    }
    void load(sub.id, "");
  };

  const unlock = () => {
    if (!editing) return;
    startTransition(async () => {
      if (await load(editing, auth)) setLocked(false);
    });
  };

  const submit = () => {
    const key = ownerKey();
    if (!key) {
      setError(
        "브라우저 저장소를 쓸 수 없어 등록할 수 없습니다 (시크릿 모드?)",
      );
      return;
    }
    setError("");
    startTransition(async () => {
      const res = editing
        ? await updateSubscription({
            owner: key,
            id: editing,
            url,
            teams: picked,
            maxTier,
            label,
            passphrase: pass,
            auth,
          })
        : await addSubscription({
            owner: key,
            url,
            teams: picked,
            maxTier,
            label,
            passphrase: pass,
          });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const wasEditing = Boolean(editing);
      reset();
      setOpen(false);
      refresh();
      // Editing was reached from the list, so hand it back rather than
      // dropping the reader on the sidebar.
      if (wasEditing) setListOpen(true);
    });
  };

  const claim = () => {
    const key = ownerKey();
    if (!key) {
      setClaimMsg("브라우저 저장소를 쓸 수 없습니다 (시크릿 모드?)");
      return;
    }
    setClaimMsg("");
    startTransition(async () => {
      const res = await claimSubscriptions(key, claimPass);
      if (!res.ok) {
        setClaimMsg(res.error);
        return;
      }
      if (res.count === 0) {
        setClaimMsg("일치하는 알림이 없습니다");
        return;
      }
      setClaimPass("");
      setClaimOpen(false);
      refresh();
    });
  };

  const remove = (sub: Subscription) => {
    if (sub.hasPass) {
      setRemoveAuth("");
      setRemoveErr("");
      setListOpen(false);
      setRemoving(sub);
      return;
    }
    startTransition(async () => {
      await removeSubscription(ownerKey(), sub.id);
      refresh();
    });
  };

  const confirmRemove = () => {
    if (!removing) return;
    startTransition(async () => {
      const res = await removeSubscription(ownerKey(), removing.id, removeAuth);
      if (!res.ok) {
        setRemoveErr(res.error);
        return;
      }
      setRemoving(null);
      refresh();
      if ((subs?.length ?? 0) > 1) setListOpen(true);
    });
  };

  return (
    <RailSection
      title="디스코드 알림"
      action={
        <button
          type="button"
          onClick={openAdd}
          className="shrink-0 text-[12px] font-semibold text-accent hover:underline"
        >
          + 추가
        </button>
      }
      overlay={
        <>
          <Modal
            open={listOpen}
            onClose={() => setListOpen(false)}
            title="내 디스코드 알림"
          >
            {subs && subs.length > 0 ? (
              <ul className="space-y-2">
                {subs.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-[5px] border border-border bg-surface-2 p-2.5"
                  >
                    <div className="flex items-center gap-1.5">
                      {/* No part of the webhook here — it lives on the edit screen. */}
                      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">
                        {s.label || "디스코드"}
                        {s.hasPass && (
                          <span
                            className="ml-1 font-normal text-muted"
                            title="비밀번호 설정됨"
                          >
                            🔒
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => openEdit(s)}
                        className="shrink-0 text-[11px] text-muted hover:text-text disabled:opacity-50"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => remove(s)}
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
            ) : (
              <p className="text-[11px] text-muted">등록된 알림이 없습니다.</p>
            )}
          </Modal>

          <Modal
            open={open}
            onClose={() => {
              setOpen(false);
              setError("");
            }}
            title={editing ? "디스코드 알림 수정" : "디스코드 알림 추가"}
          >
            {locked ? (
              <div className="space-y-3">
                <p className="text-[11px] leading-relaxed text-muted">
                  이 알림에는 비밀번호가 설정돼 있습니다. 웹훅 주소를 보거나
                  내용을 바꾸려면 비밀번호를 입력하세요.
                </p>
                <input
                  type="password"
                  value={auth}
                  onChange={(e) => setAuth(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && auth) unlock();
                  }}
                  placeholder="비밀번호"
                  autoComplete="current-password"
                  autoFocus
                  className="w-full rounded-[5px] border border-border bg-surface-2 px-2.5 py-2 text-[12px] outline-none placeholder:text-faint focus:border-border-strong"
                />
                {error && <p className="text-[11px] text-red-400">{error}</p>}
                <button
                  type="button"
                  onClick={unlock}
                  disabled={pending || loading || !auth}
                  style={{ background: "var(--ribbon)" }}
                  className="w-full rounded-[5px] px-3 py-2.5 text-[12px] font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {loading ? "확인 중…" : "확인"}
                </button>
                <p className="text-[10px] leading-snug text-muted">
                  잊어버렸다면 이 알림은 삭제 후 다시 등록해야 합니다.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="flex items-baseline justify-between">
                    <label className="text-[11px] font-semibold text-muted">
                      웹훅 주소
                    </label>
                    {editing && (
                      <button
                        type="button"
                        onClick={() => setReveal((v) => !v)}
                        className="text-[10px] text-muted hover:text-text"
                      >
                        {reveal ? "가리기" : "전체 보기"}
                      </button>
                    )}
                  </div>

                  {/* On the edit screen the stored webhook is masked until asked for:
                  the URL is a credential, and it only needs to be recognisable to
                  confirm which channel this is. */}
                  {editing && !reveal ? (
                    <button
                      type="button"
                      onClick={() => setReveal(true)}
                      title="누르면 전체 주소가 보입니다"
                      className="mt-1 w-full truncate rounded-[5px] border border-border bg-surface-2 px-2.5 py-2 text-left font-mono text-[11px] text-muted"
                    >
                      {loading ? "불러오는 중…" : maskWebhook(url)}
                    </button>
                  ) : (
                    <input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://discord.com/api/webhooks/…"
                      autoFocus={!editing}
                      className="mt-1 w-full rounded-[5px] border border-border bg-surface-2 px-2.5 py-2 text-[12px] outline-none placeholder:text-faint focus:border-border-strong"
                    />
                  )}
                  <p className="mt-1 text-[10px] leading-snug text-muted">
                    디스코드 채널 → 편집 → 연동 → 웹후크 → 새 웹후크 → URL 복사
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted">
                    이름 (선택)
                  </label>
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="예: 첼시방"
                    className="mt-1 w-full rounded-[5px] border border-border bg-surface-2 px-2.5 py-2 text-[12px] outline-none placeholder:text-faint focus:border-border-strong"
                  />
                </div>

                <div>
                  <div className="flex items-baseline justify-between">
                    <label className="text-[11px] font-semibold text-muted">
                      팀
                    </label>
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
                  <div className="mt-1 max-h-56 space-y-2.5 overflow-y-auto rounded-[5px] border border-border bg-surface-2 p-2">
                    {byLeague.map(({ league, members }) => {
                      const slugs = members.map((m) => m.slug);
                      const allOn = slugs.every((sl) => picked.includes(sl));
                      return (
                        <div key={league}>
                          <div className="flex items-baseline justify-between px-0.5 pb-1">
                            <span className="text-[10px] font-semibold tracking-wide text-muted">
                              {LEAGUE_LABEL[league]}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setPicked((p) =>
                                  allOn
                                    ? p.filter((sl) => !slugs.includes(sl))
                                    : Array.from(new Set([...p, ...slugs])),
                                )
                              }
                              className="text-[10px] text-muted hover:text-text"
                            >
                              {allOn ? "전체 해제" : "전체 선택"}
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {members.map((t) => {
                              const on = picked.includes(t.slug);
                              return (
                                <button
                                  key={t.slug}
                                  type="button"
                                  onClick={() =>
                                    setPicked((p) =>
                                      p.includes(t.slug)
                                        ? p.filter((x) => x !== t.slug)
                                        : [...p, t.slug],
                                    )
                                  }
                                  aria-pressed={on}
                                  className={`flex items-center gap-1 rounded-[4px] border py-1 pr-2 pl-1 text-[11px] ${
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
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted">
                    최소 신뢰도
                  </label>
                  <div className="mt-1 flex gap-1">
                    {ALL_TIERS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setMaxTier(t)}
                        className={`flex-1 rounded-[4px] border py-1.5 text-[11px] font-medium ${
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

                <div>
                  <label className="text-[11px] font-semibold text-muted">
                    비밀번호 (선택)
                  </label>
                  <input
                    type="password"
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    placeholder={
                      editing && hasPass ? "변경하려면 새 비밀번호" : "4자 이상"
                    }
                    autoComplete="new-password"
                    className="mt-1 w-full rounded-[5px] border border-border bg-surface-2 px-2.5 py-2 text-[12px] outline-none placeholder:text-faint focus:border-border-strong"
                  />
                  <p className="mt-1 text-[10px] leading-snug text-muted">
                    {editing
                      ? hasPass
                        ? "비밀번호가 설정돼 있습니다. 비워두면 그대로 둡니다."
                        : "설정하면 다른 기기에서도 이 알림을 불러올 수 있습니다."
                      : "설정하면 다른 기기·브라우저에서도 이 알림을 불러와 수정·삭제할 수 있습니다. 비워두면 이 브라우저에서만 관리됩니다."}
                  </p>
                </div>

                {error && <p className="text-[11px] text-red-400">{error}</p>}

                <button
                  type="button"
                  onClick={submit}
                  disabled={pending || loading || !url || picked.length === 0}
                  style={{ background: "var(--ribbon)" }}
                  className="w-full rounded-[5px] px-3 py-2.5 text-[12px] font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {pending ? "저장 중…" : editing ? "수정" : "등록"}
                </button>

                <p className="text-[10px] leading-snug text-muted">
                  {editing
                    ? "이미 보낸 기사는 다시 보내지 않습니다."
                    : "등록 시점 이후의 새 기사만 전송됩니다."}
                </p>
              </div>
            )}
          </Modal>

          <Modal
            open={removing !== null}
            onClose={() => setRemoving(null)}
            title="알림 삭제"
          >
            <div className="space-y-3">
              <p className="text-[11px] leading-relaxed text-muted">
                <b>{removing?.label || "디스코드"}</b> 알림을 삭제합니다.
                비밀번호가 설정돼 있어 확인이 필요합니다.
              </p>
              <input
                type="password"
                value={removeAuth}
                onChange={(e) => setRemoveAuth(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && removeAuth) confirmRemove();
                }}
                placeholder="비밀번호"
                autoComplete="current-password"
                autoFocus
                className="w-full rounded-[5px] border border-border bg-surface-2 px-2.5 py-2 text-[12px] outline-none placeholder:text-faint focus:border-border-strong"
              />
              {removeErr && (
                <p className="text-[11px] text-red-400">{removeErr}</p>
              )}
              <button
                type="button"
                onClick={confirmRemove}
                disabled={pending || !removeAuth}
                className="w-full rounded-[5px] bg-red-400 px-3 py-2.5 text-[12px] font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {pending ? "삭제 중…" : "삭제"}
              </button>
            </div>
          </Modal>

          <Modal
            open={claimOpen}
            onClose={() => {
              setClaimOpen(false);
              setClaimMsg("");
            }}
            title="알림 불러오기"
          >
            <div className="space-y-3">
              <p className="text-[11px] leading-relaxed text-muted">
                등록할 때 설정한 비밀번호를 넣으면 그 알림을 이 브라우저로
                가져옵니다. 비밀번호 없이 등록한 알림은 불러올 수 없습니다.
              </p>
              <input
                type="password"
                value={claimPass}
                onChange={(e) => setClaimPass(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && claimPass) claim();
                }}
                placeholder="비밀번호"
                autoComplete="current-password"
                autoFocus
                className="w-full rounded-[5px] border border-border bg-surface-2 px-2.5 py-2 text-[12px] outline-none placeholder:text-faint focus:border-border-strong"
              />
              {claimMsg && (
                <p className="text-[11px] text-red-400">{claimMsg}</p>
              )}
              <button
                type="button"
                onClick={claim}
                disabled={pending || claimPass.length < 4}
                style={{ background: "var(--ribbon)" }}
                className="w-full rounded-[5px] px-3 py-2.5 text-[12px] font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {pending ? "확인 중…" : "불러오기"}
              </button>
            </div>
          </Modal>
        </>
      }
    >
      {/* The list is a modal rather than a panel section. It is per-browser, so
          it never shows anyone else's destinations, but registering several
          here pushed the rest of the sidebar off the screen. */}
      <p className="mt-1.5 text-[11px] leading-snug text-muted">
        {/* The list is fetched client-side from a localStorage token, so the
            first paint has nothing to count. Showing "불러오는 중…" put a
            loading state at the top of the sidebar on every page load; the
            panel's own description holds the space until the count arrives. */}
        {subs === null || subs.length === 0
          ? "웹훅을 등록하면 브라우저를 닫아도 알림이 옵니다."
          : `이 브라우저에 등록된 알림 ${subs.length}개`}
      </p>

      <div className="mt-2 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setListOpen(true)}
          disabled={!subs || subs.length === 0}
          className="flex-1 rounded-[5px] border border-border bg-surface-2 px-3 py-1.5 text-[12px] font-medium text-text transition-colors hover:border-border-strong disabled:opacity-40"
        >
          목록 보기
        </button>
        <button
          type="button"
          onClick={() => setClaimOpen(true)}
          className="rounded-[5px] border border-border px-3 py-1.5 text-[12px] text-muted transition-colors hover:border-border-strong hover:text-text"
        >
          불러오기
        </button>
      </div>

      <p className="mt-1.5 text-[10px] leading-snug text-faint">
        이 브라우저에만 저장됩니다.
      </p>
    </RailSection>
  );
}
