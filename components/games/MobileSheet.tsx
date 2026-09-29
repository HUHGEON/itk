"use client";

import { useEffect } from "react";
import { X as XIcon } from "@phosphor-icons/react/dist/ssr";

/** On a phone the answer box is a sheet from the bottom, as in the original. */
export function MobileSheet({
  onClose,
  badges,
  children,
}: {
  onClose: () => void;
  badges: { id: string; label: string; on: boolean }[];
  children: React.ReactNode;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 sm:hidden" role="dialog" aria-modal aria-label="선수 찾기">
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 bg-slate-950/20" />
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-[1.75rem] border-t border-slate-700 bg-slate-900 px-4 pt-4 shadow-2xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 100px)", animation: "sheet-up 250ms ease-out" }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <p className="text-base font-black tracking-tight text-white">선수 찾기</p>
          <button type="button" onClick={onClose} aria-label="입력 닫기" className="shrink-0 text-slate-300 transition hover:text-white">
            <XIcon className="size-7" />
          </button>
        </div>
        {badges.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {badges.map((b) => (
              <span
                key={b.id}
                className={`inline-flex h-6 items-center rounded-full border px-2 text-[11px] font-medium ${
                  b.on ? "border-[#ceff27] bg-[#ceff27]/15 text-[#ceff27]" : "border-slate-700 bg-slate-800 text-slate-200"
                }`}
              >
                {b.label}
              </span>
            ))}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

