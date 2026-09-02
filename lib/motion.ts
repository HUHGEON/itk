"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  type DependencyList,
  type RefObject,
} from "react";
import { animate } from "animejs";

/**
 * The two rules every animation in the app follows.
 *
 * 1. **The resting state is the CSS state.** An entrance sets its own
 *    from-state from JS — opacity 0, a shifted transform, a collapsed height —
 *    and animates back to whatever the markup already said. So a browser that
 *    never runs the animation still renders the finished page: nothing is
 *    hidden by a class waiting for a script to reveal it.
 *
 * 2. **Motion is asked for, not assumed.** See `reducedMotion` below.
 */

/**
 * Whether the reader has asked for less movement.
 *
 * globals.css already flattens CSS animations and transitions under
 * `prefers-reduced-motion`, and that block does not reach anime.js at all:
 * these are a JS ticker writing inline styles every frame, so there is no
 * `transition-duration` for the `!important` to override. Each animation has to
 * check for itself, and skipping it is safe because of rule 1 above.
 */
export function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * A layout effect that does not warn during server rendering.
 *
 * The from-state has to land before the browser paints. With `useEffect` the
 * row paints where it belongs and then jumps back to the start of its own
 * entrance — a visible flash on every card, every time. `useLayoutEffect` runs
 * in the same frame as the commit, which is the whole point; it just has
 * nothing to do on the server, where React logs a warning for it.
 */
export const useBeforePaint =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Reveals a collapsed element to its natural height, and returns a teardown.
 *
 * Height is the one property here that cannot be animated in CSS, because the
 * target is `auto` and `auto` has no midpoint — which is why every expanding
 * panel on the site snapped open before this. The measurement is taken while
 * the content is already laid out at full size, so it is the real height rather
 * than an estimate.
 *
 * `overflow` is forced for the duration and both properties are dropped on
 * completion: an element left at a pinned pixel height would stop responding to
 * a window resize or a late-loading image.
 */
export function expand(el: HTMLElement, opts: { duration?: number } = {}) {
  const height = el.scrollHeight;
  const overflow = el.style.overflow;
  el.style.overflow = "hidden";

  const anim = animate(el, {
    height: [0, height],
    opacity: [0, 1],
    duration: opts.duration ?? 260,
    ease: "outQuad",
    onComplete: () => {
      el.style.overflow = overflow;
      el.style.height = "";
      el.style.opacity = "";
    },
  });

  // Torn down explicitly rather than trusting revert() to land on the resting
  // state: an element left at a pinned height is invisible until the window
  // resizes, and that is a bad way to find out.
  return () => {
    anim.revert();
    el.style.overflow = overflow;
    el.style.height = "";
    el.style.opacity = "";
  };
}

/**
 * Acknowledges a press on a control that navigates.
 *
 * A filter chip pushes a new URL, and that is a server round trip — a few
 * hundred milliseconds before anything on screen changes. The bar dims as a
 * whole while it is in flight, which answers "is something loading" but not
 * "which one did I press", and on a rail of twenty club crests those are
 * different questions. The dip happens on the click itself, before the
 * navigation has gone anywhere.
 */
export function pressPop(el: HTMLElement) {
  if (reducedMotion()) return;
  animate(el, {
    scale: [1, 0.93, 1.03, 1],
    duration: 420,
    ease: "outQuad",
  });
}

/**
 * Runs an element's text from one number to another.
 *
 * The badges count what is behind each filter, so they all change at once when
 * a filter does — every league tab and every club chip lands on a new number in
 * the same frame. Swapped outright it reads as a re-render; run up or down it
 * reads as the answer moving, and a badge that barely shifts stops competing
 * for attention with one that doubles.
 */
export function rollNumber(el: HTMLElement, from: number, to: number) {
  // Rewinding to the start value is this function's job, not the caller's. Doing
  // it at the call site left every badge frozen on its previous number under
  // reduced motion: the text had already been wound back when this returned
  // early, and nothing wound it forward again.
  if (reducedMotion() || from === to) return;
  el.textContent = String(from);
  const tick = { v: from };
  animate(tick, {
    v: to,
    duration: 520,
    ease: "outExpo",
    onUpdate: () => {
      el.textContent = String(Math.round(tick.v));
    },
    // An eased tween lands a hair short often enough to leave a badge one off
    // the number the feed below it actually holds.
    onComplete: () => {
      el.textContent = String(to);
    },
  });
}

/**
 * Runs an animation the first time an element is actually on screen.
 *
 * Landing sections are mostly below the fold, so playing on mount means the
 * whole page finishes animating before the reader has scrolled to any of it.
 * `prepare` runs before paint and sets the from-state; `play` runs once the
 * section is in view. Both are skipped under reduced motion, which leaves the
 * markup at its resting state - the finished layout.
 *
 * IntersectionObserver rather than a scroll listener: a scroll handler fires on
 * every frame of every scroll, for a question that has one answer per element.
 */
export function useReveal<T extends HTMLElement>(
  prepare: (root: T) => void,
  play: (root: T) => void,
  deps: DependencyList = [],
): RefObject<T | null> {
  const ref = useRef<T>(null);

  useBeforePaint(() => {
    const el = ref.current;
    if (!el || reducedMotion()) return;

    prepare(el);

    if (typeof IntersectionObserver === "undefined") {
      play(el);
      return;
    }

    let done = false;
    const finish = (run: (root: T) => void) => {
      if (done) return;
      done = true;
      io.disconnect();
      stopSafety();
      run(el);
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) finish(play);
      },
      // A little into the viewport, so the motion is seen starting rather than
      // being already half over by the time the section is readable.
      { threshold: 0.15 },
    );
    io.observe(el);

    /**
     * The observer alone loses content.
     *
     * IntersectionObserver only reports a *change* in intersection. Drag the
     * scrollbar from the top of the page to the bottom and a mid-page section
     * goes from below the viewport to above it without ever being inside it:
     * not-intersecting to not-intersecting, no change, no callback. The section
     * stays at the opacity 0 that `prepare` set, forever. Measured: after one
     * scrollbar drag the reporter list was an empty band.
     *
     * So anything the viewport has already passed is dropped straight into its
     * finished state. This is a one-second poll rather than a listener: it is
     * not the banned per-frame scroll handler, it costs one rect read a second,
     * and it stops the moment the section resolves either way. A `scrollend`
     * listener was tried first and measured as never firing here.
     */
    const poll = window.setInterval(() => {
      if (el.getBoundingClientRect().bottom < 0) {
        finish(settle as (r: T) => void);
      }
    }, 1000);
    function stopSafety() {
      window.clearInterval(poll);
    }

    return () => {
      io.disconnect();
      stopSafety();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

/**
 * Drops every from-state this module writes, with no animation.
 *
 * The entrance styles are always inline `opacity` and `transform`, so clearing
 * those two returns the subtree to what the stylesheet says — which is the
 * finished layout, by rule 1 at the top of this file.
 */
function settle(root: HTMLElement) {
  for (const el of root.querySelectorAll<HTMLElement>("*")) {
    if (el.style.opacity) el.style.opacity = "";
    if (el.style.transform) el.style.transform = "";
  }
  for (const n of root.querySelectorAll<HTMLElement>("[data-n]")) {
    if (n.dataset.n) n.textContent = n.dataset.n;
  }
}
