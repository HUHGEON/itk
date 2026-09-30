"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Close, Menu } from "./icons";
import { Logo } from "./Logo";

/**
 * The app shell: a header across the top, the page in the middle, and the
 * page's side panels in a column to its right.
 *
 * It used to be a 245px rail down the left holding everything at once - the
 * site's four sections, search, collect, and whatever the page wanted beside
 * it. Once the feed became an 800px reading column (after 요즘IT's lists), the
 * rail left a 200px gutter of nothing between itself and the stories. 요즘IT
 * has no rail: sections and search sit in a header, and a page that has
 * something to say on the side says it in a box to the right. That is the
 * layout here.
 *
 * On a phone the sections become a row of tabs under the header, and the side
 * panels move into a drawer behind the menu button - rendered once either way,
 * because the panels hold state (a subscription list keyed on a browser token)
 * that a second copy would fork.
 */
const SECTIONS = [
  { href: "/feed", label: "이적 소식", match: (p: string) => p === "/feed" || p === "/" },
  { href: "/matches", label: "경기 일정", match: (p: string) => p.startsWith("/matches") },
  { href: "/journalists", label: "기자", match: (p: string) => p.startsWith("/journalists") },
  { href: "/games", label: "미니게임", match: (p: string) => p.startsWith("/games") },
];

export function Shell({
  rail,
  actions,
  children,
}: {
  /** the page's side panels: a column on the right, a drawer on a phone */
  rail: ReactNode;
  /** search and collect, in the header */
  actions: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // Whether the side column is currently a closed drawer (phone) or the
  // visible column (desktop); a closed drawer is taken out of the tab order.
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023.98px)");
    const sync = () => setDrawer(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

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

  const hasRail = Boolean(rail);

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-2 px-[var(--gutter)] sm:gap-6">
          <Link
            href="/feed"
            aria-label="ITK plus 이적 소식"
            className="shrink-0 rounded-[6px] focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            <Logo height={30} />
          </Link>

          <nav className="hidden h-full items-stretch gap-1 md:flex" aria-label="섹션">
            {SECTIONS.map((s) => {
              const on = s.match(pathname);
              return (
                <Link
                  key={s.href}
                  href={s.href}
                  aria-current={on ? "page" : undefined}
                  className={`flex items-center border-b-2 px-3 text-[15px] transition-colors ${
                    on ? "border-accent font-semibold text-text" : "border-transparent text-muted hover:text-text"
                  }`}
                >
                  {s.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">{actions}</div>

          {hasRail && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="메뉴 열기"
              aria-expanded={open}
              className="-mr-1.5 shrink-0 rounded-[10px] p-2 text-muted transition-colors hover:text-text lg:hidden"
            >
              <Menu />
            </button>
          )}
        </div>

        {/* The sections, as a row of tabs on a phone. */}
        <nav className="flex border-t border-border md:hidden" aria-label="섹션">
          {SECTIONS.map((s) => {
            const on = s.match(pathname);
            return (
              <Link
                key={s.href}
                href={s.href}
                aria-current={on ? "page" : undefined}
                className={`flex-1 border-b-2 py-2.5 text-center text-[14px] transition-colors ${
                  on ? "border-accent font-semibold text-text" : "border-transparent text-muted"
                }`}
              >
                {s.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {open && (
        <button
          type="button"
          aria-label="메뉴 닫기"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <div
        className={`mx-auto max-w-[1240px] ${
          hasRail ? "lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8 lg:px-[var(--gutter)]" : ""
        }`}
      >
        <main className="min-w-0">{children}</main>

        {hasRail && (
          <aside
            inert={drawer && !open}
            className={`fixed inset-y-0 right-0 z-50 w-[min(20rem,86vw)] overflow-y-auto border-l border-border bg-surface transition-transform duration-200 ${
              open ? "translate-x-0" : "translate-x-full"
            } lg:sticky lg:top-[5.25rem] lg:z-auto lg:my-5 lg:max-h-[calc(100vh-6.5rem)] lg:w-auto lg:translate-x-0 lg:self-start lg:rounded-2xl lg:border lg:transition-none`}
          >
            <div className="flex items-center justify-between border-b border-border px-[var(--gutter)] py-3 lg:hidden">
              <span className="text-[15px] font-bold text-text">메뉴</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="메뉴 닫기"
                className="rounded p-1.5 text-muted hover:text-text"
              >
                <Close />
              </button>
            </div>
            {rail}
            {/* The way back to the front page: rarely wanted by someone who
                reads daily, so it sits at the foot of the side column. */}
            <div className="border-t border-border px-[var(--gutter)] py-2">
              <Link
                href="/?intro=1"
                prefetch={false}
                className="block py-1.5 text-[12.5px] text-faint transition-colors hover:text-muted"
              >
                ITK+ 소개
              </Link>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
