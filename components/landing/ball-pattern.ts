/**
 * The ball's markings, computed for the whole sphere.
 *
 * A photograph only holds the half that faced the lens, so a ball wearing one
 * cannot turn - the moment it passes 90 degrees it shows surface that was never
 * photographed. Everything here exists so it can turn: the pattern is generated
 * from the shape of the ball itself, which means it closes on all sides, has no
 * seam, and has no far side to invent.
 *
 * It is the classic ball: a truncated icosahedron, twelve dark pentagons and
 * twenty light hexagons. The shape does all the work - the panels are the set
 * of points nearest each face centre, so the outlines are exact rather than
 * drawn, and every panel meets its neighbours correctly by construction.
 *
 * Measured, not assumed:
 *
 *  - The twelve pentagon centres are the vertices of an icosahedron, 63.44
 *    degrees apart.
 *  - The twenty hexagon centres are that icosahedron's face centres.
 *  - A pentagon's own corners are 20.08 degrees out from its centre, which is
 *    what sets the scale of everything printed on one.
 *
 * A star design was built here first, off the photographed ball, and dropped:
 * the plain black-and-white reads better at the size this actually renders.
 */

const PHI = (1 + Math.sqrt(5)) / 2;
const DEG = Math.PI / 180;

type Vec3 = [number, number, number];

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (v: Vec3): Vec3 => {
  const m = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / m, v[1] / m, v[2] / m];
};
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** Two icosahedron vertices sharing an edge, as a dot product. */
const isNeighbour = (t: number) => t > 0.4 && t < 0.5;

/** How far a pentagon's corners sit from its centre. Sets every other size. */
const PENT = 20.08 * DEG;
/** Width of the seam between panels. */
const SEAM = 0.5 * DEG;

const INK: Vec3 = [26, 26, 30];
const WHITE: Vec3 = [242, 241, 234];
/** The stitched trough between panels, and the thread sitting in it. */
const SEAM_DARK: Vec3 = [96, 96, 92];
const SEAM_LIGHT: Vec3 = [168, 167, 160];
const HASH: Vec3 = [222, 221, 213];


function build() {
  let pent: Vec3[] = [];
  for (const a of [1, -1]) {
    for (const b of [1, -1]) {
      pent.push(norm([0, a, b * PHI]));
      pent.push(norm([a, b * PHI, 0]));
      pent.push(norm([b * PHI, 0, a]));
    }
  }

  let hex: Vec3[] = [];
  for (let i = 0; i < 12; i++) {
    for (let j = i + 1; j < 12; j++) {
      for (let k = j + 1; k < 12; k++) {
        if (
          isNeighbour(dot(pent[i], pent[j])) &&
          isNeighbour(dot(pent[j], pent[k])) &&
          isNeighbour(dot(pent[i], pent[k]))
        ) {
          hex.push(
            norm([
              pent[i][0] + pent[j][0] + pent[k][0],
              pent[i][1] + pent[j][1] + pent[k][1],
              pent[i][2] + pent[j][2] + pent[k][2],
            ]),
          );
        }
      }
    }
  }

  // Turn the whole cage so a star looks straight down +z, which is where the
  // camera sits. Otherwise the ball opens on a seam.
  const a0 = Math.atan2(pent[0][1], pent[0][2]);
  const ca = Math.cos(a0);
  const sa = Math.sin(a0);
  const tilt = (v: Vec3): Vec3 => [
    v[0],
    v[1] * ca - v[2] * sa,
    v[1] * sa + v[2] * ca,
  ];
  pent = pent.map(tilt);
  hex = hex.map(tilt);

  return { pent, hex, faces: [...pent, ...hex] };
}

/**
 * The tooth of the leather.
 *
 * Value noise over the map, at three scales, wrapped in x so nothing shows at
 * the back seam where the texture meets itself. It is deliberately fine: this
 * is the grain you only notice at a glancing angle, not a pebbled surface.
 */
const GRAIN = 220;
const grainSeed = (x: number, y: number) => {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2545f491);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

function grainAt(u: number, v: number, cells: number) {
  const x = u * cells;
  const y = v * (cells / 2);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  // Wrapped in x so the two edges of the map agree.
  const wrap = (i: number) => ((i % cells) + cells) % cells;
  const a = grainSeed(wrap(x0), y0);
  const b = grainSeed(wrap(x0 + 1), y0);
  const c = grainSeed(wrap(x0), y0 + 1);
  const dd = grainSeed(wrap(x0 + 1), y0 + 1);
  return (a + (b - a) * sx) * (1 - sy) + (c + (dd - c) * sx) * sy;
}

/** Deterministic noise, so the ball is the same ball on every load. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The scuffs on the white panels.
 *
 * A ball that has been kicked is marked, and a perfectly clean white is most of
 * what made earlier attempts here read as a balloon with a pattern on it. These
 * are grazes rather than branding - barely off the panel colour, no two alike -
 * laid out in each hexagon's own frame so they sit on the panel rather than
 * drifting across a seam.
 */
function scuffs(hex: Vec3[]) {
  const rnd = seeded(20080311);
  return hex.map((c) => {
    const raw: Vec3 = Math.abs(c[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const d = dot(c, raw);
    const u = norm([raw[0] - d * c[0], raw[1] - d * c[1], raw[2] - d * c[2]]);
    const v = cross(c, u);
    const marks: { x: number; y: number; dx: number; dy: number }[] = [];
    const n = 2 + Math.floor(rnd() * 2);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const r = (0.25 + rnd() * 0.45) * PENT;
      const len = (0.16 + rnd() * 0.2) * PENT;
      const dir = rnd() * Math.PI * 2;
      marks.push({
        x: Math.cos(a) * r,
        y: Math.sin(a) * r,
        dx: Math.cos(dir) * len,
        dy: Math.sin(dir) * len,
      });
    }

    return { u, v, marks };
  });
}

/**
 * Paints the three maps three.js wraps onto the sphere: colour, roughness, and
 * height. Everything is computed - no image is loaded.
 */
export function paintBall(
  out: HTMLCanvasElement,
  surface: HTMLCanvasElement,
  relief: HTMLCanvasElement,
  size = 1600,
): void {
  const { hex, faces } = build();
  const marks = scuffs(hex);

  out.width = size;
  out.height = size / 2;
  const g = out.getContext("2d");
  if (!g) return;
  const image = g.createImageData(out.width, out.height);
  const px = image.data;

  /**
   * A second map for how the surface behaves, not what colour it is.
   *
   * Green channel only, because that is the one three.js reads for roughness.
   * The star is a printed film and catches the light; the panels are matt
   * grain; the seams between them are matt and sunken. Giving all three the
   * same single roughness was most of why the computed ball read as plastic -
   * a real ball is never uniformly shiny.
   */
  surface.width = out.width;
  surface.height = out.height;
  const sg = surface.getContext("2d");
  if (!sg) return;
  const simage = sg.createImageData(out.width, out.height);
  const spx = simage.data;

  /**
   * A third map: how high the surface stands, not how it is coloured.
   *
   * This is the one that was missing. Every earlier version painted the panels
   * as light and shade straight into the colour map, which looks right in a
   * still and wrong the moment the light moves - baked shading cannot respond
   * to anything, so the ball read as a picture of a ball rather than as an
   * object. Given a real height the renderer works out the shading itself: the
   * seams sink, the panels stand proud of them, the leather has tooth, and all
   * of it turns with the light.
   */
  relief.width = out.width;
  relief.height = out.height;
  const rg = relief.getContext("2d");
  if (!rg) return;
  const rimage = rg.createImageData(out.width, out.height);
  const rpx = rimage.data;

  for (let ty = 0; ty < out.height; ty++) {
    const theta = (ty / out.height) * Math.PI;
    const st = Math.sin(theta);
    const ct = Math.cos(theta);

    for (let tx = 0; tx < out.width; tx++) {
      // three.js starts a sphere's u on -x and runs it anticlockwise.
      const phi = (tx / out.width) * Math.PI * 2;
      const d: Vec3 = [-Math.cos(phi) * st, ct, Math.sin(phi) * st];

      // Distance to the nearest panel seam, needed everywhere now: it shades
      // the panels as well as drawing the seams.
      let d1 = -2;
      let d2 = -2;
      let f1 = 0;
      for (let i = 0; i < faces.length; i++) {
        const t = dot(d, faces[i]);
        if (t > d1) {
          d2 = d1;
          d1 = t;
          f1 = i;
        } else if (t > d2) {
          d2 = t;
        }
      }
      const gap = Math.acos(Math.min(1, d2)) - Math.acos(Math.min(1, d1));

      let col: Vec3;
      let rough: number;
      /** 0 at the bottom of a seam, 1 on the crown of a panel. */
      let high: number;

      if (gap < SEAM) {
        /**
         * The seam, as a trough with thread in it.
         *
         * The outer half is the shadowed wall of the groove and the middle is
         * the stitching sitting up in it, which is why this is two tones and
         * two heights rather than one grey line.
         */
        const mid = gap < SEAM * 0.42;
        col = mid ? SEAM_LIGHT : SEAM_DARK;
        rough = 0.86;
        high = mid ? 0.30 : 0.10;
      } else {
        // Panels stand proud, doming towards the middle.
        const rise = Math.min(1, (gap - SEAM) / (SEAM * 11));
        high = 0.42 + 0.58 * (rise * rise * (3 - 2 * rise));

        if (f1 < 12) {
          // A pentagon: the dark panels of the classic ball.
          col = INK;
          // Nearly as matt as the white. A glossy black panel was the last
          // thing on the ball still reading as moulded plastic.
          rough = 0.60;
        } else {
          // A hexagon: the light panels, carrying whatever wear there is.
          col = WHITE;
          rough = 0.70;
          const m = marks[f1 - 12];
          const lx = dot(d, m.u);
          const ly = dot(d, m.v);
          for (const k of m.marks) {
            // Distance to the segment, in the panel's own frame.
            const wx = lx - k.x;
            const wy = ly - k.y;
            const len = k.dx * k.dx + k.dy * k.dy;
            const t = Math.max(0, Math.min(1, (wx * k.dx + wy * k.dy) / len));
            if (Math.hypot(wx - t * k.dx, wy - t * k.dy) < 0.0045) {
              col = HASH;
              rough = 0.80;
              break;
            }
          }
        }
      }

      /**
       * The colour map keeps only a trace of the shading.
       *
       * The height map does the real work now, but a little darkening in the
       * crease survives as ambient occlusion - light that would not reach into
       * a groove no matter where it came from. Any more than this and the baked
       * version fights the lit one.
       */
      const dome = 0.90 + 0.10 * high;
      const o = (ty * out.width + tx) * 4;
      px[o] = col[0] * dome;
      px[o + 1] = col[1] * dome;
      px[o + 2] = col[2] * dome;
      px[o + 3] = 255;
      const r8 = Math.round(rough * 255);
      spx[o] = r8;
      spx[o + 1] = r8;
      spx[o + 2] = r8;
      spx[o + 3] = 255;

      // Leather on top of the panel shape: fine tooth everywhere, so the white
      // is never a flat fill and the black is never a hole.
      const u = tx / out.width;
      const v = ty / out.height;
      const tooth =
        grainAt(u, v, GRAIN) * 0.55 +
        grainAt(u, v, GRAIN * 2) * 0.30 +
        grainAt(u, v, GRAIN * 4) * 0.15;
      const h = Math.max(0, Math.min(1, high * 0.90 + tooth * 0.10));
      const h8 = Math.round(h * 255);
      rpx[o] = h8;
      rpx[o + 1] = h8;
      rpx[o + 2] = h8;
      rpx[o + 3] = 255;
    }
  }

  g.putImageData(image, 0, 0);
  sg.putImageData(simage, 0, 0);
  rg.putImageData(rimage, 0, 0);
}
