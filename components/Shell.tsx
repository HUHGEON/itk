"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Close, Menu } from "./icons";
import { Logo } from "./Logo";

/**
 * The app shell.
 *
 * One rail, two behaviours. Above `lg` it is a fixed column that owns the left
 * edge and carries the logo at its head. Below it there is no room for a
 * permanent column, so the same markup becomes a drawer behind a menu button —
 * rendered once either way, because the panels hold state (a subscription list
 * keyed on a browser token) that a second copy would fork.
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
      {/* Backdrop only exists while the drawer is out, and only below lg. */}
      {open && (
        <button
          type="button"
          aria-label="메뉴 닫기"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(20rem,86vw)] flex-col overflow-y-auto border-r border-border bg-surface transition-transform duration-200 lg:z-30 lg:w-[var(--rail)] lg:translate-x-0 no-scrollbar ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex h-[var(--headerh)] shrink-0 items-center gap-2 border-b border-border px-[var(--gutter)]">
          <Link
            href="/"
            aria-label="ITK plus 홈 · 필터 초기화"
            title="필터 초기화"
            className="-m-1.5 rounded-md p-1.5 transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            <Logo height={34} />
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

        <div className="space-y-4 px-[var(--gutter)] py-5">{rail}</div>
      </aside>

      <div className="lg:pl-[var(--rail)]">
        <header className="sticky top-0 z-20 bg-bg/95 backdrop-blur-sm">
          <div className="flex h-[var(--headerh)] items-center gap-2.5 px-[var(--gutter)]">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="메뉴 열기"
              aria-expanded={open}
              className="-ml-1.5 shrink-0 rounded-md p-2 text-muted transition-colors hover:text-text lg:hidden"
            >
              <Menu />
            </button>

            {/* The mark lives in the rail on desktop; on a phone the rail is
                hidden, so it rides the header instead. */}
            <Link
              href="/"
              aria-label="ITK plus 홈 · 필터 초기화"
              className="shrink-0 lg:hidden"
            >
              <Logo height={28} />
            </Link>

            <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2.5">
              {actions}
            </div>
          </div>
          <div
            aria-hidden
            className="h-[2px] w-full"
            style={{ background: "var(--ribbon)" }}
          />
        </header>

        <main className="px-0 py-0 sm:px-[var(--gutter)] sm:py-[var(--gutter)]">
          <div className="mx-auto max-w-3xl overflow-hidden sm:rounded-xl sm:border sm:border-border sm:bg-surface">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
