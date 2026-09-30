"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { SidebarSimple } from "@phosphor-icons/react";
import { Close, Menu } from "./icons";
import { Logo } from "./Logo";
import { SECTIONS, SideNav } from "./SideNav";

/**
 * The app shell: three columns, as a sports dashboard lays itself out.
 *
 *   left    where you are, and the leagues and clubs (SideNav)
 *   middle  a toolbar with the page's name, search and collect; the page
 *   right   the page's widgets, each on its own card
 *
 * The left column came back after a spell as a top header. It left as a
 * 245px rail that held everything at once; it returns holding only
 * navigation, with the leagues and clubs by logo, because a category filter
 * that lives in a tab row under a hero was reported as hard to find.
 *
 * Below 1280px there is no room for the widget column, so it moves into a
 * drawer behind a button in the toolbar; below 1024px the left column joins
 * it and the sections become a row of tabs under a compact header. Each
 * column is rendered once either way, because the widgets hold state (a
 * subscription list keyed on a browser token) that a second copy would fork.
 */
export function Shell({
  rail,
  actions,
  bare = false,
  children,
}: {
  /** the page's widgets: a column on the right, a drawer on smaller screens */
  rail: ReactNode;
  /** search and collect */
  actions: ReactNode;
  /**
   * The page lays out its own cards (the feed, the reporters, the games)
   * rather than sitting in the one the shell gives it.
   */
  bare?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // Whether the drawer is the only way to the widgets (below xl); a closed
  // drawer is taken out of the tab order.
  const [drawer, setDrawer] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const pathname = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    const xl = window.matchMedia("(max-width: 1279.98px)");
    const lg = window.matchMedia("(max-width: 1023.98px)");
    const sync = () => {
      setDrawer(xl.matches);
      setNarrow(lg.matches);
    };
    sync();
    xl.addEventListener("change", sync);
    lg.addEventListener("change", sync);
    return () => {
      xl.removeEventListener("change", sync);
      lg.removeEventListener("change", sync);
    };
  }, []);

  // Tapping a link inside the drawer navigates; the drawer should not stay
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
  const section = SECTIONS.find((s) => s.match(pathname));

  return (
    <div className="min-h-screen bg-bg">
      {/* A phone and a small tablet: a compact header and the sections as tabs. */}
      <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-xl lg:hidden">
        <div className="flex h-16 items-center gap-2 px-[var(--gutter)]">
          <Link href="/feed" aria-label="ITK plus 이적 소식" className="mr-auto shrink-0">
            <Logo height={28} />
          </Link>
          {actions}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="메뉴 열기"
            aria-expanded={open}
            className="-mr-1.5 shrink-0 rounded-[10px] p-2 text-muted transition-colors hover:text-text"
          >
            <Menu />
          </button>
        </div>
        <nav className="flex" aria-label="섹션">
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
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] xl:hidden"
        />
      )}

      <div
        className={`mx-auto max-w-[1480px] lg:grid lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-6 lg:pr-6 ${
          hasRail ? "xl:grid-cols-[248px_minmax(0,1fr)_320px]" : ""
        }`}
      >
        {/* The left column, from 1024px up. Below that it is in the drawer. */}
        <aside className="hidden border-r border-border lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto">
          <SideNav />
        </aside>

        <main className="min-w-0">
          {/* The toolbar: the page's name, and search and collect beside it. */}
          <div className="sticky top-0 z-30 hidden h-16 items-center gap-3 bg-bg/85 backdrop-blur-xl lg:flex">
            <h2 className="mr-auto text-[20px] font-bold tracking-tight text-text">{section?.label}</h2>
            {actions}
            {hasRail && (
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="현황 열기"
                aria-expanded={open}
                className="shrink-0 rounded-[10px] border border-border p-2 text-muted transition-colors hover:border-border-strong hover:text-text xl:hidden"
              >
                <SidebarSimple size={18} mirrored />
              </button>
            )}
          </div>

          {bare ? (
            children
          ) : (
            <div className="py-2 sm:px-[var(--gutter)] sm:py-4 lg:px-0 lg:pt-1">
              <div className="min-h-[60vh] overflow-clip bg-surface sm:rounded-[20px]">{children}</div>
            </div>
          )}
        </main>

        {/* The widgets: a column from 1280px, a drawer below it. On a phone
            the drawer also carries the left column's menu. */}
        {(hasRail || narrow) && (
          <aside
            inert={drawer && !open}
            className={`fixed inset-y-0 right-0 z-50 w-[min(22rem,88vw)] overflow-y-auto bg-bg transition-transform duration-200 ${
              open ? "translate-x-0" : "translate-x-full"
            } border-l border-border xl:sticky xl:top-0 xl:z-auto xl:h-screen xl:w-auto xl:translate-x-0 xl:border-0 xl:bg-transparent xl:transition-none`}
          >
            <div className="flex items-center justify-between px-[var(--gutter)] py-3 xl:hidden">
              <span className="text-[15px] font-bold text-text">{narrow ? "메뉴" : "현황"}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="rounded p-1.5 text-muted hover:text-text"
              >
                <Close />
              </button>
            </div>
            {narrow && <SideNav />}
            {/* Each widget on its own card, 16px apart, level with the toolbar. */}
            {hasRail && (
              <div className="flex flex-col gap-4 px-[var(--gutter)] pb-6 xl:px-0 xl:pt-[4.25rem] *:overflow-hidden *:rounded-[20px] *:border-0 *:bg-surface">
                {rail}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
