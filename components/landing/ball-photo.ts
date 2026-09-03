/**
 * Wraps a straight-on photograph of a ball around a sphere, all the way round.
 *
 * A camera sees a sphere as a disc, and that projection inverts: a pixel at
 * (nx, ny) from the centre of the disc, in units of its radius, is looking at
 * (nx, ny, sqrt(1 - nx^2 - ny^2)) on the ball. Running that backwards gives the
 * facing hemisphere for free.
 *
 * The far side is the problem, and it is not the one it looks like. Mirroring
 * the near side onto it is easy - under this projection the two even share the
 * same pixels. What smears is the *rim*: at the edge of the disc the surface is
 * turning away from the camera, so a few pixels of photograph stretch across a
 * wide band of sphere. Rotate the ball and that band swings into view as a
 * smeared ring, which is what the first version did.
 *
 * So the rim is never used. The sphere is covered by repeating the middle of
 * the photograph - the part facing the camera, where the sampling is dense -
 * four times around the equator. A football's markings already repeat twelve
 * times, so four copies of a good hemisphere read as a ball, where one copy
 * plus a stretched rim reads as a mistake.
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
 * The Adidas three-stripe mark, which is a trademark and is painted out.
 *
 * Tested on channel differences rather than absolute values: the stripes are
 * antialiased and JPEG-blurred, so their outer pixels drift toward the panel
 * white and fall outside any threshold tight enough to spare the printed detail
 * elsewhere. Distance between channels does not care where the bucket edge fell.
 */
function isBrandOrange(r: number, g: number, b: number): boolean {
  return r > 165 && r - g > 42 && r - b > 62;
}

/**
 * Where the mark sits in the source photograph, as fractions of its size.
 * Measured: the stripes occupy x 259..397, y 453..639 of a 700px frame.
 */
const MARK_BOX = { x0: 0.33, x1: 0.60, y0: 0.61, y1: 0.95 };

/**
 * How many copies of the photographed hemisphere go around the equator, and how
 * much of that hemisphere each copy uses.
 *
 * SPAN is the half-angle sampled from the photograph's centre. At 45 degrees a
 * copy stops well inside the rim, where the projection is still dense.
 *
 * Two copies, not four, because the fold below already halves each one: a
 * segment is walked out and back, so a 180 degree segment spends 90 degrees
 * going and 90 returning, and 90 degrees of sphere takes 90 degrees of
 * photograph one to one. With four copies each segment was 90 degrees, the fold
 * made it 45, and the same 90 degrees of photograph got squeezed into it -
 * which stretched every star vertically.
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

  // Paint out the stripes on the flat photograph, where the mark is a
  // contiguous shape. Each orange pixel takes the colour of the nearest clean
  // panel pixel on its row.
  const patched = new Uint8ClampedArray(sd);
  const bx0 = Math.floor(MARK_BOX.x0 * src.width);
  const bx1 = Math.ceil(MARK_BOX.x1 * src.width);
  const by0 = MARK_BOX.y0 * src.height;
  const by1 = MARK_BOX.y1 * src.height;

  for (let y = 0; y < src.height; y++) {
    if (y < by0 || y > by1) continue;
    for (let x = bx0; x <= bx1 && x < src.width; x++) {
      const i = (y * src.width + x) * 4;
      if (!isBrandOrange(sd[i], sd[i + 1], sd[i + 2])) continue;
      for (let step = 1; step < 200; step++) {
        let done = false;
        for (const sx of [x - step, x + step]) {
          if (sx < 0 || sx >= src.width) continue;
          const j = (y * src.width + sx) * 4;
          if (isBrandOrange(sd[j], sd[j + 1], sd[j + 2])) continue;
          if (sd[j] < 150) continue;
          patched[i] = sd[j];
          patched[i + 1] = sd[j + 1];
          patched[i + 2] = sd[j + 2];
          done = true;
          break;
        }
        if (done) break;
      }
    }
  }

  const image = octx.createImageData(out.width, out.height);
  const data = image.data;
  const seg = (Math.PI * 2) / COPIES;

  for (let ty = 0; ty < out.height; ty++) {
    const theta = (ty / out.height) * Math.PI;
    const st = Math.sin(theta);
    const dy = Math.cos(theta);

    for (let tx = 0; tx < out.width; tx++) {
      const phi = (tx / out.width) * Math.PI * 2;

      /**
       * Fold the longitude into one copy, then into the photograph's dense
       * middle. Each segment is walked out and back so neighbouring copies meet
       * as a mirror rather than as a jump, which hides the join in a pattern
       * that is already symmetric.
       */
      let u = (phi % seg) / seg;
      u = u < 0.5 ? u * 2 : (1 - u) * 2;
      const lon = (u - 0.5) * 2 * SPAN;

      const dx = st * Math.sin(lon);
      const px = Math.round(opts.cx + dx * opts.r);
      const py = Math.round(opts.cy - dy * opts.r);
      const o = (ty * out.width + tx) * 4;

      if (px < 0 || py < 0 || px >= src.width || py >= src.height) {
        data[o] = 226; data[o + 1] = 222; data[o + 2] = 212; data[o + 3] = 255;
        continue;
      }
      const s = (py * src.width + px) * 4;
      data[o] = patched[s];
      data[o + 1] = patched[s + 1];
      data[o + 2] = patched[s + 2];
      data[o + 3] = 255;
    }
  }

  octx.putImageData(image, 0, 0);
}
