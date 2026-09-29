"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { BOARD_H_PER_W, place } from "@/lib/games/hex";
import type { BoardCell } from "@/lib/games/board";
import type { Category } from "@/lib/games/data";
import { reducedMotion } from "@/lib/motion";
import { CategoryFace } from "./CategoryFace";

/*
 * Every number in this file is the original's, read out of its board module
 * (playfootball.games, chunk "core"): the palettes, the 72px hex, the 1.6-unit
 * inset, the 1100ms flip with a 170ms stagger, the 1.12 hover and selection
 * scale, the 4px selection stroke, the shake keyframes, the reveal and the
 * chain-preview pulse.
 */

/** Possession Play: neutral, blue, red. */
export const OWNER = {
  none: { fill: "#DCE6F2", ink: "#1E293B" },
  p1: { fill: "#2563EB", ink: "#DBEAFE" },
  p2: { fill: "#EF4444", ink: "#FFE4E6" },
} as const;

/** The mover's colour, laid over what they can pick. */
export const ACCENT = {
  p1: {
    overlay: "rgba(96, 165, 250, 0.26)",
    highlight: "rgba(96, 165, 250, 0.18)",
    stroke: "#60A5FA",
    tint: "rgba(37, 99, 235, 0.1)",
  },
  p2: {
    overlay: "rgba(251, 113, 133, 0.26)",
    highlight: "rgba(251, 113, 133, 0.18)",
    stroke: "#FB7185",
    tint: "rgba(239, 68, 68, 0.1)",
  },
  /** The Heatmap has one player and picks in blue. */
  heat: {
    overlay: "rgba(96, 165, 250, 0.24)",
    highlight: "rgba(96, 165, 250, 0.16)",
    stroke: "#60A5FA",
    tint: "",
  },
} as const;
export type Accent = (typeof ACCENT)[keyof typeof ACCENT];

/** The Heatmap's eight levels, cold to white-hot. */
export const HEAT = [
  { fill: "#E2E8F0", ink: "#0F172A" },
  { fill: "#FEF9C3", ink: "#713F12" },
  { fill: "#FDE047", ink: "#713F12" },
  { fill: "#F59E0B", ink: "#78350F" },
  { fill: "#F97316", ink: "#7C2D12" },
  { fill: "#EF4444", ink: "#FEF2F2" },
  { fill: "#991B1B", ink: "#FEF2F2" },
  { fill: "#450A0A", ink: "#FFF7ED" },
] as const;

/** `base` (hex or rgb) with a translucent `over` composited on top, as one opaque colour. */
export function over(base: string, rgba: string): string {
  const parse = (c: string) => {
    const h = c.trim().match(/^#([0-9a-f]{6})$/i);
    if (h) return [0, 2, 4].map((i) => parseInt(h[1].slice(i, i + 2), 16)).concat(1);
    const m = c.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/);
    return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null;
  };
  const b = parse(base);
  const o = parse(rgba);
  if (!b || !o) return base;
  const mix = (i: number) => Math.round(b[i] * (1 - o[3]) + o[i] * o[3]);
  return `rgb(${mix(0)} ${mix(1)} ${mix(2)})`;
}

export interface HexLook {
  fill: string;
  ink: string;
  /** can be picked: hover lift, pointer, and the selection and highlight layers */
  open?: boolean;
  selected?: boolean;
  /** touching the selected hex */
  highlighted?: boolean;
  accent?: Accent;
  /** CSS drop-shadow() argument, for the Heatmap's claimed and unclaimed cells */
  shadow?: string;
  label?: string;
}

/** A pointy-top hex in the original's 86.6 × 100 box, pulled in by `inset`. */
const W = 86.6025403784;
const H = 100;
const CORNERS: [number, number][] = [
  [W / 2, 0],
  [W, 25],
  [W, 75],
  [W / 2, 100],
  [0, 75],
  [0, 25],
];
function hex(inset: number): string {
  const sx = (W - inset * 2) / W;
  const sy = (H - inset * 2) / H;
  return CORNERS.map(([x, y]) => `${W / 2 + (x - W / 2) * sx},${H / 2 + (y - H / 2) * sy}`).join(" ");
}
const CLIP = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";
const EASE = "cubic-bezier(0.22, 0.61, 0.36, 1)";
export const FLIP_MS = 1100;
export const FLIP_STAGGER = 170;

function Face({ cat, look, back }: { cat: Category; look: HexLook; back?: boolean }) {
  const lift = `h-full w-full origin-center transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
    look.open ? "group-hover:scale-[1.12] group-hover:drop-shadow-[0_16px_24px_rgba(15,23,42,0.22)]" : ""
  } ${look.selected && look.open ? "scale-[1.12]" : ""}`;
  const a = look.accent;
  return (
    <div
      className="absolute inset-0"
      style={{
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        transform: back ? "rotateY(180deg)" : undefined,
      }}
    >
      {/* The Heatmap's shadow sits here, inside the face, not on the cell:
          a filter on an ancestor flattens the 3D turn, and then the hidden
          back face shows through mirrored halfway round. */}
      <div className="h-full w-full" style={look.shadow ? { filter: `drop-shadow(${look.shadow})` } : undefined}>
      <svg viewBox={`0 0 ${W} ${H}`} className={lift} aria-hidden>
        <polygon points={hex(1.6)} fill={look.fill} style={{ transition: "fill 220ms ease" }} />
        {look.open && a && look.selected && <polygon points={hex(2.4)} fill={a.overlay} />}
        {look.open && a && look.highlighted && !look.selected && <polygon points={hex(2.4)} fill={a.highlight} />}
        {look.open && a && look.selected && (
          <polygon points={hex(1.5)} fill="none" stroke={a.stroke} strokeWidth="4" vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      </div>
      <div className={`pointer-events-none absolute inset-0 ${look.selected && look.open ? "scale-[1.12]" : ""}`}>
        {/* The crest's fade runs into the colour the hex actually shows,
            highlight included, or it reads as a pale box. */}
        <CategoryFace
          cat={cat}
          ink={look.ink}
          fill={
            look.open && a && (look.selected || look.highlighted)
              ? over(look.fill, look.selected ? a.overlay : a.highlight)
              : look.fill
          }
        />
      </div>
    </div>
  );
}

/**
 * The hex board both hex games are played on.
 *
 * Laid out in fractions of its own width, so it is the original's 360px (405px
 * from `md`) where there is room and shrinks with a phone.
 *
 * A claimed hex turns over: the old colour on its front, the new one on its
 * back, a half turn about the vertical axis. The front keeps the colour the
 * cell had before the move until its own turn comes, so a four-hex answer
 * spreads outward one hex at a time rather than repainting and then spinning.
 */
export function HexBoard({
  board,
  cats,
  look,
  onSelect,
  flip,
  shake,
  reveal,
  pulse,
  reheat,
  centre,
  centreSlot,
}: {
  board: BoardCell[];
  cats: Category[];
  look: (cell: BoardCell) => HexLook;
  onSelect?: (id: string) => void;
  /** cells that change hands, in the order they turn; `delays` overrides the stagger */
  flip?: { ids: string[]; nonce: number; delays?: Record<string, number> };
  shake?: { id: string; nonce: number };
  /** the answer's name over the hex it was played on, for an opponent's move */
  reveal?: { id: string; text: string; nonce: number } | null;
  /** chain mode: every cell pulses, later the further it is from the selection */
  pulse?: { delays: Record<string, number>; accent: Accent; key: string } | null;
  /** Heatmap: a dark ring over cells that got hotter */
  reheat?: { ids: string[]; nonce: number };
  centre?: ReactNode;
  centreSlot?: { q: number; r: number };
}) {
  const looks = new Map(board.map((c) => [c.id, look(c)]));

  // What each cell looked like at the last commit: the front of a flip.
  const shown = useRef(new Map<string, HexLook>());
  const seenFlip = useRef(flip?.nonce);
  const [turning, setTurning] = useState<Record<string, { from: HexLook; delay: number; nonce: number }>>({});

  useLayoutEffect(() => {
    if (!flip || flip.nonce === seenFlip.current) return;
    seenFlip.current = flip.nonce;
    if (reducedMotion() || flip.ids.length === 0) return;
    setTurning((t) => {
      const next = { ...t };
      flip.ids.forEach((id, i) => {
        const from = t[id]?.from ?? shown.current.get(id);
        if (!from) return;
        next[id] = {
          from: { ...from, selected: false, highlighted: false, open: false },
          delay: flip.delays?.[id] ?? i * FLIP_STAGGER,
          nonce: flip.nonce,
        };
      });
      return next;
    });
  }, [flip?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  // After the flip effect, so a flip reads the looks from before this render.
  useLayoutEffect(() => {
    shown.current = looks;
  });

  const done = (id: string, nonce: number) =>
    setTurning((t) => {
      if (t[id]?.nonce !== nonce) return t;
      const next = { ...t };
      delete next[id];
      return next;
    });

  /*
   * The turn runs on elements that stay put. It used to swap a plain face for
   * a two-faced one when a flip began and back when it ended, and each swap
   * built the crest's <img> afresh - measured: a different node on the first
   * frame of the flip - so the hex showed empty while it decoded, then popped
   * in. Now both faces are always there, the front shows the old look while
   * the cell waits and turns, and only a transform is animated.
   */
  const flippers = useRef(new Map<string, HTMLDivElement>());
  const running = useRef(new Map<string, { anim: Animation; nonce: number }>());
  useLayoutEffect(() => {
    for (const [id, r] of running.current) {
      if (turning[id]?.nonce === r.nonce) continue;
      // Finished (or superseded): drop the transform in the same frame that
      // the front takes the new look, so nothing old shows in between.
      r.anim.cancel();
      running.current.delete(id);
    }
    for (const [id, t] of Object.entries(turning)) {
      if (running.current.has(id)) continue;
      const el = flippers.current.get(id);
      if (!el) continue;
      const anim = el.animate([{ transform: "rotateY(0deg)" }, { transform: "rotateY(180deg)" }], {
        duration: FLIP_MS,
        delay: t.delay,
        easing: EASE,
        fill: "both",
      });
      anim.onfinish = () => done(id, t.nonce);
      running.current.set(id, { anim, nonce: t.nonce });
    }
  }, [turning]); // eslint-disable-line react-hooks/exhaustive-deps

  const shakers = useRef(new Map<string, HTMLDivElement>());
  useEffect(() => {
    if (!shake?.nonce || reducedMotion()) return;
    const x = [0, -6, 6, -5, 5, -2, 2, 0];
    shakers.current.get(shake.id)?.animate(
      x.map((v) => ({ transform: `translateX(${v}px)` })),
      { duration: 360, easing: "ease-in-out" },
    );
  }, [shake?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const box = (c: { q: number; r: number }) => {
    const b = place(c);
    return {
      left: `${b.left * 100}%`,
      top: `${b.top * 100}%`,
      width: `${b.width * 100}%`,
      height: `${b.height * 100}%`,
    };
  };

  return (
    <div
      className="relative mx-auto w-full max-w-[360px] select-none md:max-w-[405px]"
      style={{ aspectRatio: `1 / ${BOARD_H_PER_W}` }}
    >
      {board.map((cell) => {
        const l = looks.get(cell.id)!;
        const cat = cats[cell.cat];
        const t = turning[cell.id];
        const reheatAt = reheat && reheat.nonce ? reheat.ids.indexOf(cell.id) : -1;
        return (
          <div
            key={cell.id}
            data-hex={cell.id}
            className={`group absolute ${l.selected && l.open ? "z-10" : l.open ? "z-0 hover:z-10" : "z-0"}`}
            style={{
              ...box(cell),
              perspective: "1200px",
            }}
          >
            <button
              type="button"
              disabled={!l.open}
              aria-pressed={l.open ? !!l.selected : undefined}
              aria-label={`${cat.short}${l.label ? `, ${l.label}` : ""}`}
              onClick={l.open ? () => onSelect?.(cell.id) : undefined}
              className="absolute inset-0 z-20 cursor-pointer bg-transparent p-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#60A5FA] disabled:cursor-default"
              style={{ clipPath: CLIP }}
            />
            <div
              className={`pointer-events-none relative h-full w-full transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                l.open ? "group-active:scale-[0.98]" : ""
              }`}
              style={{ transformStyle: "preserve-3d" }}
            >
              <div
                ref={(el) => {
                  if (el) shakers.current.set(cell.id, el);
                  else shakers.current.delete(cell.id);
                }}
                className="relative h-full w-full"
                style={{ transformStyle: "preserve-3d" }}
              >
                <div
                  ref={(el) => {
                    if (el) flippers.current.set(cell.id, el);
                    else flippers.current.delete(cell.id);
                  }}
                  className="absolute inset-0"
                  style={{ transformStyle: "preserve-3d", willChange: "transform" }}
                >
                  <Face cat={cat} look={t ? t.from : l} />
                  <Face cat={cat} look={l} back />
                </div>
              </div>

              {reveal && reveal.id === cell.id && (
                <div
                  key={`reveal-${reveal.nonce}`}
                  className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-[14%] text-center"
                  style={{ animation: "hex-reveal 3100ms ease-in-out both" }}
                >
                  <div className="absolute inset-0" style={{ clipPath: CLIP, background: "rgba(15, 23, 42, 0.94)" }} />
                  <span className="relative z-10 line-clamp-3 text-[8px] leading-tight font-black break-keep text-white uppercase sm:text-[9px]">
                    {reveal.text}
                  </span>
                </div>
              )}

              {pulse && pulse.delays[cell.id] !== undefined && (
                <svg
                  key={`pulse-${pulse.key}`}
                  viewBox={`0 0 ${W} ${H}`}
                  className="pointer-events-none absolute inset-0 z-10 h-full w-full"
                  style={{
                    transformOrigin: "center",
                    animation: `hex-pulse 2700ms ${EASE} ${pulse.delays[cell.id]}ms infinite both`,
                  }}
                  aria-hidden
                >
                  <polygon points={hex(3.6)} fill={pulse.accent.overlay} />
                </svg>
              )}

              {reheatAt >= 0 && (
                <svg
                  key={`reheat-${reheat!.nonce}`}
                  viewBox={`0 0 ${W} ${H}`}
                  className="pointer-events-none absolute inset-0 z-10 h-full w-full"
                  style={{
                    transformOrigin: "center",
                    animation: `hex-reheat 620ms ${EASE} ${reheatAt * 90}ms both`,
                  }}
                  aria-hidden
                >
                  <polygon points={hex(2.8)} fill="rgba(69, 10, 10, 0.34)" />
                </svg>
              )}
            </div>
          </div>
        );
      })}

      {centre && centreSlot && (
        <div className="pointer-events-none absolute flex items-center justify-center" style={box(centreSlot)}>
          {centre}
        </div>
      )}
    </div>
  );
}
