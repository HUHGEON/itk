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
 * The opening sequence: a ball on the grass, then every club out of it.
 *
 * Built the way animejs.com builds its own hero, which was worth measuring
 * before copying: a tall wrapper holds a sticky viewport-sized stage, so the
 * page keeps scrolling while the stage stays put and its contents are driven by
 * scroll position. Their stage renders a 3D model in a WebGL2 canvas; so does
 * this one, except the model is generated rather than downloaded.
 *
 * The pitch is laid down in perspective rather than painted flat. A vertical
 * gradient of stripes reads as wallpaper; the same stripes tilted away from the
 * camera read as ground, and that is most of the difference between a
 * background and a place.
 */

/** How many screens of scroll the sequence occupies. */
const STAGE_SCREENS = 4;
/** Radius of the ring the crests settle on, as a share of the shorter side. */
const RING = 0.42;

export function PitchSequence({ teams }: { teams: Team[] }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const shadow = useRef<HTMLDivElement>(null);
  /** 0 at the top of the sequence, 1 at the end. Read by the WebGL loop. */
  const progress = useRef(0);

  useBeforePaint(() => {
    const wrap = wrapper.current;
    const stageEl = stage.current;
    const copyEl = copy.current;
    if (!wrap || !stageEl || reducedMotion()) return;

    const crests = Array.from(
      stageEl.querySelectorAll<HTMLElement>("[data-crest]"),
    );
    const scrub = () => onScroll({ target: wrap, sync: true });

    // One scrubbed value drives the 3D scene. The canvas cannot be animated by
    // anime.js directly, so anime owns the number and the render loop reads it.
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
     * A hold at the front of every track.
     *
     * The stage is the first thing on the page, so at scroll 0 the wrapper has
     * already travelled a viewport's worth of its own window and the scrub sits
     * about a quarter in. Measured: the crests were 56% out of the ball before
     * the reader had touched the wheel. Percentage keyframes buy that quarter
     * back as a hold, so the first screen is a ball on grass and nothing else.
     */
    const pull = (i: number) => {
      const a = (i / crests.length) * Math.PI * 2 - Math.PI / 2;
      const r = Math.min(stageEl.clientWidth, stageEl.clientHeight) * RING;
      return { x: -Math.cos(a) * r, y: -Math.sin(a) * r };
    };

    const burst = animate(crests, {
      keyframes: {
        "0%": {
          opacity: 0, scale: 0, rotate: -90,
          x: (_t: unknown, i?: number) => pull(i ?? 0).x,
          y: (_t: unknown, i?: number) => pull(i ?? 0).y,
        },
        "34%": {
          opacity: 0, scale: 0, rotate: -90,
          x: (_t: unknown, i?: number) => pull(i ?? 0).x,
          y: (_t: unknown, i?: number) => pull(i ?? 0).y,
        },
        "78%": { opacity: 1, scale: 1, rotate: 0, x: 0, y: 0 },
        // Holds from here to the end of the wrapper, so the assembled ring stays
        // on screen for a beat instead of finishing exactly as the stage lets go.
        "100%": { opacity: 1, scale: 1, rotate: 0, x: 0, y: 0 },
      },
      ease: "outQuad",
      delay: stagger(26),
      autoplay: scrub(),
    });

    // The contact shadow tightens and fades as the ball lifts and comes apart.
    const shade = shadow.current
      ? animate(shadow.current, {
          keyframes: {
            "0%": { opacity: 0.55, scaleX: 1, scaleY: 1 },
            "50%": { opacity: 0.4, scaleX: 0.8, scaleY: 0.8 },
            "100%": { opacity: 0, scaleX: 0.4, scaleY: 0.4 },
          },
          ease: "linear",
          autoplay: scrub(),
        })
      : null;

    const line = copyEl
      ? animate(copyEl, {
          keyframes: {
            "0%": { opacity: 1, y: 0 },
            "30%": { opacity: 1, y: 0 },
            "48%": { opacity: 0, y: 28 },
            "100%": { opacity: 0, y: 28 },
          },
          ease: "linear",
          autoplay: scrub(),
        })
      : null;

    return () => {
      driver.revert();
      burst.revert();
      shade?.revert();
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
        {/* Real grass, because drawn grass is not grass.
            A tilted stripe gradient reads as a diagram of a pitch rather than
            as a pitch: it has the stripes and none of the texture, and that is
            what makes it look like a court drawing. This is a CC0 photograph of
            a mown surface with a touchline in it, darkened hard so the page
            keeps its own near-black palette and the ball stays the brightest
            thing on screen. */}
        <div aria-hidden className="absolute inset-0">
          <Image
            src="/pitch.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="scale-[1.18] object-cover object-[86%_center]"
          />
        </div>
        {/* Darkened toward the top so the grass falls away into the page rather
            than stopping at a hard edge. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(7,8,6,0.97) 0%, rgba(7,8,6,0.72) 30%, rgba(7,8,6,0.42) 58%, rgba(7,8,6,0.66) 100%)",
          }}
        />
        {/* A pool of light where the ball sits. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(46% 34% at 50% 46%, rgba(190,235,195,0.13), transparent 70%)",
          }}
        />

        {teams.map((t, i) => {
          // The ring is CSS, not JS. With no script running the stage is a ball
          // inside a ring of clubs, which is the finished picture.
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
                className="flex size-[clamp(3.2rem,7vw,4.4rem)] items-center justify-center rounded-full border border-white/10 bg-black/55 backdrop-blur-sm transition-colors hover:border-accent/60"
              >
                <TeamCrest team={t} size={32} />
              </Link>
            </div>
          );
        })}

        {/* Nudged up from centre so the ball sits on the ground plane rather
            than hovering over it, with the contact shadow directly beneath. */}
        <div className="relative z-10 -translate-y-[6vh]">
          <Ball3D progress={progress} />
          <div
            ref={shadow}
            aria-hidden
            className="absolute bottom-[6%] left-1/2 h-[3vmin] w-[22vmin] -translate-x-1/2 rounded-[50%]"
            style={{
              background:
                "radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,0.85), transparent 70%)",
            }}
          />
        </div>

        <div
          ref={copy}
          className="pointer-events-none absolute inset-x-0 bottom-[9vh] z-30 px-[var(--gutter)] text-center"
        >
          <h1 className="text-[2.2rem] leading-[1.1] font-bold tracking-tight text-text sm:text-5xl">
            <span className="text-accent">저자</span>를 보고 읽는 이적 소식
          </h1>
          <p className="mx-auto mt-4 max-w-[38ch] text-[14px] text-muted sm:text-[15px]">
            유럽 17개 구단, 해외 기자 244명.
          </p>
        </div>
      </div>
    </div>
  );
}
