"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { animate, spring } from "animejs";
import { Close } from "./icons";
import { reducedMotion } from "@/lib/motion";

/**
 * A dialog rendered with the native `<dialog>` element, so focus trapping and
 * the top layer come from the platform rather than hand-rolled listeners.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  /**
   * The card arrives under a spring; the dialog it sits in does not move.
   *
   * `showModal()` puts the whole thing in the top layer in one frame, which for
   * a sheet that covers the screen on a phone reads as a cut rather than as
   * something opening. It comes from below — the direction it occupies on
   * mobile — and settles rather than easing to a stop, because a panel you
   * dragged up should behave like it has weight.
   *
   * Only the card is animated. Transforming the `<dialog>` itself would move
   * the backdrop with it, and the backdrop is what tells you the page behind is
   * out of reach.
   */
  useEffect(() => {
    const el = card.current;
    if (!open || !el || reducedMotion()) return;
    const anim = animate(el, {
      // Opacity gets its own easing. A spring overshoots on the way to its
      // target, which is the point for position — the card settles rather than
      // stopping dead — but overshooting opacity means asking for 1.08, and
      // "more opaque than opaque" is a value the browser has to clamp away.
      opacity: { from: 0, to: 1, duration: 220, ease: "outQuad" },
      y: [24, 0],
      scale: [0.97, 1],
      ease: spring({ stiffness: 170, damping: 16 }),
    });
    return () => {
      anim.revert();
    };
  }, [open]);

  // Esc closes the dialog natively; mirror that back into React state.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    // The page behind must not scroll while the dialog is up.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      // Clicking the backdrop closes: the dialog fills the whole viewport and
      // the inner div stops propagation, so a click that reaches here is a
      // click outside the card.
      onClick={onClose}
      className="m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-4">
        <div
          ref={card}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-t-xl border border-border bg-surface text-text shadow-[0_24px_60px_-12px_rgba(0,0,0,0.8)] sm:rounded-xl"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
            <h2 className="text-[14px] font-semibold tracking-tight">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="rounded p-1 text-muted transition-colors hover:text-text"
            >
              <Close />
            </button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto px-4 py-3">
            {children}
          </div>
        </div>
      </div>
    </dialog>
  );
}
