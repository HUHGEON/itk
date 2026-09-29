"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { animate, stagger } from "animejs";
import { BOARD_H_PER_W, place } from "@/lib/games/hex";
import type { BoardCell } from "@/lib/games/board";
import type { Category } from "@/lib/games/data";
import { reducedMotion } from "@/lib/motion";
import { CategoryFace } from "./CategoryFace";

export interface HexLook {
  /** CSS colour for the hex's fill */
  fill: string;
  /** text colour on that fill */
  ink: string;
  selected?: boolean;
  /** touching the selected hex: the cells an answer could also take */
  preview?: boolean;
  disabled?: boolean;
  label?: string;
}

const HEX = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

/**
 * The hex board both hex games are played on.
 *
 * Sized by its container and drawn in container units, so a hex's crest and
 * label scale with the board rather than with the viewport - the same board is
 * 340px wide on a phone and 520px on a laptop and reads the same on both.
 *
 * Two animations, both fired by a nonce rather than by state, because they
 * mark events and not conditions:
 *
 *  - `flip`: cells turn over in the order a claim spread to them, the new
 *    colour arriving edge-on. The original does this, and it is what makes a
 *    four-hex answer feel like four things happened rather than one repaint.
 *  - `shake`: a wrong answer, on the hex it was aimed at.
 */
export function HexBoard({
  board,
  cats,
  look,
  onSelect,
  flip,
  shake,
  centre,
  centreSlot,
}: {
  board: BoardCell[];
  cats: Category[];
  look: (cell: BoardCell) => HexLook;
  onSelect?: (id: string) => void;
  flip?: { ids: string[]; nonce: number };
  shake?: { id: string; nonce: number };
  /** something drawn in a hex-sized slot that holds no category */
  centre?: ReactNode;
  centreSlot?: { q: number; r: number };
}) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || !flip || flip.ids.length === 0 || reducedMotion()) return;
    const targets = flip.ids
      .map((id) => el.querySelector<HTMLElement>(`[data-hex="${id}"] [data-face]`))
      .filter((x): x is HTMLElement => !!x);
    const anim = animate(targets, {
      rotateY: [-90, 0],
      scale: [0.92, 1],
      duration: 520,
      ease: "outBack(1.6)",
      delay: stagger(110),
    });
    return () => {
      anim.revert();
    };
  }, [flip?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = root.current;
    if (!el || !shake || reducedMotion()) return;
    const target = el.querySelector<HTMLElement>(`[data-hex="${shake.id}"]`);
    if (!target) return;
    const anim = animate(target, {
      x: [0, -7, 7, -5, 5, -2, 0],
      duration: 460,
      ease: "inOutSine",
    });
    return () => {
      anim.revert();
    };
  }, [shake?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={root}
      className="@container relative mx-auto w-full max-w-[520px] select-none [perspective:900px]"
      style={{ aspectRatio: `1 / ${BOARD_H_PER_W}` }}
    >
      {board.map((cell) => {
        const box = place(cell);
        const l = look(cell);
        const cat = cats[cell.cat];
        return (
          <div
            key={cell.id}
            data-hex={cell.id}
            className="absolute"
            style={{
              left: `${box.left * 100}%`,
              top: `${box.top * 100}%`,
              width: `${box.width * 100}%`,
              height: `${box.height * 100}%`,
            }}
          >
            <button
              type="button"
              data-face
              disabled={l.disabled}
              onClick={() => onSelect?.(cell.id)}
              aria-label={`${cat.short}${l.label ? `, ${l.label}` : ""}`}
              aria-pressed={l.selected}
              className="group absolute inset-[3%] transition-transform duration-150 enabled:hover:-translate-y-[0.4cqw] enabled:active:translate-y-0 disabled:cursor-default"
              style={{ clipPath: HEX }}
            >
              {/* The rim: accent when selected, a faint accent on the cells an
                  answer would also reach, otherwise a hairline. */}
              <span
                aria-hidden
                className="absolute inset-0 transition-colors duration-200"
                style={{
                  clipPath: HEX,
                  background: l.selected
                    ? "var(--accent)"
                    : l.preview
                      ? "color-mix(in oklab, var(--accent) 45%, var(--border-strong))"
                      : "var(--border-strong)",
                }}
              />
              <span
                aria-hidden
                className="absolute inset-[4.5%] transition-colors duration-300"
                style={{ clipPath: HEX, background: l.fill, color: l.ink }}
              >
                <CategoryFace cat={cat} />
              </span>
            </button>
          </div>
        );
      })}

      {centre && centreSlot && (
        <div
          className="absolute flex items-center justify-center"
          style={(() => {
            const b = place(centreSlot);
            return {
              left: `${b.left * 100}%`,
              top: `${b.top * 100}%`,
              width: `${b.width * 100}%`,
              height: `${b.height * 100}%`,
            };
          })()}
        >
          {centre}
        </div>
      )}
    </div>
  );
}
