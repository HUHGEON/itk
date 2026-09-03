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
      /**
       * Orthographic, because the texture was made by inverting an orthographic
       * projection.
       *
       * Under a perspective lens the near face of a sphere covers more of the
       * frame than the parts turning away from it: with the previous 34-degree
       * lens at 4.2 units, a marking sitting at 0.51 of the photographed disc
       * came out at 0.62 of the rendered one. The star inflated by a fifth, its
       * arms thickened, and the panels around it were shoved off the edge -
       * which is what made the render look nothing like the photograph it was
       * cut from. An orthographic camera is the exact inverse of the unwrap, so
       * the face renders at the size it was shot at.
       *
       * 1.247 keeps the ball the size the old lens drew it: that lens put the
       * silhouette at 0.802 of the half-frame, and 1/1.247 is 0.802.
       */
      const HALF = 1.247;
      const camera = new THREE.OrthographicCamera(-HALF, HALF, HALF, -HALF, 0.1, 100);
      camera.position.set(0, 0, 5);

      // Reflections without shipping an HDRI: three carries a small procedural
      // room for exactly this, used as environment only so the page keeps its
      // own dark ground.
      const { RoomEnvironment } = await import(
        "three/examples/jsm/environments/RoomEnvironment.js"
      );
      const pmrem = new THREE.PMREMGenerator(renderer);
      const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
      scene.environment = env.texture;
      scene.environmentIntensity = 0.34;

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
      const key = new THREE.DirectionalLight(0xfff6e8, 2.05);
      key.position.set(2.5, 4, 3.5);
      scene.add(key);
      const keyHome = key.position.clone();

      // Green bounce from the grass, from below.
      const bounce = new THREE.DirectionalLight(0x9cc47c, 0.42);
      bounce.position.set(-1, -3, 1);
      scene.add(bounce);

      scene.add(new THREE.AmbientLight(0xd6dad4, 0.6));

      // The markings are drawn once into a canvas and used as a map, so the
      // mesh stays a single smooth sphere: the outline is a circle by
      // construction and there are no panel edges to fight the depth buffer.
      /**
       * Where the ball sits in the photograph, found by eye.
       *
       * Automatic detection was tried twice and missed twice: once it measured
       * a row through the shadow and landed 130px off centre, once it counted
       * bright grass as ball. Both times the circle overlapped the turf and
       * grass ended up wrapped onto the middle of the sphere. Drawing the
       * candidate circle back over the photo and looking at it settled it in
       * one pass.
       */
      const photo = await new Promise<HTMLImageElement>((res, rej) => {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.onload = () => res(img);
        img.onerror = rej;
        img.src = "/ball-ucl.jpg";
      });
      if (cancelled) return;

      const painted = document.createElement("canvas");
      unwrapBallPhoto(photo, painted, {
        cx: (562 / 1024) * photo.naturalWidth,
        cy: (348 / 768) * photo.naturalHeight,
        r: (294 / 1024) * photo.naturalWidth,
        // The Champions League star, not the disc's centre. In this shot it
        // sits high and slightly right of middle; naming it here brings it
        // round to face the camera.
        front: {
          x: (575 / 1024) * photo.naturalWidth,
          y: (310 / 768) * photo.naturalHeight,
        },
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
          roughness: 0.72,
          metalness: 0.02,
        }),
      );
      scene.add(ball);

      const fit = () => {
        const r = el.getBoundingClientRect();
        renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false);
        const aspect = r.width / Math.max(1, r.height);
        camera.left = -HALF * aspect;
        camera.right = HALF * aspect;
        camera.top = HALF;
        camera.bottom = -HALF;
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
        /**
         * The ball holds still, and the scene moves instead.
         *
         * Everything that went wrong on this ball went wrong at the moment it
         * turned far enough to show a part that is not in the photograph.
         * Holding the face to camera is the one arrangement with nothing
         * invented in it. The sequence still moves - the shot pushes in, the
         * crests arrive around it - and a ball resting on grass is not a thing
         * that ought to be spinning anyway.
         *
         * It does not drift either. A few degrees of yaw were in here to keep
         * it from reading as a sticker, but the texture is aligned to the
         * camera to the pixel now, and any turn at all slides the compressed
         * rim of the photograph into the face. The light does that job instead.
         */

        /**
         * The light walks across the ball instead of the ball turning under it.
         *
         * A still object under a still light is a photograph, and the scroll has
         * nothing to show for itself. Swinging the key light around the front
         * moves the highlight over the panels and rakes the seams, so the
         * surface reads as three-dimensional and as responding - without ever
         * exposing the half of the ball that was never photographed.
         */
        const swing = (t - 0.5) * 1.8;
        key.position.set(
          keyHome.x * Math.cos(swing) + keyHome.z * Math.sin(swing),
          keyHome.y - t * 1.2,
          -keyHome.x * Math.sin(swing) + keyHome.z * Math.cos(swing),
        );

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
      className="size-[clamp(17rem,56vmin,38rem)]"
    />
  );
}
