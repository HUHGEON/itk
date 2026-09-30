"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Keeps the category card pinned under the header while the list scrolls,
 * and publishes its height as --filterh so things that also stick (the "new
 * stories" pill) sit below it rather than behind it.
 *
 * A solid strip rather than a blurred one behind the card: a backdrop-filter
 * would make this box the containing block for the filter sheet, which is
 * position: fixed on a phone, and pin the sheet to the card.
 */
export function StickyFilters({ className = "", children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const ro = new ResizeObserver(() => root.style.setProperty("--filterh", `${el.offsetHeight}px`));
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--filterh");
    };
  }, []);
  return (
    <div ref={ref} className={`sticky top-[var(--headerh)] z-20 -mt-1 bg-bg pt-1 pb-2 ${className}`}>
      {children}
    </div>
  );
}
