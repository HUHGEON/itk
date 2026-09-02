"use client";

import { useEffect, useRef } from "react";
import { reducedMotion } from "@/lib/motion";

/**
 * The ball, rendered live.
 *
 * three.js is ~132kB gzipped, which is most of a page budget, so it is loaded
 * only when this component mounts and only on /about. The feed never pays for
 * it. Under reduced motion nothing is loaded at all and the still image below
 * is what the reader gets.
 *
 * `progress` is 0 at the top of the sequence and 1 at the end. The parent owns
 * it, because the parent is the thing tied to the scrollbar.
 */
export function Ball3D({ progress }: { progress: { current: number } }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el || reducedMotion()) return;

    let raf = 0;
    let stop: (() => void) | null = null;
    let cancelled = false;

    void (async () => {
      const [{ createBall, createStage }, { Vector3 }] = await Promise.all([
        import("./ball-geometry"),
        import("three"),
      ]);
      if (cancelled) return;

      const stage = createStage(el);
      const ball = createBall(1);
      stage.scene.add(ball.group);

      const fit = () => {
        const r = el.getBoundingClientRect();
        stage.resize(Math.max(1, r.width), Math.max(1, r.height));
      };
      fit();
      const ro = new ResizeObserver(fit);
      ro.observe(el);

      // Each panel drifts out along its own outward axis as the sequence runs,
      // so the ball comes apart the way a real one would if the stitching went.
      const home = ball.panels.map((p) => p.position.clone());
      const axis = ball.panels.map(
        (p) => (p.userData.dir as InstanceType<typeof Vector3>).clone(),
      );

      const tick = () => {
        // The sequence completes at 78% of the scroll and holds. Finishing
        // exactly as the sticky stage releases meant the assembled state was
        // never actually seen: it arrived and the page moved on in the same
        // gesture.
        const raw = Math.min(1, Math.max(0, progress.current));
        const t = Math.min(1, raw / 0.78);
        ball.group.rotation.y = t * Math.PI * 4 + 0.6;
        ball.group.rotation.x = -0.22 + t * 0.5;

        // Hold together for the first half, then separate.
        const burst = Math.max(0, (t - 0.5) / 0.5);
        // The dark core exists to fill the seams; once the panels leave there
        // are no seams, and a black sphere hanging in the middle of the burst
        // reads as a hole rather than as a ball coming apart.
        const core = ball.group.children[0];
        core.scale.setScalar(Math.max(0.001, 1 - burst));
        for (let i = 0; i < ball.panels.length; i++) {
          ball.panels[i].position
            .copy(home[i])
            .addScaledVector(axis[i], burst * 1.15);
        }

        stage.renderer.render(stage.scene, stage.camera);
        raf = requestAnimationFrame(tick);
      };
      tick();

      stop = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        stage.dispose();
      };
    })();

    return () => {
      cancelled = true;
      stop?.();
    };
  }, [progress]);

  return (
    <canvas
      ref={canvas}
      aria-hidden
      className="size-[clamp(16rem,42vmin,30rem)]"
    />
  );
}
