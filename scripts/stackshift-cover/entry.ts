// Browser entry for scripts/render-stackshift-cover.mjs (v178): a realistic Stack Shift cover. The game's well, its
// eight columns and its six piece colours, rendered in 3D with three.js: lacquered rounded blocks under a soft key
// light, a full row flashing as it clears, the next piece dropping onto its landing ghost. Presentation only; nothing
// here touches the Stack Shift cores.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const W = 1600, H = 1100;
const COLORS = ["#16b4d8", "#f0a020", "#2fbf6e", "#8455e0", "#e2486c", "#3a6ef0"]; // the game's palette
const COLS = 8;

declare global { interface Window { renderCover: () => string } }

window.renderCover = () => {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
  renderer.setSize(W, H, false);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  // Deep-space backdrop: a soft violet-blue nebula behind the well, painted once on a canvas.
  const bg = document.createElement("canvas"); bg.width = 512; bg.height = 352;
  const bgc = bg.getContext("2d")!;
  bgc.fillStyle = "#03050b"; bgc.fillRect(0, 0, 512, 352);
  for (const [x, y, r, c] of [[150, 120, 230, "rgba(64,72,170,.42)"], [380, 90, 200, "rgba(40,130,170,.30)"], [300, 300, 260, "rgba(110,50,150,.22)"]] as const) {
    const g = bgc.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, c); g.addColorStop(1, "rgba(0,0,0,0)");
    bgc.fillStyle = g; bgc.fillRect(0, 0, 512, 352);
  }
  const bgTex = new THREE.CanvasTexture(bg); bgTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = bgTex;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.32;

  const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 200);
  // The stack sits in the upper middle: catalogue cards cover the bottom third with the game's name.
  camera.position.set(-3.4, 6.2, 19.5);
  camera.lookAt(4.2, 2.9, 0);

  // Lights: a warm key from the upper left, a cyan rim from behind right, a low fill.
  const key = new THREE.DirectionalLight("#fff3e0", 2.4);
  key.position.set(-6, 14, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -4, right: 14, top: 14, bottom: -4, near: 1, far: 50 });
  key.shadow.radius = 6;
  key.shadow.bias = -0.0004;
  scene.add(key);
  const rim = new THREE.DirectionalLight("#7fe8ff", 1.6);
  rim.position.set(14, 8, -8);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight("#9fb6ff", "#06070c", 0.35));

  // The well: a dark glass back panel with a faint grid, brushed side posts with lit edges, a lit floor.
  const back = new THREE.Mesh(new THREE.PlaneGeometry(COLS + 0.4, 13), new THREE.MeshPhysicalMaterial({ color: "#07101f", roughness: 0.35, metalness: 0.2, clearcoat: 0.6 }));
  back.position.set(COLS / 2, 6.3, -0.56);
  back.receiveShadow = true;
  scene.add(back);
  const gridMat = new THREE.LineBasicMaterial({ color: "#3d6d8f", transparent: true, opacity: 0.35 });
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= COLS; i++) pts.push(new THREE.Vector3(i, 0, -0.54), new THREE.Vector3(i, 12.8, -0.54));
  for (let j = 0; j <= 12; j++) pts.push(new THREE.Vector3(0, j, -0.54), new THREE.Vector3(COLS, j, -0.54));
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
  const postMat = new THREE.MeshStandardMaterial({ color: "#2b3442", metalness: 0.9, roughness: 0.32 });
  for (const x of [-0.2, COLS + 0.2]) {
    const post = new THREE.Mesh(new RoundedBoxGeometry(0.36, 13.4, 1.3, 3, 0.08), postMat);
    post.position.set(x, 6.2, 0);
    post.castShadow = true; post.receiveShadow = true;
    scene.add(post);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 13.2, 0.05), new THREE.MeshBasicMaterial({ color: "#9ff3ff" }));
    strip.position.set(x + (x < 0 ? 0.2 : -0.2), 6.2, 0.62);
    scene.add(strip);
  }
  const floor = new THREE.Mesh(new RoundedBoxGeometry(COLS + 0.8, 0.3, 1.4, 3, 0.08), postMat);
  floor.position.set(COLS / 2, -0.15, 0);
  floor.receiveShadow = true;
  scene.add(floor);
  const floorGlow = new THREE.Mesh(new THREE.BoxGeometry(COLS + 0.4, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: "#8ff0ea" }));
  floorGlow.position.set(COLS / 2, 0.02, 0.66);
  scene.add(floorGlow);

  // Blocks: lacquered, slightly rounded, with a clear coat that catches the key light.
  const geo = new RoundedBoxGeometry(0.94, 0.94, 0.94, 4, 0.11);
  const mats = COLORS.map((c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.34, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08 }));
  const block = (i: number, j: number, k: number, mat?: THREE.Material) => {
    const m = new THREE.Mesh(geo, mat ?? mats[k]);
    m.position.set(i + 0.5, j + 0.5, 0);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  const rows: (number | null)[][] = [
    [0, 5, 2, 2, 1, 4, null, 3],
    [3, 3, 0, 1, 1, 4, 5, 5], // full: clearing
    [null, 3, 0, null, 2, 2, 5, null],
    [null, null, 0, null, 2, null, null, null],
  ];
  rows.forEach((row, j) => row.forEach((k, i) => {
    if (k === null) return;
    if (j !== 1) { block(i, j, k); return; }
    // The clearing row: each block turns hot white-hot from its own colour.
    const c = new THREE.Color(COLORS[k]).lerp(new THREE.Color("#ffffff"), 0.35);
    block(i, j, k, new THREE.MeshPhysicalMaterial({ color: c, emissive: c, emissiveIntensity: 0.75, roughness: 0.2, clearcoat: 1 }));
  }));
  // The flash across the clearing row and a few shards leaving it.
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(COLS, 0.07), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.95 }));
  beam.position.set(COLS / 2, 1.5, 0.52);
  scene.add(beam);
  const glow = new THREE.PointLight("#cffcff", 10, 8, 1.6);
  glow.position.set(COLS / 2, 1.5, 1.6);
  scene.add(glow);
  let seed = 9;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  const shardGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  for (let q = 0; q < 26; q++) {
    const side = q % 2 ? -1 : 1;
    const s = new THREE.Mesh(shardGeo, mats[q % 6]);
    s.position.set(COLS / 2 + side * (4.4 + rnd() * 2.4), 1.2 + rnd() * 1.4, 0.2 + rnd() * 1.4);
    s.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    s.scale.setScalar(0.6 + rnd() * 1.1);
    scene.add(s);
  }
  // The falling piece (amber L) above its dashed landing ghost.
  const piece: [number, number][] = [[3, 7], [3, 6], [4, 6]];
  for (const [i, j] of piece) block(i, j, 1);
  const ghostMat = new THREE.LineDashedMaterial({ color: "#f2b24c", dashSize: 0.12, gapSize: 0.09, transparent: true, opacity: 0.85 });
  for (const [i, j] of [[3, 5], [3, 4], [4, 4]] as [number, number][]) { // where it will land (column 4 tops out at row 3)
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.86, 0.86, 0.86)), ghostMat);
    e.computeLineDistances();
    e.position.set(i + 0.5, j + 0.5, 0);
    scene.add(e);
  }
  // Stars behind.
  const starPts: number[] = [];
  for (let q = 0; q < 500; q++) starPts.push((rnd() - 0.5) * 120, rnd() * 60 - 10, -40 - rnd() * 30);
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPts, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: "#cfe3ff", size: 0.12, transparent: true, opacity: 0.8 })));

  renderer.render(scene, camera);
  return renderer.domElement.toDataURL("image/png");
};
