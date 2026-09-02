"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { animate } from "animejs";
import { Chevron } from "./icons";
import { expand, reducedMotion, useBeforePaint } from "@/lib/motion";

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
 *
 * Opening and closing both animate, which needs two pieces of state rather than
 * one: `open` is what the reader asked for, `mounted` is whether the body is
 * still in the DOM. A closing panel has to keep its content long enough to
 * collapse over it — unmounting on the click would leave nothing to animate and
 * the section would snap shut, which is worse than never animating at all.
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
  const [mounted, setMounted] = useState(false);
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useBeforePaint(() => {
    const el = body.current;
    if (!el) return;

    if (reducedMotion()) {
      if (!open) setMounted(false);
      return;
    }

    if (open) return expand(el);

    const height = el.scrollHeight;
    const anim = animate(el, {
      height: [height, 0],
      opacity: [1, 0],
      duration: 200,
      ease: "inQuad",
      onComplete: () => setMounted(false),
    });
    el.style.overflow = "hidden";
    return () => anim.revert();
  }, [open, mounted]);

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

      {mounted && (
        <div ref={body} className="mt-2.5">
          {children}
        </div>
      )}
      {overlay}
    </section>
  );
}
