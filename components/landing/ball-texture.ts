/**
 * Draws a football's markings straight onto an equirectangular texture.
 *
 * Every earlier attempt built the ball out of thirty-two panel meshes, and each
 * one had the same class of problem: panels sitting on a sphere fight for the
 * depth buffer, their edges break into dashes, and the silhouette is a polygon
 * unless the panels are placed to a tolerance that took three tries to get
 * right. A texture has none of that. The mesh is one smooth sphere, so the
 * outline is a circle by construction, and the pattern is decided per texel by
 * arithmetic rather than by geometry that can be misplaced.
 *
 * The pattern is the Champions League layout: twelve stars on the vertices of
 * an icosahedron. For each texel we take its direction, find the nearest
 * vertex, and ask whether it falls inside that vertex's star.
 */

const PHI = (1 + Math.sqrt(5)) / 2;

/** Icosahedron vertices, normalised. One star sits on each. */
function icoDirections(): [number, number, number][] {
  const raw: [number, number, number][] = [
    [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
    [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
    [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
  ];
  return raw.map(([x, y, z]) => {
    const l = Math.hypot(x, y, z);
    return [x / l, y / l, z / l] as [number, number, number];
  });
}

/**
 * Adjacent icosahedral vertices are 63.43 degrees apart, so a star whose points
 * reach half of that exactly touches its neighbour. 0.92 of it leaves the white
 * cross between them that the real ball has.
 */
const TOUCH = Math.acos(1 / Math.sqrt(5)) / 2;
const STAR_OUTER = TOUCH * 0.98;
/**
 * The waist of the star, inner points over outer.
 *
 * A geometric pentagram is 0.382. The match-ball star is much stouter: on the
 * Adidas Champions League ball the arms are short and wide, closer to a
 * five-lobed clover than to a spark. 0.55 reads closest to the photograph: at
 * 0.62 the arms round off and the star stops having points, at 0.52 it goes
 * spindly, and 0.76 is a blob.
 */
const STAR_INNER_RATIO = 0.55;

/**
 * One arm every 72 degrees, with the waist at its midpoint.
 *
 * Stepping every 36 degrees instead put an outer corner at each step and grew a
 * ten-armed star. Five arms means a 72 degree period folded in half: the edge
 * runs out-to-in over the first 36 degrees and mirrors back over the second.
 */
const PERIOD = (Math.PI * 2) / 5;
const HALF = PERIOD / 2;

/**
 * Distance from the centre to the star's edge at a given bearing.
 *
 * The first version interpolated with a cosine, which rounds every corner off
 * and turns the star into a blob - measured, and it looked like cowhide. A star
 * has straight sides, so the edge between an outer corner at radius R and an
 * inner one at radius r, separated by SEG, is the straight line between them.
 * In polar form that line is
 *
 *   d(t) = R*r*sin(SEG) / (R*sin(t) + r*sin(SEG - t))
 *
 * with t measured from the outer corner.
 */
function starEdge(bearing: number, outer: number): number {
  const inner = outer * STAR_INNER_RATIO;
  let t = ((bearing % PERIOD) + PERIOD) % PERIOD;
  if (t > HALF) t = PERIOD - t;
  return (
    (outer * inner * Math.sin(HALF)) /
    (outer * Math.sin(t) + inner * Math.sin(HALF - t))
  );
}

/** How wide the seam trench is, in radians of arc. */
const SEAM_WIDTH = 0.028;
/** Width of the lime keyline inside each star edge. */
const KEY_WIDTH = 0.019;

export interface BallColours {
  /** The panels between the stars. */
  base: string;
  /** The stars themselves. */
  mark: string;
  /**
   * The lime keyline just inside each star's edge.
   *
   * This is the detail that identifies the ball. Without it the pattern is
   * generic black-on-white; with it, it is recognisable at a glance even at
   * thumbnail size, because it is the only chromatic edge on the object.
   */
  key: string;
  /** The stitch line between star and panel. */
  seam: string;
}

/**
 * Deterministic value noise, for the leather grain.
 *
 * A painted sphere reads as a balloon no matter how right the markings are,
 * because a real ball is not smooth: the panels are grained, and the seams are
 * trenches. Colour alone cannot say that, so this fills a bump map at the same
 * time - and the grain has to be stable across frames, hence a hash rather than
 * Math.random.
 */
function grain(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (((h ^ (h >>> 16)) >>> 0) % 1000) / 1000;
}

export function drawBallTexture(
  canvas: HTMLCanvasElement,
  bump: HTMLCanvasElement,
  colours: BallColours,
  size = 1024,
): void {
  canvas.width = size * 2;
  canvas.height = size;
  bump.width = size * 2;
  bump.height = size;
  const ctx = canvas.getContext("2d");
  const bctx = bump.getContext("2d");
  if (!ctx || !bctx) return;

  const dirs = icoDirections();
  const image = ctx.createImageData(canvas.width, canvas.height);
  const data = image.data;
  const bimage = bctx.createImageData(bump.width, bump.height);
  const bdata = bimage.data;

  const base = hex(colours.base);
  const mark = hex(colours.mark);
  const key = hex(colours.key);
  const seam = hex(colours.seam);

  for (let y = 0; y < canvas.height; y++) {
    // Equirectangular: rows are polar angle, columns are azimuth.
    const theta = (y / canvas.height) * Math.PI;
    const st = Math.sin(theta);
    const ct = Math.cos(theta);

    for (let x = 0; x < canvas.width; x++) {
      const phi = (x / canvas.width) * Math.PI * 2;
      const dx = st * Math.cos(phi);
      const dy = ct;
      const dz = st * Math.sin(phi);

      // Nearest star centre, and the bearing around it.
      let best = 0;
      let bestDot = -2;
      for (let i = 0; i < dirs.length; i++) {
        const d = dx * dirs[i][0] + dy * dirs[i][1] + dz * dirs[i][2];
        if (d > bestDot) {
          bestDot = d;
          best = i;
        }
      }
      const angle = Math.acos(Math.min(1, Math.max(-1, bestDot)));

      // Bearing needs a stable frame around the star centre, and the five arms
      // must point at the five neighbours, so the frame is built from the
      // nearest other vertex rather than from an arbitrary axis.
      const c = dirs[best];
      let ref: [number, number, number] = [0, 0, 0];
      let refDot = -2;
      for (let i = 0; i < dirs.length; i++) {
        if (i === best) continue;
        const d = c[0] * dirs[i][0] + c[1] * dirs[i][1] + c[2] * dirs[i][2];
        if (d > refDot) {
          refDot = d;
          ref = dirs[i];
        }
      }
      // Tangent basis at c, with u aimed at that neighbour.
      let ux = ref[0] - c[0] * refDot;
      let uy = ref[1] - c[1] * refDot;
      let uz = ref[2] - c[2] * refDot;
      const ul = Math.hypot(ux, uy, uz) || 1;
      ux /= ul; uy /= ul; uz /= ul;
      const vx = c[1] * uz - c[2] * uy;
      const vy = c[2] * ux - c[0] * uz;
      const vz = c[0] * uy - c[1] * ux;

      const bearing = Math.atan2(dx * vx + dy * vy + dz * vz, dx * ux + dy * uy + dz * uz);

      const edge = starEdge(bearing, STAR_OUTER);

      const i4 = (y * canvas.width + x) * 4;
      /**
       * Four bands out from the star's centre: the star, a lime keyline just
       * inside its edge, the stitch line on the edge itself, then the panel.
       * The keyline is wider than the stitch because on the real ball it is a
       * printed border, not a seam.
       */
      const rgb =
        angle < edge - KEY_WIDTH
          ? mark
          : angle < edge - 0.004
            ? key
            : angle < edge + 0.005
              ? seam
              : base;
      data[i4] = rgb[0];
      data[i4 + 1] = rgb[1];
      data[i4 + 2] = rgb[2];
      data[i4 + 3] = 255;

      /**
       * Height, in the same pass.
       *
       * The seam is a trench, so the panel surface falls away as it approaches
       * the boundary and bottoms out on it. Everything else is panel, lifted
       * and grained. This is what separates a ball from a painted balloon.
       */
      const toEdge = Math.abs(angle - edge);
      const trench = Math.min(1, toEdge / SEAM_WIDTH);
      // Smoothstep, so the panels roll into the seam instead of stepping.
      const rolled = trench * trench * (3 - 2 * trench);
      const g = (grain(x, y) - 0.5) * 44;
      const h = Math.max(0, Math.min(255, 40 + rolled * 200 + g));
      bdata[i4] = h;
      bdata[i4 + 1] = h;
      bdata[i4 + 2] = h;
      bdata[i4 + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  bctx.putImageData(bimage, 0, 0);
}

function hex(v: string): [number, number, number] {
  const n = parseInt(v.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
