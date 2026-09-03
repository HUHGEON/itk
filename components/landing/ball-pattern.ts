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
const SEAM_DARK: Vec3 = [120, 120, 116];
const SEAM_LIGHT: Vec3 = [206, 205, 198];
const HASH: Vec3 = [222, 221, 213];


/** Which pentagons carry the competition mark. Not every panel does. */
const BADGED = new Set([0, 4, 8]);

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

  /**
   * Each panel's own left-to-right, used to stand the badge up on it.
   *
   * A pentagon has five neighbours and any of them would do as a reference, but
   * taking the first put the badge on a random one of five tilts - on the front
   * panel it came out leaning about 15 degrees, which reads as a misprint
   * rather than as a ball. Choosing the neighbour that lies flattest instead
   * means the direction is as close to level as that panel allows, and the
   * choice still travels with the ball when it turns.
   */
  const axis = pent.map((c) => {
    let best: Vec3 = [1, 0, 0];
    let flattest = 2;
    for (const n of pent) {
      if (!isNeighbour(dot(c, n))) continue;
      const d = dot(c, n);
      const t = norm([n[0] - d * c[0], n[1] - d * c[1], n[2] - d * c[2]]);
      const tilt = Math.abs(t[1]);
      if (tilt < flattest) {
        flattest = tilt;
        // Point it right rather than left, so the badge is never handed.
        best = t[0] < 0 ? [-t[0], -t[1], -t[2]] : t;
      }
    }
    return best;
  });
  const binormal = pent.map((c, i) => cross(c, axis[i]));

  return { pent, hex, axis, binormal, faces: [...pent, ...hex] };
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
 * Cuts the competition mark out of the photograph.
 *
 * Drawing it from scratch would mean redrawing the starball glyph, and it is
 * already sitting in the photo on a flat part of a panel facing the lens. The
 * white pixels are dropped so the crop's corners, which catch the panel behind
 * the star, do not print a pale block on the star's shoulder.
 */
function badge(photo: HTMLImageElement) {
  const CROP = { x: 498, y: 232, w: 166, h: 140 };
  const s = photo.naturalWidth / 1024;
  const c = document.createElement("canvas");
  c.width = Math.round(CROP.w * s);
  c.height = Math.round(CROP.h * s);
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g) return null;
  g.drawImage(
    photo,
    CROP.x * s,
    CROP.y * s,
    CROP.w * s,
    CROP.h * s,
    0,
    0,
    c.width,
    c.height,
  );
  const d = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    /**
     * Keep the lettering, drop everything it was printed on.
     *
     * Dropping only the pale pixels left the crop's own dark background in
     * place, and against this ball's flat black panel that read as a square
     * smudge sitting under the badge. The mark is the only strongly green
     * thing in the crop, so that is what is kept - the panel underneath then
     * shows through everywhere else, and the badge sits on the ball instead of
     * on a patch of a different ball.
     */
    const r = d.data[i];
    const gg = d.data[i + 1];
    const b = d.data[i + 2];
    const lime = gg > 120 && gg - b > 55 && r > 80;
    if (!lime) d.data[i + 3] = 0;
  }
  return { data: d.data, w: c.width, h: c.height };
}

/**
 * Paints the equirectangular map three.js will wrap onto the sphere.
 *
 * `photo` only supplies the competition mark; every line and colour around it
 * is computed. Pass null and the ball is simply unbadged.
 */
export function paintBall(
  out: HTMLCanvasElement,
  surface: HTMLCanvasElement,
  photo: HTMLImageElement | null,
  size = 1600,
): void {
  const { pent, hex, axis, binormal, faces } = build();
  const marks = scuffs(hex);
  const mark = photo ? badge(photo) : null;

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

      if (gap < SEAM) {
        /**
         * The seam, as two tones rather than one line.
         *
         * A single grey line between panels reads as drawn on. A real ball has
         * a trough with thread lying in it, so the outer half of the seam is
         * in shadow and the middle catches the light - which is what makes the
         * panels look joined rather than printed.
         */
        col = gap < SEAM * 0.42 ? SEAM_LIGHT : SEAM_DARK;
        rough = 0.86;
      } else if (f1 < 12) {
        // A pentagon: the dark panels of the classic ball.
        col = INK;
        rough = 0.44;

        if (mark && BADGED.has(f1)) {
          const delta = Math.acos(Math.min(1, d1));
          const around = Math.atan2(dot(d, binormal[f1]), dot(d, axis[f1]));
          /**
           * Laying the mark on the panel, worked out rather than guessed at.
           *
           * Seen from outside the ball the panel's frame reads as (axis right,
           * binormal up), so `around` is an anticlockwise screen angle. Image
           * coordinates run down the page, so v is the axis that flips, not u -
           * flipping both only turned the mark upside down and left it still
           * mirrored. No quarter turn: the panel's axis already points along
           * the mark's own width, and adding one stood the whole badge on its
           * side. The aspect correction belongs on v - the crop is wider than
           * it is tall, so it is the vertical span that has to be squeezed to
           * keep the mark from stretching.
           */
          const k = (Math.tan(delta) / Math.tan(PENT * 0.72)) * 0.5;
          const u = 0.5 + k * Math.cos(around);
          const v = 0.5 - k * Math.sin(around) * (mark.w / mark.h);
          if (u >= 0 && u < 1 && v >= 0 && v < 1) {
            const mx = Math.floor(u * mark.w);
            const my = Math.floor(v * mark.h);
            const o = (my * mark.w + mx) * 4;
            if (mark.data[o + 3] > 0) {
              col = [mark.data[o], mark.data[o + 1], mark.data[o + 2]];
              rough = 0.34;
            }
          }
        }
      } else {
        // A hexagon: the light panels, with the mouldings and the wear.
        col = WHITE;
        rough = 0.68;
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
            break;
          }
        }
      }

      /**
       * The panels are baked as domes.
       *
       * Each panel of a real ball is stitched under pressure and bulges, so it
       * is brightest in the middle and falls away into a shadowed trough at the
       * seam. None of that can come from a light, because the mesh really is a
       * smooth sphere - there is no geometry there to catch one. Painting it in
       * is what turns 32 flat regions into 32 panels, and it was the single
       * biggest thing separating the computed ball from the photographed one.
       */
      const dome = 0.84 + 0.16 * Math.min(1, gap / (SEAM * 10));
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
    }
  }

  g.putImageData(image, 0, 0);
  sg.putImageData(simage, 0, 0);
}
