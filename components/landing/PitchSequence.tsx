"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { animate, onScroll, stagger } from "animejs";
import type { Team } from "@/lib/types";
import { TeamCrest } from "@/components/TeamCrest";
import { reducedMotion, useBeforePaint } from "@/lib/motion";
import { Ball3D } from "./Ball3D";

/**
 * The opening sequence: a ball on the grass, and the clubs arriving around it.
 *
 * Built the way animejs.com builds its own hero, which was worth measuring
 * before copying: a tall wrapper holds a sticky viewport-sized stage, so the
 * page keeps scrolling while the stage stays put and its contents are driven by
 * scroll position.
 *
 * The ball is a photograph, not geometry. Several rounds of generated 3D - a
 * truncated icosahedron, then a match-ball star pattern - never stopped looking
 * like generated 3D next to a real pitch, and the honest comparison was always
 * going to be against a photograph. Dropping it also drops three.js, which was
 * 132kB of the page for one object that a 300kB image renders better.
 *
 * So nothing is taken apart. The camera moves instead: the shot pushes in
 * slowly while the crests arrive around the ball, which is the same idea told
 * with the one asset that already looks right.
 */

/** How many screens of scroll the sequence occupies. */
const STAGE_SCREENS = 5;
/** Radius of the ring the crests settle on, as a share of the shorter side. */
const RING = 0.4;

export function PitchSequence({ teams }: { teams: Team[] }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const shot = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  /** 0 at the top of the sequence, 1 at the end. Read by the WebGL loop. */
  const progress = useRef(0);

  useBeforePaint(() => {
    const wrap = wrapper.current;
    const stageEl = stage.current;
    if (!wrap || !stageEl || reducedMotion()) return;

    const crests = Array.from(
      stageEl.querySelectorAll<HTMLElement>("[data-crest]"),
    );
    const scrub = () => onScroll({ target: wrap, sync: true });

    // One scrubbed number drives the 3D scene: anime owns it, the render loop
    // reads it. A canvas cannot be animated by anime.js directly.
    const p = { v: 0 };
    const driver = animate(p, {
      v: 1,
      ease: "linear",
      autoplay: scrub(),
      onUpdate: () => {
        progress.current = p.v;
      },
    });

    /**
     * A slow push in on the photograph.
     *
     * Scale only, and only a little: the shot is already shallow-focus, so a
     * small move reads as a camera rather than as a zooming image.
     */
    const push = shot.current
      ? animate(shot.current, {
          keyframes: {
            "0%": { scale: 1 },
            "50%": { scale: 1.12 },
            "100%": { scale: 1.12 },
          },
          ease: "linear",
          autoplay: scrub(),
        })
      : null;

    /**
     * The clubs come up around the ball, one after another.
     *
     * The ring is CSS, so with no script running the stage is a photograph with
     * seventeen crests on it - the finished picture. What is animated is the
     * pull toward the centre and the release back to zero.
     *
     * The hold at the front buys back the quarter of the scrub that is already
     * spent at scroll 0 (the wrapper has travelled a viewport of its own window
     * by then), and the finish at 50% leaves about two screens of the assembled
     * state before the stage stops being sticky at height minus viewport.
     */
    const pull = (i: number) => {
      const a = (i / crests.length) * Math.PI * 2 - Math.PI / 2;
      const r = Math.min(stageEl.clientWidth, stageEl.clientHeight) * RING;
      return { x: -Math.cos(a) * r, y: -Math.sin(a) * r };
    };

    const burst = animate(crests, {
      keyframes: {
        "0%": {
          opacity: 0, scale: 0, rotate: -60,
          x: (_t: unknown, i?: number) => pull(i ?? 0).x,
          y: (_t: unknown, i?: number) => pull(i ?? 0).y,
        },
        "22%": {
          opacity: 0, scale: 0, rotate: -60,
          x: (_t: unknown, i?: number) => pull(i ?? 0).x,
          y: (_t: unknown, i?: number) => pull(i ?? 0).y,
        },
        "50%": { opacity: 1, scale: 1, rotate: 0, x: 0, y: 0 },
        "100%": { opacity: 1, scale: 1, rotate: 0, x: 0, y: 0 },
      },
      ease: "outQuad",
      delay: stagger(24),
      autoplay: scrub(),
    });

    const line = copy.current
      ? animate(copy.current, {
          keyframes: {
            "0%": { opacity: 1, y: 0 },
            "20%": { opacity: 1, y: 0 },
            "38%": { opacity: 0, y: 26 },
            "100%": { opacity: 0, y: 26 },
          },
          ease: "linear",
          autoplay: scrub(),
        })
      : null;

    return () => {
      driver.revert();
      push?.revert();
      burst.revert();
      line?.revert();
      for (const c of crests) {
        c.style.opacity = "";
        c.style.transform = "";
      }
    };
  }, []);

  return (
    <div ref={wrapper} style={{ height: `${STAGE_SCREENS * 100}dvh` }}>
      <div
        ref={stage}
        className="sticky top-0 flex h-[100dvh] items-center justify-center overflow-hidden bg-[#070806]"
      >
        <div ref={shot} aria-hidden className="absolute inset-0 will-change-transform">
          <Image
            src="/pitch.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="scale-[1.18] object-cover object-[86%_center]"
          />
        </div>
        {/* Darkened top and bottom so the shot falls into the page instead of
            stopping at an edge, and so type stays readable over it. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(7,8,6,0.92) 0%, rgba(7,8,6,0.30) 34%, rgba(7,8,6,0.30) 58%, rgba(7,8,6,0.88) 100%)",
          }}
        />

        {teams.map((t, i) => {
          const a = (i / teams.length) * Math.PI * 2 - Math.PI / 2;
          return (
            <div
              key={t.slug}
              data-crest
              className="absolute z-20 will-change-transform"
              style={{
                left: `calc(50% + ${(Math.cos(a) * RING * 100).toFixed(2)}vmin)`,
                top: `calc(50% + ${(Math.sin(a) * RING * 100).toFixed(2)}vmin)`,
                marginLeft: "-1.7rem",
                marginTop: "-1.7rem",
              }}
            >
              <Link
                href={`/?team=${t.slug}`}
                title={t.ko}
                className="flex size-[clamp(3.2rem,7vw,4.4rem)] items-center justify-center rounded-full border border-white/12 bg-black/60 backdrop-blur-sm transition-colors hover:border-accent/60"
              >
                <TeamCrest team={t} size={32} />
              </Link>
            </div>
          );
        })}

        <div className="relative z-10 -translate-y-[5vh]">
          <Ball3D progress={progress} />
        </div>

        <div
          ref={copy}
          className="pointer-events-none absolute inset-x-0 bottom-[9vh] z-30 px-[var(--gutter)] text-center"
        >
          <h1 className="text-[2.2rem] leading-[1.1] font-bold tracking-tight text-text drop-shadow-[0_2px_18px_rgba(0,0,0,0.9)] sm:text-5xl">
            <span className="text-accent">저자</span>를 보고 읽는 이적 소식
          </h1>
          <p className="mx-auto mt-4 max-w-[38ch] text-[14px] text-white/70 sm:text-[15px]">
            유럽 17개 구단, 해외 기자 244명.
          </p>
        </div>
      </div>
    </div>
  );
}
