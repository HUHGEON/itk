"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, type CSSProperties } from "react";
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
/**
 * The ring the crests settle on. A circle, and one that always fits.
 *
 * One radius, taken as the smallest of three limits: the size it would like to
 * be, the widest it can be without touching the sides, and the tallest it can
 * be without going under the header or off the bottom. Whichever limit bites
 * first, the ring stays a circle - an ellipse was tried and looks like a
 * mistake rather than a layout.
 *
 * The vertical inset is the larger of the two because that end has the header
 * above it as well as the crest's own height; the sides only have to clear the
 * crest.
 */
const RING = {
  /** Preferred radius, as a share of the shorter side. */
  vmin: 0.4,
  /** Room a crest needs at that end of the window, in rem. */
  xInset: 3.6,
  yInset: 7,
  /**
   * The ring rides with the ball, which sits a little above centre to leave the
   * headline its space. Measured from the top of the window, that means the
   * distance it has to clear the header in is only 45dvh, not 50.
   */
  lift: 0.05,
};

/**
 * One definition of a crest's size, used to place it and to size it.
 *
 * The floor is what matters on a phone. Seventeen crests on a ring that narrow
 * leaves about 50px of arc each, so a 3.2rem crest touched its neighbours all
 * the way round and the ring read as a solid band rather than as clubs.
 */
const CREST = "clamp(2.4rem,7vw,4.4rem)";

/**
 * The same ring, for the stylesheet and for the animation.
 *
 * The placement is CSS and the travel distance is JS, and for a while each had
 * its own copy of the maths. That works right up until the CSS grows a `min()`
 * the JS does not know about - then the crests fly to the wrong place, which is
 * exactly what happened. Both are derived from the constants above instead, so
 * they cannot drift apart.
 */
const ringCss = `min(${RING.vmin * 100}vmin,calc(50vw - ${RING.xInset}rem),calc(${(0.5 - RING.lift) * 100}dvh - ${RING.yInset}rem))`;

function ringPx(w: number, h: number, rem: number) {
  return Math.min(
    RING.vmin * Math.min(w, h),
    0.5 * w - RING.xInset * rem,
    (0.5 - RING.lift) * h - RING.yInset * rem,
  );
}

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
    /**
     * The scrub runs from the top of the sequence to the end of it.
     *
     * Without `enter`/`leave` anime measures from the moment the wrapper
     * appears at the bottom of the window, which for a wrapper that starts at
     * the top of the page means the scrub is already a sixth of the way in
     * before the reader has scrolled at all - measured: 0.155 at scrollY 0,
     * which had the ball sitting 139 degrees round from its front.
     */
    const scrub = () =>
      onScroll({ target: wrap, sync: true, enter: "top top", leave: "bottom bottom" });

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
      const rem =
        parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const r = ringPx(stageEl.clientWidth, stageEl.clientHeight, rem);
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
        // Published so the ball can size itself against the ring rather than
        // against the window - see Ball3D.
        style={{ "--ring": ringCss } as CSSProperties}
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
              /**
               * Hidden when the window is too short to hold the ring and the
               * ball at once - a phone on its side, mostly. Below about 520px
               * of height the ring closes to within a crest's width of the
               * ball, and the choice is between crests lying across it and no
               * crests. The ball alone still reads; a ball wearing badges does
               * not.
               */
              className="absolute z-20 will-change-transform [@media(max-height:520px)]:hidden"
              style={{
                left: `calc(50% + ${Math.cos(a).toFixed(4)} * ${ringCss})`,
                // Same -5dvh the ball carries, so the two share a centre. With
                // the ring centred and the ball lifted, the circle read as
                // sitting low and lopsided rather than around anything.
                top: `calc(50% - ${RING.lift * 100}dvh + ${Math.sin(a).toFixed(4)} * ${ringCss})`,
                // Half a crest, whatever a crest currently is. This was a flat
                // -1.7rem while the crest itself is up to 4.4rem, so every one
                // of them sat about 8px down and right of where it belonged -
                // enough to pull the circle visibly out of true.
                marginLeft: `calc(${CREST} / -2)`,
                marginTop: `calc(${CREST} / -2)`,
              }}
            >
              <Link
                href={`/feed?team=${t.slug}`}
                title={t.ko}
                className="flex items-center justify-center rounded-full border border-white/12 bg-black/60 backdrop-blur-sm transition-colors hover:border-accent/60"
                style={{ width: CREST, height: CREST }}
              >
                <TeamCrest team={t} size={32} />
              </Link>
            </div>
          );
        })}

        <div className="relative z-10 -translate-y-[5vh]">
          {/*
            The ball had nothing under it, so it floated.

            A contact shadow is what puts an object on a surface: dense and
            tight where the ball meets the grass, fading out fast. It is drawn
            here rather than in the 3D scene because there is no ground plane
            in there to catch one - the grass is a photograph behind the canvas.
          */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-[6%] bottom-[3%] h-[13%] rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.72),rgba(0,0,0,0.42)_42%,transparent_72%)] blur-[7px]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-[26%] bottom-[5.5%] h-[6%] rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.85),transparent_70%)] blur-[3px]"
          />
          <Ball3D progress={progress} />
          {/*
            Grass shadow falling on the ball itself.

            A shadow cast onto the turf is invisible here - the turf is already
            near-black - so the thing that actually seats the ball is the
            darkening across its own underside, where the grass it is sitting in
            blocks the light. Over the canvas rather than under it, for that
            reason.
          */}
          {/*
            Clipped to the ball, or it is a dark band lying across the grass.

            The circle is where the ball actually is in the canvas: the camera
            puts its silhouette at 80.2% of the frame, centred, so half of that
            is the radius.
          */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-20 [clip-path:circle(40.1%_at_50%_50%)]"
          >
            <div className="absolute inset-x-0 bottom-0 h-[26%] bg-[linear-gradient(to_top,rgba(5,11,5,0.80),rgba(5,11,5,0.36)_45%,transparent)]" />
          </div>
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
