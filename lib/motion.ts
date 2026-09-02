"use client";

import { useEffect, useLayoutEffect } from "react";
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
