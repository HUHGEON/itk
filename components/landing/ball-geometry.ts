import {
  AmbientLight,
  CircleGeometry,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from "three";

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

export function createBall(radius = 1): Ball {
  const group = new Group();
  const panels: Mesh[] = [];

  // The dark under-sphere that shows through the seams.
  const core = new Mesh(
    new SphereGeometry(radius * 0.965, 48, 32),
    new MeshStandardMaterial({ color: new Color("#14100e"), roughness: 0.95 }),
  );
  group.add(core);

  const white = new MeshStandardMaterial({
    color: new Color("#f2f0ec"),
    roughness: 0.62,
    metalness: 0.02,
  });
  const black = new MeshStandardMaterial({
    color: new Color("#1b1613"),
    roughness: 0.68,
    metalness: 0.02,
  });

  // CircleGeometry with 5 or 6 segments IS a regular pentagon or hexagon.
  const pentagon = new CircleGeometry(radius * 0.3708, 5);
  const hexagon = new CircleGeometry(radius * 0.3902, 6);

  const place = (dir: Vector3, geo: CircleGeometry, mat: MeshStandardMaterial) => {
    const m = new Mesh(geo, mat);
    m.position.copy(dir).multiplyScalar(radius * 0.995);
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
  for (const v of verts) place(v, pentagon, black);

  for (const [a, b, c] of ICO_FACES) {
    const centre = new Vector3()
      .add(verts[a])
      .add(verts[b])
      .add(verts[c])
      .normalize();
    place(centre, hexagon, white);
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

  // Two lights and a fill: enough shape to read as a sphere, warm enough to sit
  // in a page built on warm near-black.
  const key = new DirectionalLight(0xfff2e2, 2.5);
  key.position.set(3, 4, 5);
  scene.add(key);
  const rim = new DirectionalLight(0xf1800b, 1.1);
  rim.position.set(-4, -1, -3);
  scene.add(rim);
  scene.add(new AmbientLight(0xffffff, 0.5));

  const resize = (w: number, h: number) => {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  const dispose = () => {
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
