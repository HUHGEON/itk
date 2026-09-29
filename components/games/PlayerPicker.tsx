"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { buildIndex, search, type Searchable } from "@/lib/games/search";

export interface PickerItem extends Searchable {
  key: string | number;
  /** a second line: birth year, club - whatever tells two namesakes apart */
  sub?: string;
}

/**
 * Naming a player.
 *
 * A combobox over the whole player list, answering to Korean, English or
 * initial consonants (see lib/games/search). The answer is the row the reader
 * picks, so "손흥민" and "Son Heung-min" are the same answer by construction -
 * there is no string comparison left to get wrong.
 *
 * Keyboard first: arrows move, Enter picks, Escape clears. On a phone the list
 * opens above the keyboard's reach by sitting directly under the field.
 */
export function PlayerPicker<T extends PickerItem>({
  items,
  onPick,
  disabled,
  placeholder,
  autoFocus,
}: {
  items: T[];
  onPick: (item: T) => void;
  disabled?: boolean;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const index = useMemo(() => buildIndex(items), [items]);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useId();
  const hits = useMemo(() => search(index, q, 8), [index, q]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    if (!disabled && autoFocus) input.current?.focus({ preventScroll: true });
  }, [disabled, autoFocus]);

  const pick = (item: T | undefined) => {
    if (!item) return;
    onPick(item);
    setQ("");
  };

  return (
    <div className="relative w-full">
      <input
        ref={input}
        type="text"
        role="combobox"
        aria-expanded={hits.length > 0}
        aria-controls={list}
        aria-activedescendant={hits[active] ? `${list}-${active}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        value={q}
        placeholder={placeholder}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          /*
           * Korean IME: Enter pressed mid-composition arrives twice - once
           * while the last syllable is still being composed, once after it is
           * committed. Handling both picked twice: "네투" chose 페드루 네투,
           * then the committed "투" chose "가브리에우 두스 산투스 마갈량이스".
           * The composing one is ignored; the second carries the full word.
           * (keyCode 229 is what some browsers send instead of isComposing.)
           */
          if (e.nativeEvent.isComposing || e.keyCode === 229) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, hits.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(hits[active]);
          } else if (e.key === "Escape") {
            setQ("");
          }
        }}
        className="w-full rounded-[10px] border-2 border-border-strong bg-surface px-4 py-3 text-[16px] text-text transition-colors outline-none placeholder:text-faint focus:border-accent disabled:cursor-not-allowed disabled:opacity-50"
      />
      {hits.length > 0 && (
        <ul
          id={list}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-[10px] border border-border-strong bg-surface-2 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.85)]"
        >
          {hits.map((h, i) => (
            <li
              key={h.key}
              id={`${list}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                // Before the input blurs, or the list is gone by the click.
                e.preventDefault();
                pick(h);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-baseline gap-2 px-4 py-2.5 ${
                i === active ? "bg-accent/15" : ""
              }`}
            >
              <span className="text-[15px] font-semibold text-text">{h.ko}</span>
              <span className="min-w-0 truncate text-[12.5px] text-muted">{h.en}</span>
              {h.sub && <span className="tnum ml-auto shrink-0 text-[12px] text-faint">{h.sub}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
