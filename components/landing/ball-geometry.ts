import {
  AmbientLight,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * A football, built rather than modelled.
 *
 * A real ball is a truncated icosahedron: twelve black pentagons on the corners
 * of an icosahedron and twenty white hexagons on its faces. Both sets of
 * centres fall out of the icosahedron itself, so the whole thing is a hundred
 * lines of geometry instead of a downloaded mesh - no asset, no licence, no
 * request, and every panel is its own object we can take apart later.
 *
 * The panels sit on a dark sphere slightly smaller than they are, which fills
 * the seams the way the stitching does on a real ball.
 */

const PHI = (1 + Math.sqrt(5)) / 2;

/** The twelve icosahedron vertices, normalised. Pentagon centres. */
function icoVertices(): Vector3[] {
  const raw: [number, number, number][] = [
    [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
    [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
    [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
  ];
  return raw.map(([x, y, z]) => new Vector3(x, y, z).normalize());
}

/** The twenty icosahedron faces. Hexagon centres are their centroids. */
const ICO_FACES: [number, number, number][] = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
];

export interface Ball {
  group: Group;
  /** Every panel, so they can be moved independently. */
  panels: Mesh[];
}

/**
 * A regular polygon panel, curved so its corners land exactly on the sphere.
 *
 * Two things were wrong before. The panel centre was placed on the sphere's
 * surface, but a face of a polyhedron sits *inside* the circumsphere: for a
 * truncated icosahedron of circumradius 1 the pentagon centres are at 0.9392
 * and the hexagon centres at 0.9150. Placing both at 1 pushed every panel
 * outward until they overlapped, and the ball came out looking like a cow.
 *
 * And the curve had the wrong sign, which dished each panel instead of bulging
 * it. With the centre at height h and a corner at planar distance d, the point
 * belongs at z = sqrt(R^2 - d^2) - h. That is positive at the centre (the panel
 * stands proud) and exactly zero at the corners (they stay on the polyhedron's
 * own vertices, which are already on the sphere).
 *
 * `CircleGeometry` cannot do any of this: one centre vertex and a rim, so a
 * curve applied to it lifts the middle alone and makes a cone. Concentric rings
 * give the surface something to bend through.
 */
function domePanel(
  sides: number,
  planarRadius: number,
  centreHeight: number,
  sphereRadius: number,
  rings = 7,
): BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  const lift = (d: number) =>
    Math.sqrt(Math.max(0, sphereRadius * sphereRadius - d * d)) - centreHeight;

  pos.push(0, 0, lift(0));

  for (let ring = 1; ring <= rings; ring++) {
    const t = ring / rings;
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2 + Math.PI / 2;
      const x = Math.cos(a) * planarRadius * t;
      const y = Math.sin(a) * planarRadius * t;
      pos.push(x, y, lift(Math.hypot(x, y)));
    }
  }

  for (let s = 0; s < sides; s++) {
    idx.push(0, 1 + s, 1 + ((s + 1) % sides));
  }
  for (let ring = 1; ring < rings; ring++) {
    const inner = 1 + (ring - 1) * sides;
    const outer = 1 + ring * sides;
    for (let s = 0; s < sides; s++) {
      const n = (s + 1) % sides;
      idx.push(inner + s, outer + s, outer + n);
      idx.push(inner + s, outer + n, inner + n);
    }
  }

  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export function createBall(radius = 1): Ball {
  const group = new Group();
  const panels: Mesh[] = [];

  // The dark under-sphere that shows through the seams.
  /**
   * The sphere under the panels does two jobs.
   *
   * It fills the seams and it backs the silhouette. The panels now follow the
   * sphere exactly, so the outline is already a circle; this sits just beneath
   * them, dark, so the gaps read as stitching rather than as holes.
   */
  const core = new Mesh(
    new SphereGeometry(radius * 0.972, 64, 48),
    new MeshStandardMaterial({ color: new Color("#0f0c0a"), roughness: 0.85 }),
  );
  group.add(core);

  // Low-ish roughness so the environment map actually shows up: a matte surface
  // reflects nothing, which is why the first version read as painted card.
  const white = new MeshStandardMaterial({
    color: new Color("#efece6"),
    roughness: 0.34,
    metalness: 0.0,
  });
  const black = new MeshStandardMaterial({
    color: new Color("#171310"),
    roughness: 0.38,
    metalness: 0.0,
  });

  // CircleGeometry with 5 or 6 segments IS a regular pentagon or hexagon, but
  // it is flat, and thirty-two flat plates read as a polyhedron rather than as
  // a ball. Pushing the panel's own vertices out onto the sphere gives each one
  // the curvature a stitched panel gets from being inflated.
  /**
   * Every number here is the solid's, measured rather than guessed.
   *
   * Circumradius R = 1. Edge a = 4 / sqrt(58 + 18*sqrt5) = 0.4035. A hexagon's
   * circumradius equals its edge; a pentagon's is a / (2 sin 36) = 0.3433. Face
   * centres then sit at sqrt(1 - r^2): 0.9150 for hexagons, 0.9392 for
   * pentagons. SEAM shaves a hair off so the panels meet in a stitch line
   * rather than butting together.
   */
  const SEAM = 0.965;
  const PENTA_R = 0.3433;
  const HEXA_R = 0.4035;
  const PENTA_H = Math.sqrt(1 - PENTA_R * PENTA_R);
  const HEXA_H = Math.sqrt(1 - HEXA_R * HEXA_R);

  const pentagon = domePanel(5, radius * PENTA_R * SEAM, radius * PENTA_H, radius);
  const hexagon = domePanel(6, radius * HEXA_R * SEAM, radius * HEXA_H, radius);

  const place = (
    dir: Vector3,
    geo: BufferGeometry,
    mat: MeshStandardMaterial,
    height: number,
  ) => {
    const m = new Mesh(geo, mat);
    m.position.copy(dir).multiplyScalar(radius * height);
    // A CircleGeometry faces +Z, so pointing it away from the origin lays it
    // flat on the surface.
    m.lookAt(dir.clone().multiplyScalar(radius * 2));
    group.add(m);
    panels.push(m);
    // Remembered for the exploded state: each panel knows its own outward axis.
    m.userData.dir = dir.clone();
    return m;
  };

  const verts = icoVertices();
  for (const v of verts) place(v, pentagon, black, PENTA_H);

  for (const [a, b, c] of ICO_FACES) {
    const centre = new Vector3()
      .add(verts[a])
      .add(verts[b])
      .add(verts[c])
      .normalize();
    place(centre, hexagon, white, HEXA_H);
  }

  return { group, panels };
}

export interface Stage {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  resize: (w: number, h: number) => void;
  dispose: () => void;
}

export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new Scene();
  const camera = new PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 4.4);

  /**
   * Reflections, without shipping an HDRI.
   *
   * Most of what makes a rendered object look real is what it reflects, and
   * three carries a small procedural room for exactly this. It is used as
   * `environment` only, never as `background`, so the page keeps its own dark
   * ground and the ball simply picks up highlights from it.
   */
  const pmrem = new PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = env.texture;
  scene.environmentIntensity = 0.38;

  // Two lights and a fill: enough shape to read as a sphere, warm enough to sit
  // in a page built on warm near-black.
  const key = new DirectionalLight(0xfff2e2, 2.1);
  key.position.set(3, 4, 5);
  scene.add(key);
  const rim = new DirectionalLight(0xf1800b, 0.42);
  rim.position.set(-4, -1, -3);
  scene.add(rim);
  scene.add(new AmbientLight(0xffffff, 0.42));

  const resize = (w: number, h: number) => {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  const dispose = () => {
    env.texture.dispose();
    pmrem.dispose();
    renderer.dispose();
    scene.traverse((o) => {
      if (o instanceof Mesh) {
        o.geometry.dispose();
        const m = o.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      }
    });
  };

  return { scene, camera, renderer, resize, dispose };
}
