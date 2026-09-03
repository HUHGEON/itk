/**
 * Puts one photograph of a ball onto a sphere, front-on.
 *
 * A camera sees a sphere as a disc, and that projection inverts: a pixel at
 * (nx, ny) from the centre of the disc, in units of its radius, is looking at
 * (nx, ny, sqrt(1 - nx^2 - ny^2)) on the ball. Run it backwards per texel and
 * the photograph goes back onto the shape it came off.
 *
 * That is the whole of what a photograph can give, and the rest of this file is
 * about not pretending otherwise.
 *
 * A single shot holds one hemisphere. Three earlier attempts tried to cover the
 * sphere anyway:
 *
 *  - Repeat the hemisphere and mirror the join. The mirror folds the pattern
 *    onto itself: half a star meets its own reflection, the round red stamp
 *    prints over itself.
 *  - Repeat it four times, more narrowly. Same fold, and the pattern is
 *    squeezed as well.
 *  - Use three photographs, one per 120 degree arc. No mirror, but the three
 *    were shot at unrelated angles, so the pattern does not continue across a
 *    join. Cross-fading the joins only blurred both sides into a double
 *    exposure - which is exactly what it looked like.
 *
 * All three fail for the same reason: the far side of the ball is not in the
 * data, and inventing it is visible the moment the ball turns. So it does not
 * turn. The face is what was photographed, the camera stays on it, and the
 * sequence gets its movement from the scene instead - the shot pushing in, the
 * crests arriving, the light moving. The half that cannot be shown is never
 * shown.
 */

export interface PhotoBallOptions {
  /** Centre of the ball in the photograph, in pixels. */
  cx: number;
  cy: number;
  /** Radius of the ball in the photograph, in pixels. */
  r: number;
  /** Texture width; height is half of it. */
  size?: number;
}

/**
 * How much of the disc's radius is sampled.
 *
 * At the very edge the surface turns away from the camera and the last pixels
 * are grass and shadow rather than ball. At full radius the poles came out
 * green: turf wrapped onto the top and bottom of the sphere.
 */
const SAFE = 0.96;

export function unwrapBallPhoto(
  photo: HTMLImageElement,
  out: HTMLCanvasElement,
  opts: PhotoBallOptions,
): void {
  const size = opts.size ?? 2048;
  out.width = size;
  out.height = size / 2;
  const octx = out.getContext("2d");
  if (!octx) return;

  const src = document.createElement("canvas");
  src.width = photo.naturalWidth;
  src.height = photo.naturalHeight;
  const sctx = src.getContext("2d", { willReadFrequently: true });
  if (!sctx) return;
  sctx.drawImage(photo, 0, 0);
  const sd = sctx.getImageData(0, 0, src.width, src.height).data;

  const image = octx.createImageData(out.width, out.height);
  const data = image.data;
  const r = opts.r * SAFE;

  for (let ty = 0; ty < out.height; ty++) {
    const theta = (ty / out.height) * Math.PI;
    const dy = Math.cos(theta);
    const st = Math.sin(theta);

    for (let tx = 0; tx < out.width; tx++) {
      // Longitude runs the full circle, and both halves read the same pixels:
      // under this projection the far side of the sphere maps to the same disc
      // as the near side. Since the camera never leaves the front, the back
      // being a copy is never seen.
      /**
       * Longitude, measured from the face the camera sees.
       *
       * SphereGeometry starts its u coordinate on -x and runs anticlockwise, so
       * the point facing a camera on +z is u = 0.25, not u = 0.5. Centring the
       * photograph on 0.5 put its 45-degree edge dead in front of the lens -
       * the compressed rim of the disc, stretched across the middle of the
       * face. That is what the smeared ball was.
       */
      const phi = (tx / out.width) * Math.PI * 2;
      let a = phi - Math.PI / 2;
      if (a > Math.PI) a -= Math.PI * 2;
      if (a < -Math.PI) a += Math.PI * 2;
      /**
       * No compression. This is the plain inverse of the projection.
       *
       * Squeezing longitude into a narrower slice of the photograph seemed like
       * a way to avoid the disc's rim, but it scales one axis and not the
       * other: the markings get stretched sideways relative to their height and
       * the stars buckle. That was the "broken" ball. Latitude is already read
       * straight off cos(theta), so longitude has to be too, and the rim is
       * kept out of frame by SAFE alone.
       */
      const dx = st * Math.sin(a);

      const px = Math.round(opts.cx + dx * r);
      const py = Math.round(opts.cy - dy * r);
      const o = (ty * out.width + tx) * 4;

      if (px < 0 || py < 0 || px >= src.width || py >= src.height) {
        data[o] = 232; data[o + 1] = 230; data[o + 2] = 224; data[o + 3] = 255;
        continue;
      }
      const s = (py * src.width + px) * 4;
      data[o] = sd[s];
      data[o + 1] = sd[s + 1];
      data[o + 2] = sd[s + 2];
      data[o + 3] = 255;
    }
  }

  octx.putImageData(image, 0, 0);
}
