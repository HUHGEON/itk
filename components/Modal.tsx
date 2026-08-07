"use client";

import { useEffect, useRef, type ReactNode } from "react";

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

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
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
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-t-2xl border border-border bg-surface text-text shadow-2xl sm:rounded-2xl"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-[14px] font-bold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="rounded px-1.5 text-[16px] leading-none text-muted hover:text-text"
            >
              ×
            </button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto px-4 py-3">{children}</div>
        </div>
      </div>
    </dialog>
  );
}
