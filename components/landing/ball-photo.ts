/**
 * Wraps a straight-on photograph of a ball around a sphere.
 *
 * A camera sees a sphere as a disc, and that projection inverts: a pixel at
 * (nx, ny) from the centre of the disc, in units of its radius, looks at
 * (nx, ny, sqrt(1 - nx^2 - ny^2)) on the ball. Run it backwards per texel and
 * the photograph goes back onto the shape it came off.
 *
 * Two things are not in the photograph, and they are handled differently.
 *
 * The far side is easy: under this projection front and back share the same
 * pixels, so the sphere is covered by repeating what was photographed. The
 * middle of the disc is used, never the rim - at the rim the surface turns away
 * from the camera and a few pixels smear across a wide band of sphere.
 *
 * The poles are not solved here at all. They sit at the very top and bottom of
 * the disc, the worst part of the projection, and no folding fixes that without
 * squashing the pattern instead. They are hidden by the camera instead: the
 * ball is rendered with almost no tilt, so its poles stay at the silhouette's
 * top and bottom edge where they are barely a few pixels. That is what buys a
 * full rotation on the vertical axis, which is the one that reads as rolling.
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
 * How many copies of the photographed hemisphere go around the equator, and how
 * much of it each copy uses.
 *
 * SPAN is the half-angle sampled either side of the photograph's centre. Two
 * copies, not four, because the fold below already halves each one: a 180
 * degree segment spends 90 going and 90 returning, and 90 degrees of sphere
 * takes 90 degrees of photograph one to one. With four copies the same 90
 * degrees got squeezed into 45 and every star came out stretched.
 */
const COPIES = 2;
const SPAN = Math.PI / 4;

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
  const seg = (Math.PI * 2) / COPIES;

  for (let ty = 0; ty < out.height; ty++) {
    const theta = (ty / out.height) * Math.PI;
    const dy = Math.cos(theta);
    const st = Math.sin(theta);

    for (let tx = 0; tx < out.width; tx++) {
      const phi = (tx / out.width) * Math.PI * 2;

      // Fold longitude into one copy, then into the photograph's dense middle.
      // Each segment is walked out and back, so neighbouring copies meet as a
      // mirror rather than as a jump.
      let u = (phi % seg) / seg;
      u = u < 0.5 ? u * 2 : (1 - u) * 2;
      const lon = (u - 0.5) * 2 * SPAN;

      const dx = st * Math.sin(lon);
      const px = Math.round(opts.cx + dx * opts.r);
      const py = Math.round(opts.cy - dy * opts.r);
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
