"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Team } from "@/lib/types";
import { ALL_TIERS, DB_SCHEMA } from "@/lib/types";
import { tierLabel } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { TeamCrest } from "./TeamCrest";

const STORAGE_KEY = "itk:alerts";
/** Safety net only — Realtime is the primary trigger. */
const FALLBACK_POLL_MS = 300_000;
/** A collector run inserts hundreds of rows; wait for the burst to settle. */
const BURST_DEBOUNCE_MS = 3_000;

interface AlertPrefs {
  teams: string[];
  /** notify only for articles at this tier or better (lower number = better) */
  maxTier: number;
  lastSeen: number;
}

const DEFAULTS: AlertPrefs = { teams: [], maxTier: 1, lastSeen: 0 };

function readPrefs(): AlertPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AlertPrefs>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function AlertPanel({ teams }: { teams: Team[] }) {
  const [prefs, setPrefs] = useState<AlertPrefs>(DEFAULTS);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [open, setOpen] = useState(false);
  const [lastCheck, setLastCheck] = useState<number | null>(null);
  const [live, setLive] = useState(false);
  const prefsRef = useRef(prefs);

  // Hydrate from localStorage after mount so SSR markup stays stable.
  useEffect(() => {
    const loaded = readPrefs();
    setPrefs(loaded);
    prefsRef.current = loaded;
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
  }, []);

  const save = useCallback((next: AlertPrefs) => {
    prefsRef.current = next;
    setPrefs(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private browsing — alerts just won't persist across reloads.
    }
  }, []);

  const check = useCallback(async () => {
    const p = prefsRef.current;
    if (p.teams.length === 0) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

    const tiers = ALL_TIERS.filter((t) => t <= p.maxTier);
    const params = new URLSearchParams({
      team: p.teams.join(","),
      tier: tiers.join(","),
      limit: "20",
    });
    // First run establishes a baseline instead of firing 20 notifications.
    if (p.lastSeen) params.set("after", String(p.lastSeen));

    try {
      const res = await fetch(`/api/feed?${params}`, { cache: "no-store" });
      if (!res.ok) return;
      const { rows } = (await res.json()) as {
        rows: { id: string; title: string; titleKo: string | null; journalistKo: string | null; tier: number | null; url: string }[];
      };

      if (p.lastSeen) {
        for (const row of rows.slice(0, 3)) {
          const n = new Notification(row.titleKo ?? row.title, {
            body: `${tierLabel(row.tier)}${row.journalistKo ? ` · ${row.journalistKo}` : ""}`,
            tag: row.id,
            icon: "/favicon.ico",
          });
          n.onclick = () => window.open(row.url, "_blank", "noopener");
        }
      }

      save({ ...p, lastSeen: Date.now() });
      setLastCheck(Date.now());
    } catch {
      // Offline or the collector is mid-write; the next tick retries.
    }
  }, [save]);

  useEffect(() => {
    void check();

    // Realtime push: the collector inserts a burst of rows, so coalesce them
    // into one check instead of firing per row.
    let burst: number | undefined;
    const supabase = supabaseBrowser();
    const channel = supabase
      ?.channel("itk-articles")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: DB_SCHEMA, table: "articles" },
        () => {
          window.clearTimeout(burst);
          burst = window.setTimeout(check, BURST_DEBOUNCE_MS);
        },
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    // Runs regardless — covers a dropped socket or a missing anon key.
    const poll = window.setInterval(check, FALLBACK_POLL_MS);

    return () => {
      window.clearTimeout(burst);
      window.clearInterval(poll);
      if (channel) void supabase?.removeChannel(channel);
    };
  }, [check]);

  const toggleTeam = (slug: string) => {
    const next = prefs.teams.includes(slug)
      ? prefs.teams.filter((s) => s !== slug)
      : [...prefs.teams, slug];
    save({ ...prefs, teams: next });
  };

  const requestPermission = async () => {
    if (typeof Notification === "undefined") return;
    setPermission(await Notification.requestPermission());
  };

  const selected = teams.filter((t) => prefs.teams.includes(t.slug));

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-[13px] font-bold">
          팀 알림
          <span
            title={live ? "실시간 연결됨" : "폴링 모드"}
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              live ? "bg-accent" : "bg-muted"
            }`}
          />
        </h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-[12px] text-accent hover:underline"
        >
          {open ? "닫기" : "팀 선택"}
        </button>
      </div>

      {permission !== "granted" && (
        <button
          type="button"
          onClick={requestPermission}
          className="mt-3 w-full rounded-lg bg-accent px-3 py-2 text-[12px] font-semibold text-black"
        >
          {permission === "denied" ? "브라우저 설정에서 알림 허용 필요" : "브라우저 알림 켜기"}
        </button>
      )}

      <div className="mt-3">
        <label className="text-[11px] font-semibold text-muted">최소 신뢰도</label>
        <div className="mt-1.5 flex gap-1">
          {ALL_TIERS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => save({ ...prefs, maxTier: t })}
              className={`flex-1 rounded-md border py-1 text-[11px] font-semibold transition-colors ${
                prefs.maxTier === t
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border text-muted hover:text-text"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-muted">
          {tierLabel(prefs.maxTier)}까지 알림을 받습니다.
        </p>
      </div>

      {open ? (
        <div className="mt-3 max-h-64 space-y-1 overflow-y-auto border-t border-border pt-3">
          {teams.map((t) => (
            <button
              key={t.slug}
              type="button"
              onClick={() => toggleTeam(t.slug)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] transition-colors ${
                prefs.teams.includes(t.slug)
                  ? "bg-accent/15 font-semibold text-accent"
                  : "text-muted hover:bg-surface-2"
              }`}
            >
              <TeamCrest team={t} size={16} />
              <span className="truncate">{t.ko}</span>
              {prefs.teams.includes(t.slug) && <span className="ml-auto">✓</span>}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3 border-t border-border pt-3">
          {selected.length === 0 ? (
            <p className="text-[11px] text-muted">구독한 팀이 없습니다.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((t) => (
                <span
                  key={t.slug}
                  className="inline-flex items-center gap-1 rounded-full bg-surface-3 py-0.5 pr-2 pl-1 text-[11px]"
                >
                  <TeamCrest team={t} size={14} />
                  {t.ko}
                </span>
              ))}
            </div>
          )}
          {lastCheck && (
            <p className="mt-2 text-[10px] text-muted">
              {new Date(lastCheck).toLocaleTimeString("ko-KR")} 확인됨 ·{" "}
              {live ? "새 기사 들어오면 즉시" : "5분마다 확인"}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
