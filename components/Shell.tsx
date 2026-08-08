"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Close, Menu } from "./icons";
import { Logo } from "./Logo";

/**
 * The app shell.
 *
 * Everything that is not a story lives in the rail — the mark, search, collect,
 * the panels — which leaves the content column with nothing above it. So there
 * is no page header at all above `lg`: the feed starts at the top of the
 * window and gets the full width.
 *
 * One rail, two behaviours. Above `lg` it is a fixed column that owns the left
 * edge. Below it there is no room for a permanent column, so the same markup
 * becomes a drawer behind a menu button — rendered once either way, because the
 * panels hold state (a subscription list keyed on a browser token) that a
 * second copy would fork.
 */
export function Shell({
  rail,
  actions,
  children,
}: {
  rail: ReactNode;
  actions: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const params = useSearchParams();

  // Tapping a filter inside the drawer navigates; the drawer should not stay
  // over the result.
  useEffect(() => setOpen(false), [pathname, params]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="min-h-screen bg-bg">
      {open && (
        <button
          type="button"
          aria-label="메뉴 닫기"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <aside
        className={`no-scrollbar fixed inset-y-0 left-0 z-50 flex w-[min(19rem,86vw)] flex-col overflow-y-auto border-r border-border bg-surface transition-transform duration-200 lg:z-30 lg:w-[var(--rail)] lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* The mark had a whole 4rem band to itself and read as a placeholder.
            The premise it stands for goes under it — it is the one line that
            explains why the rail below is sorted by person and not by outlet. */}
        <div className="shrink-0 border-b border-border px-[var(--gutter)] pt-3.5 pb-3">
          <div className="flex items-start gap-2">
            <Link
              href="/"
              aria-label="ITK plus 홈 · 필터 초기화"
              title="필터 초기화"
              className="-m-1.5 rounded-md p-1.5 transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            >
              <Logo height={30} />
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="메뉴 닫기"
              className="ml-auto rounded p-1.5 text-muted transition-colors hover:text-text lg:hidden"
            >
              <Close />
            </button>
          </div>
          <p className="mt-2.5 flex items-center gap-1.5 text-[11px] tracking-wide text-faint">
            <span
              aria-hidden
              className="h-[11px] w-[2px] rounded-full"
              style={{ background: "var(--ribbon)" }}
            />
            매체보다 <span className="font-semibold text-muted">저자</span>
          </p>
        </div>

        {/* Search and collect belong with the controls, not floating over the
            stories they act on. */}
        {/* Stacked: the rail is ~13rem at its narrowest and a search field
            beside a button there is two cramped controls instead of one good
            one. */}
        <div className="flex shrink-0 flex-col gap-2 border-b border-border px-[var(--gutter)] py-3">
          {actions}
        </div>

        {rail}
      </aside>

      <div className="lg:pl-[calc(var(--rail)+0.5rem)]">
        {/* Below lg there is no rail, so a slim bar carries the way into it. */}
        <div className="sticky top-0 z-20 flex h-[var(--headerh)] items-center gap-2 border-b border-border bg-bg/95 px-[var(--gutter)] backdrop-blur-sm lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="메뉴 열기"
            aria-expanded={open}
            className="-ml-1.5 shrink-0 rounded-md p-2 text-muted transition-colors hover:text-text"
          >
            <Menu />
          </button>
          <Link
            href="/"
            aria-label="ITK plus 홈 · 필터 초기화"
            className="shrink-0"
          >
            <Logo height={26} />
          </Link>
        </div>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
