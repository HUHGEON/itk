/**
 * Builds a sphere texture from several photographs of the same ball.
 *
 * A camera sees a sphere as a disc, and that projection inverts: a pixel at
 * (nx, ny) from the centre of the disc, in units of its radius, is looking at
 * (nx, ny, sqrt(1 - nx^2 - ny^2)) on the ball. Run it backwards per texel and a
 * photograph goes back onto the shape it came off.
 *
 * One photograph is not enough, and the failure is specific. It holds one
 * hemisphere, so covering a sphere means repeating that half; repeating needs a
 * seam; and a mirrored seam folds the pattern back onto itself - half a star
 * against its own reflection, the round red stamp overlapping itself. Rotate
 * the ball and that seam swings to the front. No amount of choosing where to
 * put it helps, because it only decides which part gets mangled.
 *
 * Three photographs of three different faces remove the need to repeat at all.
 * The equator is split into three 120 degree arcs and each arc is filled from
 * its own shot, sampling 60 degrees either side of that shot's centre - which
 * is exactly 120 degrees of ball, so nothing is stretched or squeezed. The
 * joins are still there, but they are joins between different real surfaces
 * rather than a reflection, and on a pattern that already repeats twelve times
 * they read as more ball.
 */

export interface BallView {
  src: string;
  /** Centre of the ball in this photograph, in pixels. */
  cx: number;
  cy: number;
  /** Radius of the ball in this photograph, in pixels. */
  r: number;
}

/**
 * How much of each disc's radius is safe to sample.
 *
 * At the very edge the surface turns away from the camera, so the last pixels
 * are grass and shadow rather than ball. Sampled at full radius the poles came
 * out green: grass wrapped onto the top and bottom of the sphere.
 */
const SAFE = 0.965;

/** Half-arc taken from each photograph. Three of these tile the equator. */
const ARC = Math.PI / 3;

/**
 * How wide the cross-fade between neighbouring photographs is, as a fraction of
 * each arc.
 *
 * Butted together the three shots met at a hard line: the pattern stopped
 * mid-panel and the exposure jumped, so a seam ran down the ball. Each arc is
 * therefore read a little past its own edge, into what the next shot also
 * covers, and the two are mixed across the overlap. Kept narrow because reading
 * further out means sampling nearer the rim of the disc, where the surface is
 * turning away and detail runs out.
 */
const BLEND = 0.09;

export function unwrapBallPhotos(
  images: HTMLImageElement[],
  views: BallView[],
  out: HTMLCanvasElement,
  size = 2048,
): void {
  out.width = size;
  out.height = size / 2;
  const octx = out.getContext("2d");
  if (!octx || images.length === 0) return;

  // Read every source once.
  const planes = images.map((img) => {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx?.drawImage(img, 0, 0);
    return {
      data: ctx?.getImageData(0, 0, c.width, c.height).data,
      w: c.width,
      h: c.height,
    };
  });

  /**
   * Match the exposures before blending.
   *
   * The three shots were taken in different light, so even a perfect join shows
   * as a step in brightness. Each plane is scaled so its mean luminance matches
   * the set's, which is crude but enough: the subject is the same white ball in
   * all three.
   */
  const means = planes.map((p) => {
    if (!p.data) return 1;
    let sum = 0;
    let count = 0;
    for (let i = 0; i < p.data.length; i += 4 * 37) {
      sum += 0.299 * p.data[i] + 0.587 * p.data[i + 1] + 0.114 * p.data[i + 2];
      count++;
    }
    return count ? sum / count : 1;
  });
  const target = means.reduce((a, b) => a + b, 0) / means.length;
  const gains = means.map((m) => (m > 1 ? target / m : 1));

  const image = octx.createImageData(out.width, out.height);
  const data = image.data;
  const n = planes.length;
  const seg = (Math.PI * 2) / n;

  /** Samples one plane at a given longitude, or null if it falls outside. */
  const sample = (idx: number, lon: number, st: number, dy: number) => {
    const view = views[idx] ?? views[0];
    const plane = planes[idx] ?? planes[0];
    if (!plane.data) return null;
    const r = view.r * SAFE;
    const px = Math.round(view.cx + st * Math.sin(lon) * r);
    const py = Math.round(view.cy - dy * r);
    if (px < 0 || py < 0 || px >= plane.w || py >= plane.h) return null;
    const s = (py * plane.w + px) * 4;
    const g = gains[idx];
    return [plane.data[s] * g, plane.data[s + 1] * g, plane.data[s + 2] * g];
  };

  for (let ty = 0; ty < out.height; ty++) {
    const theta = (ty / out.height) * Math.PI;
    const dy = Math.cos(theta);
    const st = Math.sin(theta);

    for (let tx = 0; tx < out.width; tx++) {
      const phi = (tx / out.width) * Math.PI * 2;
      const which = Math.min(n - 1, Math.floor(phi / seg));
      const local = (phi - which * seg) / seg;
      const o = (ty * out.width + tx) * 4;

      let rgb = sample(which, (local - 0.5) * 2 * ARC, st, dy);

      // Near either end of the arc, mix in the neighbour that also sees it.
      if (local < BLEND || local > 1 - BLEND) {
        const before = local < BLEND;
        const other = before
          ? (which - 1 + n) % n
          : (which + 1) % n;
        // The neighbour's own longitude for this same point, one arc along.
        const otherLon = before
          ? (local + 1 - 0.5) * 2 * ARC
          : (local - 1 - 0.5) * 2 * ARC;
        const otherRgb = sample(other, otherLon, st, dy);
        if (rgb && otherRgb) {
          const edge = before ? local / BLEND : (1 - local) / BLEND;
          // 0.5 at the join, 1.0 at the inner end of the overlap.
          const w = 0.5 + 0.5 * edge;
          rgb = [
            rgb[0] * w + otherRgb[0] * (1 - w),
            rgb[1] * w + otherRgb[1] * (1 - w),
            rgb[2] * w + otherRgb[2] * (1 - w),
          ];
        } else if (!rgb) {
          rgb = otherRgb;
        }
      }

      if (!rgb) {
        data[o] = 232; data[o + 1] = 230; data[o + 2] = 224; data[o + 3] = 255;
        continue;
      }
      data[o] = rgb[0];
      data[o + 1] = rgb[1];
      data[o + 2] = rgb[2];
      data[o + 3] = 255;
    }
  }

  octx.putImageData(image, 0, 0);
}
