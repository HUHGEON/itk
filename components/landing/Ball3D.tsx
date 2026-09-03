"use client";

import { useEffect, useRef } from "react";
import type { Material } from "three";
import { reducedMotion } from "@/lib/motion";

/**
 * The ball: one smooth sphere wearing a computed texture, spun by the scrollbar.
 *
 * three.js is ~132kB gzipped, so it is imported only when this mounts and only
 * on /about. The feed never pays for it, and under reduced motion it is never
 * fetched at all.
 *
 * `progress` runs 0 to 1 across the sequence. The parent owns it because the
 * parent is what is tied to the scrollbar.
 */
export function Ball3D({ progress }: { progress: { current: number } }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el || reducedMotion()) return;

    let stop: (() => void) | null = null;
    let cancelled = false;

    void (async () => {
      const [THREE, { unwrapBallPhoto }] = await Promise.all([
        import("three"),
        import("./ball-photo"),
      ]);
      if (cancelled) return;

      const renderer = new THREE.WebGLRenderer({
        canvas: el,
        antialias: true,
        alpha: true,
        powerPreference: "low-power",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
      camera.position.set(0, 0, 4.2);

      // Reflections without shipping an HDRI: three carries a small procedural
      // room for exactly this, used as environment only so the page keeps its
      // own dark ground.
      const { RoomEnvironment } = await import(
        "three/examples/jsm/environments/RoomEnvironment.js"
      );
      const pmrem = new THREE.PMREMGenerator(renderer);
      const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
      scene.environment = env.texture;
      scene.environmentIntensity = 0.22;

      /**
       * Lit for the plate it sits on, not for a studio.
       *
       * The ball was lit as if for a product shot while the background is a
       * floodlit pitch at night, so it came out brighter than everything around
       * it and read as a cut-out pasted on. Three changes fix the join: the key
       * comes down to roughly the brightness of the grass, the ambient is
       * tinted with the green bouncing off it, and a dim up-light stands in for
       * the pitch throwing light back at the underside.
       */
      const key = new THREE.DirectionalLight(0xffeedd, 1.05);
      key.position.set(2.5, 4, 3.5);
      scene.add(key);

      // Green bounce from the grass, from below.
      const bounce = new THREE.DirectionalLight(0x86b06a, 0.5);
      bounce.position.set(-1, -3, 1);
      scene.add(bounce);

      scene.add(new THREE.AmbientLight(0x9fb59a, 0.32));

      // The markings are drawn once into a canvas and used as a map, so the
      // mesh stays a single smooth sphere: the outline is a circle by
      // construction and there are no panel edges to fight the depth buffer.
      const photo = await new Promise<HTMLImageElement>((res, rej) => {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.onload = () => res(img);
        img.onerror = rej;
        img.src = "/ball-photo.jpg";
      });
      if (cancelled) return;

      /**
       * Where the ball sits in the source, checked by eye rather than trusted.
       *
       * Two automatic passes both got this wrong - one measured a row through
       * the shadow and came out 130px off centre - and the result was a circle
       * that overlapped the grass, so grass got wrapped onto the middle of the
       * ball. Drawing the candidate circle back over the photograph and looking
       * at it settled it in one go: centre (419, 251), radius 240 in a 773x580
       * frame.
       */
      const painted = document.createElement("canvas");
      unwrapBallPhoto(photo, painted, {
        cx: (419 / 773) * photo.naturalWidth,
        cy: (251 / 580) * photo.naturalHeight,
        r: (240 / 773) * photo.naturalWidth,
      });

      const map = new THREE.CanvasTexture(painted);
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = renderer.capabilities.getMaxAnisotropy();

      // Grain over the photograph: a 773px source stretched over a sphere is
      // smoother than the object it came from. CC0 scans from ambientCG.
      const loader = new THREE.TextureLoader();
      const tile = (url: string) => {
        const t = loader.load(url);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(4, 2);
        t.anisotropy = map.anisotropy;
        return t;
      };
      const normalMap = tile("/tex/leather-normal.jpg");
      const roughnessMap = tile("/tex/leather-rough.jpg");

      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(1, 128, 96),
        new THREE.MeshStandardMaterial({
          map,
          normalMap,
          normalScale: new THREE.Vector2(0.5, 0.5),
          roughnessMap,
          roughness: 0.58,
          metalness: 0.02,
        }),
      );
      scene.add(ball);

      const fit = () => {
        const r = el.getBoundingClientRect();
        renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false);
        camera.aspect = r.width / Math.max(1, r.height);
        camera.updateProjectionMatrix();
      };
      fit();
      const ro = new ResizeObserver(fit);
      ro.observe(el);

      let raf = 0;
      const tick = () => {
        // Completes at half the scroll and holds: the sticky stage releases
        // well before the scrub reaches 1, so anything finishing late finishes
        // off screen.
        /**
         * A full turn and a half, which the photograph could not give.
         *
         * A wrapped photo of a real ball was tried and dropped: a camera only
         * sees one hemisphere, so the far side has to be invented, and the
         * moment the ball turns past 90 degrees the invented half swings into
         * view and smears. Choosing between "looks real" and "can rotate" is
         * not a choice worth making when the markings can simply be computed
         * for the whole sphere.
         */
        const t = Math.min(1, Math.max(0, progress.current) / 0.5);
        ball.rotation.y = t * Math.PI * 3 + 0.5;
        /**
         * Almost no tilt, on purpose.
         *
         * The poles are the one part a wrapped photograph cannot supply. Keep
         * the axis upright and they stay pinned to the top and bottom of the
         * silhouette, a few pixels each, while the vertical spin - the one that
         * reads as rolling - runs all the way round.
         */
        ball.rotation.x = -0.04;
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      tick();

      stop = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        map.dispose();
        normalMap.dispose();
        roughnessMap.dispose();
        env.texture.dispose();
        pmrem.dispose();
        ball.geometry.dispose();
        (ball.material as Material).dispose();
        renderer.dispose();
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
      className="size-[clamp(15rem,38vmin,27rem)]"
    />
  );
}
