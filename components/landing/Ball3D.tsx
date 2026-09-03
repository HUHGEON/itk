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
      const [THREE, { paintBall }] = await Promise.all([
        import("three"),
        import("./ball-pattern"),
      ]);
      if (cancelled) return;

      const renderer = new THREE.WebGLRenderer({
        canvas: el,
        antialias: true,
        alpha: true,
        powerPreference: "low-power",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      /**
       * Film response rather than raw light values.
       *
       * Without tone mapping the renderer writes linear intensity straight out,
       * so the lit side of a white panel clips to flat white and takes the
       * leather grain with it - the ball was brightest exactly where it should
       * have shown the most texture. ACES rolls the highlights off the way a
       * camera does, which keeps the grain alive in the light and lets the key
       * be pushed harder for the shadow side.
       */
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.94;

      // Real shadows: see the ground plane below.
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      const scene = new THREE.Scene();
      /**
       * A normal viewing distance again.
       *
       * While the ball wore a photograph the camera had to stand exactly where
       * the photographer stood, or the render asked the texture for surface the
       * shot never held. The markings are computed now - they cover the whole
       * sphere - so the lens is free, and 4.2 units at 34 degrees is the
       * flattering one: enough perspective to read as an object, not so much
       * that the near face bulges.
       */
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
      scene.environmentIntensity = 0.36;

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
      const key = new THREE.DirectionalLight(0xfff6e8, 2.7);
      key.position.set(2.5, 4, 3.5);
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      /**
       * Wide enough for the whole cast shadow.
       *
       * The light comes in from one side, so the shadow lands well off to the
       * other - at a tight 1.6 the frustum cut straight through it and left a
       * dark shape with a clean edge, which read as a disc lying on the grass
       * rather than as shade. Three units covers where it actually falls.
       */
      key.shadow.camera.near = 1;
      key.shadow.camera.far = 14;
      key.shadow.camera.left = -3;
      key.shadow.camera.right = 3;
      key.shadow.camera.top = 3;
      key.shadow.camera.bottom = -3;
      key.shadow.radius = 7;
      key.shadow.bias = -0.0012;
      scene.add(key);
      const keyHome = key.position.clone();

      // Green bounce from the grass, from below.
      const bounce = new THREE.DirectionalLight(0x9cc47c, 0.3);
      bounce.position.set(-1, -3, 1);
      scene.add(bounce);

            /**
       * Deliberately low.
       *
       * Ambient light reaches every part of the ball equally, so raising it
       * flattens the very thing that makes a sphere read as a sphere. The ball
       * looked lit but not solid because most of its brightness was coming from
       * here rather than from a direction. Enough to keep the shadow side from
       * going black, and no more.
       */
      scene.add(new THREE.AmbientLight(0xd6dad4, 0.34));

      /**
       * A rim from behind, which is what separates the ball from the pitch.
       *
       * The background is a dark blurred field and the ball's shadow side sat
       * straight on top of it with nothing between them, so the outline went
       * soft and the whole thing read as flat. A cool light from behind and
       * above catches just the edge and draws it back out.
       */
      const rim = new THREE.DirectionalLight(0xdce8ff, 1.5);
      rim.position.set(-2.6, 2.2, -3.4);
      scene.add(rim);

      // The markings are drawn once into a canvas and used as a map, so the
      // mesh stays a single smooth sphere: the outline is a circle by
      // construction and there are no panel edges to fight the depth buffer.
      const painted = document.createElement("canvas");
      const surfaced = document.createElement("canvas");
      const relieved = document.createElement("canvas");
      paintBall(painted, surfaced, relieved);

      const map = new THREE.CanvasTexture(painted);
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = renderer.capabilities.getMaxAnisotropy();

      /**
       * How rough each part of the surface is, painted alongside the colour.
       *
       * Left in linear space deliberately: this is a material property, not a
       * colour, and running it through sRGB would bend every value.
       */
      const roughnessMap = new THREE.CanvasTexture(surfaced);
      roughnessMap.anisotropy = map.anisotropy;

      /**
       * The height of the surface, used twice.
       *
       * As a bump map it tilts the shading, which is what makes the leather
       * read as leather and the seams as grooves rather than as lines. As a
       * displacement map it moves the mesh itself, so the seams also break the
       * ball's outline - a real ball is not a perfect circle in silhouette, and
       * that edge is most of what says "object" rather than "picture". Small:
       * two per cent of the radius is a deep enough groove at this size, and
       * more starts to look quilted.
       */
      const reliefMap = new THREE.CanvasTexture(relieved);
      reliefMap.anisotropy = map.anisotropy;

      const ball = new THREE.Mesh(
        // Dense enough for the displacement to have something to move: at the
        // old 128x96 the seams pushed the mesh around in visible facets.
        new THREE.SphereGeometry(1, 320, 240),
        /**
         * Physical rather than standard, for the two things leather does that
         * a plain rough surface does not.
         *
         * `sheen` is the soft glance of light off a fibrous surface - it is
         * what stops the white panels reading as matt plastic at grazing
         * angles. `clearcoat` is the thin sealed layer a match ball actually
         * has: a weak, blurred second reflection over the top, which is where
         * the wet-looking gleam on a real ball comes from.
         */
        new THREE.MeshPhysicalMaterial({
          map,
          roughnessMap,
          // The map carries the real values; this only scales them.
          roughness: 1,
          bumpMap: reliefMap,
          bumpScale: 3.8,
          displacementMap: reliefMap,
          displacementScale: 0.030,
          displacementBias: -0.019,
          // Occlusion from the same height map: the seams are the deepest part
          // of the surface, so they are the part light struggles to reach.
          aoMap: reliefMap,
          aoMapIntensity: 0.7,
          // Restrained. Sheen adds light everywhere it applies, and the dark
          // panels have almost none to spare - at 0.4 they lifted to a milky
          // brown and stopped reading as black at all.
          sheen: 0.11,
          sheenRoughness: 0.9,
          sheenColor: new THREE.Color(0xf2f0ea),
          clearcoat: 0.07,
          clearcoatRoughness: 0.8,
          metalness: 0.02,
        }),
      );
      /**
       * Ambient occlusion reads its own UV set, which a sphere does not have.
       * The relief map is laid out on the same coordinates as everything else,
       * so the main set is simply shared.
       */
      ball.geometry.setAttribute("uv1", ball.geometry.attributes.uv);
      ball.castShadow = true;
      scene.add(ball);

      /**
       * The grass, as something that can only catch a shadow.
       *
       * The pitch behind the ball is a photograph in the page, not geometry, so
       * there was nothing in the scene for the ball to cast onto - which is why
       * the contact had to be faked with a gradient. `ShadowMaterial` draws
       * nothing but the shadow that lands on it, so this plane stays invisible
       * over the photo and only the shade the ball throws comes through. The
       * camera sits almost level with the pitch, the same as the shot behind
       * it, so what shows is a tight dark pool right under the ball.
       */
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 8),
        new THREE.ShadowMaterial({ opacity: 0.42 }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -1.02;
      ground.receiveShadow = true;
      scene.add(ground);
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
         * And now it turns.
         *
         * This is what the computed pattern bought: the markings close all the
         * way round, so there is no far side to expose and no seam to cross.
         * A turn and a quarter over the scroll, which brings a different star
         * to the front than the one you started on.
         */
        ball.rotation.y = t * Math.PI * 2.5;
        ball.rotation.x = -0.10 + t * 0.16;

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
        reliefMap.dispose();
        roughnessMap.dispose();
        env.texture.dispose();
        pmrem.dispose();
        ground.geometry.dispose();
        (ground.material as Material).dispose();
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
      /**
       * Sized against the ring of crests, not against the window.
       *
       * The crests sit on a circle whose radius shrinks to fit whatever shape
       * the window is. Sizing the ball independently meant that on a short or
       * narrow window the ring came in past it and the crests landed on top of
       * the ball. Deriving the diameter from the ring - its radius, less the
       * room a crest and a gap need - keeps the ball inside the circle by
       * construction, at any size. The `56vmin` is the cap for large windows,
       * where the ring is roomy and the ball should stop growing.
       */
      className="size-[min(56vmin,calc((var(--ring,40vmin)_-_3.4rem)_*_2))] [@media(max-height:520px)]:size-[min(56vmin,68dvh)]"
    />
  );
}
