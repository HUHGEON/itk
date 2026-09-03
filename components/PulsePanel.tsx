"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { animate, stagger, utils } from "animejs";
import type { Pulse } from "@/lib/feed";
import { ALL_TIERS } from "@/lib/types";
import { tierColor, tierLabel, timeAgo } from "@/lib/format";
import { reducedMotion, useBeforePaint } from "@/lib/motion";

/**
 * The last 24 hours as one bar.
 *
 * The sidebar ran out of content halfway down the page, and a feed sorted by
 * time tells you what just happened but not what the day looked like. The
 * segments are the tier colours the rest of the app uses, so the shape of the
 * bar reads as "mostly rumour" or "a real 0-tier day" without a legend — and
 * each one is a link into that filter.
 *
 * The bar and the legend under it are one object, which the static version
 * never managed to say: five colours in a 6px strip and five colours in a list
 * is a matching puzzle at that size. Pointing at a row now dims every segment
 * but its own and opens the bar up, so the pairing is answered by looking
 * rather than by comparing swatches.
 */

/** Segment growth and count-up run on the same clock. */
const DRAW_MS = 760;
const STEP_MS = 70;

/** Resting and engaged heights of the bar, in px — `h-1.5` is the resting one. */
const BAR_REST = 6;
const BAR_OPEN = 10;

export function PulsePanel({ pulse, now }: { pulse: Pulse; now: number }) {
  const tiers = ALL_TIERS.map((t) => ({
    tier: t,
    n: pulse.byTier[String(t)] ?? 0,
  })).filter((s) => s.n > 0);

  const ranked = pulse.total - pulse.official;

  const root = useRef<HTMLElement>(null);
  const [lit, setLit] = useState<number | null>(null);

  /**
   * The numbers themselves, not the object holding them.
   *
   * `pulse` is rebuilt by the server on every render, so keying the draw on it
   * replayed the whole bar each time a filter chip was pressed — and the last
   * 24 hours do not depend on the filter, so the same five numbers redrew from
   * zero while the reader was looking at something else entirely.
   */
  const pulseKey = JSON.stringify([pulse.total, pulse.official, pulse.byTier]);

  /**
   * The bar draws itself in, and the counts run up to meet it.
   *
   * Deliberately `scaleX` rather than `width`: the segments are flex items, so
   * animating width would reflow the whole strip sixty times a second and drag
   * its neighbours along with it. Scaling leaves the layout alone — each
   * segment fills the space it already owns.
   *
   * It waits to be seen. Below `lg` the rail is a drawer: present from the
   * first paint but translated out of the viewport, so an entrance on mount
   * plays to nobody and the bar is already finished by the time the drawer
   * opens. A transform moving an element back into view does re-trigger
   * IntersectionObserver, so one guard covers both layouts.
   */
  useBeforePaint(() => {
    const el = root.current;
    if (!el || reducedMotion()) return;

    const segments = Array.from(el.querySelectorAll<HTMLElement>("[data-seg]"));
    const counts = Array.from(el.querySelectorAll<HTMLElement>("[data-count]"));
    if (segments.length === 0) return;

    // The from-state lives here, not in the markup, so that a browser which
    // never runs this still renders a finished bar with real numbers in it.
    utils.set(segments, { scaleX: 0 });
    for (const c of counts) c.textContent = "0";

    const running: { revert: () => void }[] = [];

    const play = () => {
      running.push(
        animate(segments, {
          scaleX: 1,
          duration: DRAW_MS,
          ease: "outExpo",
          delay: stagger(STEP_MS),
        }),
      );

      for (const [i, c] of counts.entries()) {
        const to = Number(c.dataset.count);
        if (!Number.isFinite(to)) continue;
        const tick = { v: 0 };
        running.push(
          animate(tick, {
            v: to,
            duration: DRAW_MS,
            ease: "outExpo",
            delay: i * STEP_MS,
            onUpdate: () => {
              c.textContent = String(utils.round(tick.v, 0));
            },
            // The last frame of an eased tween lands a hair short often enough
            // to leave a headline count one off its own total.
            onComplete: () => {
              c.textContent = String(to);
            },
          }),
        );
      }
    };

    const stop = () => {
      for (const a of running) a.revert();
      for (const c of counts) c.textContent = c.dataset.count ?? "";
    };

    if (typeof IntersectionObserver === "undefined") {
      play();
      return stop;
    }

    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      play();
    });
    io.observe(el);

    return () => {
      io.disconnect();
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulseKey]);

  // Pointer or keyboard on a legend row. Skipped until something is actually
  // lit, so an untouched panel carries no inline styles at all.
  const touched = useRef(false);
  useEffect(() => {
    const el = root.current;
    if (!el || reducedMotion()) return;
    if (!touched.current) {
      if (lit === null) return;
      touched.current = true;
    }

    const segments = Array.from(el.querySelectorAll<HTMLElement>("[data-seg]"));
    const bar = el.querySelector<HTMLElement>("[data-bar]");
    if (segments.length === 0 || !bar) return;

    animate(segments, {
      opacity: (_target, i) => (lit === null || lit === i ? 1 : 0.2),
      duration: 220,
      ease: "outQuad",
    });
    animate(bar, {
      height: lit === null ? BAR_REST : BAR_OPEN,
      duration: 260,
      ease: "outBack",
    });
  }, [lit]);

  if (ranked === 0) return null;

  return (
    <section
      ref={root}
      className="border-b border-border px-[var(--gutter)] py-3"
      onMouseLeave={() => setLit(null)}
    >
      <div className="flex items-baseline justify-between">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold">
          <span
            aria-hidden
            className="h-[13px] w-[3px] rounded-full"
            style={{ background: "var(--ribbon)" }}
          />
          최근 24시간
        </h2>
        <span className="tnum text-[11px] text-faint">
          <span data-count={pulse.total}>{pulse.total}</span>건
        </span>
      </div>

      <div
        data-bar
        className="mt-2.5 flex h-1.5 overflow-hidden rounded-full bg-surface-3"
        role="img"
        aria-label={tiers
          .map((s) => `${tierLabel(s.tier)} ${s.n}건`)
          .join(", ")}
      >
        {tiers.map((s) => (
          <span
            key={s.tier}
            data-seg
            // Grows from the left edge it already sits against, so a staggered
            // draw reads as one bar filling rather than five bars appearing.
            className="origin-left"
            style={{
              width: `${(s.n / ranked) * 100}%`,
              backgroundColor: tierColor(s.tier),
            }}
          />
        ))}
      </div>

      <ul className="mt-2.5 space-y-1">
        {tiers.map((s, i) => (
          <li key={s.tier}>
            <Link
              href={`/feed?tier=${s.tier}`}
              onMouseEnter={() => setLit(i)}
              // Same signal without a pointer: tabbing the legend walks the bar.
              onFocus={() => setLit(i)}
              onBlur={() => setLit(null)}
              className="group flex items-center gap-2 text-[12px]"
            >
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-[2px] transition-transform duration-150 group-hover:scale-125"
                style={{ backgroundColor: tierColor(s.tier) }}
              />
              <span className="flex-1 text-muted transition-colors group-hover:text-text">
                {tierLabel(s.tier)}
              </span>
              <span className="tnum text-text/80" data-count={s.n}>
                {s.n}
              </span>
            </Link>
          </li>
        ))}
        {pulse.official > 0 && (
          <li className="flex items-center gap-2 text-[12px]">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: "var(--official)" }}
            />
            {/* Outside the bar as well as outside the ladder — the bar is
                scaled to the ranked total, so this row has no segment to
                light and stays inert. */}
            <span className="flex-1 text-muted">구단 공식</span>
            <span className="tnum text-text/80" data-count={pulse.official}>
              {pulse.official}
            </span>
          </li>
        )}
      </ul>

      {pulse.lastCollect && (
        <p className="mt-2.5 border-t border-border pt-2 text-[10.5px] text-faint">
          마지막 수집 {timeAgo(pulse.lastCollect, now)}
        </p>
      )}
    </section>
  );
}
