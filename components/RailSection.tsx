"use client";

import { useState, type ReactNode } from "react";
import { Chevron } from "./icons";

/**
 * A rail section that folds.
 *
 * The rail is a fixed column, so anything past the fold is only reachable by
 * scrolling a sidebar — which is exactly what a fixed column exists to avoid.
 * The alert panels are the two that push it over: both are setup you do once
 * and then never look at, unlike the counts above them, so they open on demand
 * and sit closed the rest of the time.
 *
 * The section's own action ("+ 추가", "팀 선택") appears only while open. It
 * acts on the body, and offering it against a body nobody can see is how you
 * get a button that appears to do nothing.
 */
export function RailSection({
  title,
  action,
  overlay,
  children,
}: {
  title: ReactNode;
  action?: ReactNode;
  /** Modals and the like — kept mounted whether or not the body is open. */
  overlay?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="border-b border-border px-[var(--gutter)] py-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="group -my-1 flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
        >
          <span
            aria-hidden
            className="h-[13px] w-[3px] shrink-0 rounded-full"
            style={{ background: "var(--ribbon)" }}
          />
          <h2 className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
            {title}
          </h2>
          <Chevron
            className={`ml-auto shrink-0 text-faint transition-transform duration-150 group-hover:text-muted ${
              open ? "rotate-90" : ""
            }`}
          />
        </button>
        {open && action}
      </div>

      {open && <div className="mt-2.5">{children}</div>}
      {overlay}
    </section>
  );
}
