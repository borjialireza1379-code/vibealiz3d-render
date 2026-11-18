// Gold ball in a wooden half-pipe, threading a hanging donut (reference-style loop, 1080×1920, 60 fps).
// Motion: motion.ts (pure physics). Here: two bent-plywood ramps on hollow box bases, a long wooden board, a slate
// floor, the glossy donut on two wires, the polished gold ball. Static camera, like the reference.
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, Html5Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  BALL_R, BOX_H, DONUT, DONUT_Y, FPS, FRAMES, GAP_H, LEFT, PEND_L, PIVOT_Y, PLATE_T, RIGHT, T_SCALE, WIDTH,
  ballAt, donutAngle,
} from "./motion";

export const DONUT_FPS = FPS;
export const DONUT_FRAMES = FRAMES;

const BG = "#2b3b48"; // slate blue
const FLOOR = "#33475a";
const GOLD = "#ffc75a";
const DONUT_C = "#f3a9bd"; // glossy pastel-pink glaze
const BOARD_T = 0.12;
const WOOD_L: [number, number, number] = [224, 186, 134]; // birch plywood, light and dark grain
const WOOD_D: [number, number, number] = [168, 120, 72];

// ─── procedural textures (canvas, built once)
const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const vnoise = (x: number, y: number) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const woodTexture = (seed: number, light: [number, number, number], dark: [number, number, number]) => {
  const N = 1024;
  const cv = document.createElement("canvas");
  cv.width = cv.height = N;
  const g = cv.getContext("2d")!;
  const img = g.createImageData(N, N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      // grain lines run along u (texture x): rings vary with v, warped by low-frequency noise
      const warp = 1.3 * vnoise(x * 0.003 + seed, y * 0.01) + 0.25 * vnoise(x * 0.02, y * 0.06 + seed);
      const ring = ((y / N) * 46 + warp) % 1;
      const line = Math.pow(1 - ring, 10) * 0.45 + Math.pow(ring, 30) * 0.2;
      const streak = vnoise(x * 0.002 + seed * 3, y * 1.3) * 0.12 + vnoise(x * 0.04, y * 0.5) * 0.04;
      const figure = (vnoise(x * 0.0015 + seed * 7, y * 0.004) - 0.5) * 0.35; // broad light/dark bands of the veneer
      const m = Math.max(0, Math.min(1, line + streak + figure + 0.08));
      const i = (y * N + x) * 4;
      img.data[i] = light[0] + (dark[0] - light[0]) * m;
      img.data[i + 1] = light[1] + (dark[1] - light[1]) * m;
      img.data[i + 2] = light[2] + (dark[2] - light[2]) * m;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};
const concreteTexture = () => {
  const N = 512;
  const cv = document.createElement("canvas");
  cv.width = cv.height = N;
  const g = cv.getContext("2d")!;
  const img = g.createImageData(N, N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const n = 0.5 * vnoise(x * 0.02, y * 0.02) + 0.3 * vnoise(x * 0.08, y * 0.08) + 0.2 * hash(x, y);
      const v = 200 + 55 * n;
      const i = (y * N + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 10);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

// ─── geometry: a bent-plywood J plate and a hollow box base per ramp (built for the right side, mirrored for the left)
const plateShape = (R: number, flat: number, lip: number, mirror: boolean) => {
  const T = PLATE_T, m = mirror ? -1 : 1;
  const pts: THREE.Vector2[] = [];
  const P = (x: number, y: number) => pts.push(new THREE.Vector2(m * x, y));
  P(GAP_H, 0);
  for (let i = 0; i <= 64; i++) {
    const a = -Math.PI / 2 + (i / 64) * (Math.PI / 2);
    P(flat + R * Math.cos(a), R + R * Math.sin(a));
  }
  P(flat + R, R + lip);
  for (let i = 1; i < 12; i++) {
    const a = Math.PI - (i / 12) * Math.PI;
    P(flat + R + T / 2 + (T / 2) * Math.cos(a), R + lip + (T / 2) * Math.sin(a));
  }
  P(flat + R + T, R + lip);
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * (-Math.PI / 2);
    P(flat + (R + T) * Math.cos(a), R + (R + T) * Math.sin(a));
  }
  P(GAP_H, -T);
  const s = new THREE.Shape(mirror ? pts.reverse() : pts);
  return s;
};
const extrude = (s: THREE.Shape, depth: number, bevel = 0.008) => {
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 48 });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
};
const boxShape = (x0: number, x1: number) => {
  const T = PLATE_T;
  const s = new THREE.Shape();
  s.moveTo(x0, -BOX_H);
  s.lineTo(x1, -BOX_H);
  s.lineTo(x1, -T);
  s.lineTo(x0, -T);
  s.lineTo(x0, -BOX_H);
  const h = new THREE.Path();
  h.moveTo(x0 + T, -BOX_H + T);
  h.lineTo(x0 + T, -2 * T);
  h.lineTo(x1 - T, -2 * T);
  h.lineTo(x1 - T, -BOX_H + T);
  h.lineTo(x0 + T, -BOX_H + T);
  s.holes.push(h);
  return s;
};
const R_END = RIGHT.flat + RIGHT.R + PLATE_T, L_END = LEFT.flat + LEFT.R + PLATE_T;
const GEO = {
  plateR: extrude(plateShape(RIGHT.R, RIGHT.flat, RIGHT.lip, false), WIDTH),
  plateL: extrude(plateShape(LEFT.R, LEFT.flat, LEFT.lip, true), WIDTH),
  boxR: extrude(boxShape(GAP_H, R_END), WIDTH),
  boxL: extrude(boxShape(-L_END, -GAP_H), WIDTH),
};
const BOARD = { x0: -L_END - 1.6, x1: R_END + 0.35, w: WIDTH + 0.5 };

// ─── camera (static)
export const CAM = { pos: new THREE.Vector3(-4.8, 6.0, 6.6), look: new THREE.Vector3(0.0, 0.75, 0), fov: 36 };

const Studio: React.FC<{ cam: typeof CAM }> = ({ cam }) => {
  const { gl, scene, camera } = useThree();
  useMemo(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.05;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    scene.background = new THREE.Color(BG);
    scene.fog = new THREE.Fog(BG, 11, 22);
    scene.environment = new THREE.PMREMGenerator(gl).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.26;
  }, [gl, scene]);
  useLayoutEffect(() => {
    const c = camera as THREE.PerspectiveCamera;
    c.fov = cam.fov;
    c.updateProjectionMatrix();
    c.position.copy(cam.pos);
    c.lookAt(cam.look);
  }, [camera, cam]);
  return null;
};

const Wood: React.FC<{ tex: THREE.Texture; edge?: boolean }> = ({ tex, edge }) => (
  <meshPhysicalMaterial map={tex} color={edge ? "#e8d2b0" : "#ffffff"} roughness={0.5} clearcoat={0.35} clearcoatRoughness={0.35} />
);

const Ramps: React.FC = () => {
  const tex = useMemo(() => {
    const t = woodTexture(1.3, WOOD_L, WOOD_D);
    t.repeat.set(0.55, 0.55);
    return t;
  }, []);
  const edgeTex = useMemo(() => {
    const t = woodTexture(4.1, [236, 210, 168], [200, 162, 112]);
    t.repeat.set(1.5, 1.5);
    return t;
  }, []);
  const mats = useMemo(
    () => [
      new THREE.MeshPhysicalMaterial({ map: edgeTex, roughness: 0.55, clearcoat: 0.2 }),
      new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.48, clearcoat: 0.35, clearcoatRoughness: 0.3 }),
    ],
    [tex, edgeTex],
  );
  return (
    <group>
      {(["plateR", "plateL", "boxR", "boxL"] as const).map((k) => (
        <mesh key={k} geometry={GEO[k]} material={mats} castShadow receiveShadow />
      ))}
    </group>
  );
};

const Board: React.FC = () => {
  const tex = useMemo(() => {
    const t = woodTexture(7.7, [206, 166, 116], [150, 104, 60]);
    t.repeat.set(1, 1);
    return t;
  }, []);
  return (
    <mesh position={[(BOARD.x0 + BOARD.x1) / 2, -BOX_H - BOARD_T / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[BOARD.x1 - BOARD.x0, BOARD_T, BOARD.w]} />
      <Wood tex={tex} />
    </mesh>
  );
};

// soft contact shadow under the board (blurred rectangle)
const contactTexture = () => {
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 256;
  const g = cv.getContext("2d")!;
  g.filter = "blur(18px)";
  g.fillStyle = "rgba(10,16,24,0.85)";
  g.fillRect(60, 60, 392, 136);
  return new THREE.CanvasTexture(cv);
};
const Floor: React.FC = () => {
  const tex = useMemo(concreteTexture, []);
  const contact = useMemo(contactTexture, []);
  const w = BOARD.x1 - BOARD.x0, d = BOARD.w;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -BOX_H - BOARD_T, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color={FLOOR} map={tex} roughness={0.92} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(BOARD.x0 + BOARD.x1) / 2, -BOX_H - BOARD_T + 0.002, 0]}>
        <planeGeometry args={[w * 1.25, d * 1.9]} />
        <meshBasicMaterial map={contact} transparent depthWrite={false} opacity={0.75} />
      </mesh>
    </group>
  );
};

// the donut hangs from the ceiling (far above the frame) on two wires that meet at a small eyelet on its top; the
// ceiling anchors sit on the pivot line (along x)
const WIRE_ANCHOR = 0.4;
const Wire: React.FC<{ a: THREE.Vector3; b: THREE.Vector3 }> = ({ a, b }) => {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const dir = b.clone().sub(a);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return (
    <mesh position={mid} quaternion={q}>
      <cylinderGeometry args={[0.0045, 0.0045, dir.length(), 6]} />
      <meshStandardMaterial color="#d8dde2" metalness={0.8} roughness={0.3} />
    </mesh>
  );
};
const Donut: React.FC<{ t: number }> = ({ t }) => {
  const top = new THREE.Vector3(0, -PEND_L + DONUT.R + DONUT.a + 0.035, 0);
  return (
    <group position={[0, PIVOT_Y, 0]} rotation={[donutAngle(t), 0, 0]}>
      <mesh position={[0, -PEND_L, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow>
        <torusGeometry args={[DONUT.R, DONUT.a, 48, 128]} />
        <meshPhysicalMaterial color={DONUT_C} roughness={0.18} clearcoat={1} clearcoatRoughness={0.05} sheen={0.3} />
      </mesh>
      <mesh position={top} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.03, 0.009, 10, 32]} />
        <meshStandardMaterial color={GOLD} metalness={1} roughness={0.25} />
      </mesh>
      <Wire a={new THREE.Vector3(-WIRE_ANCHOR, 0, 0)} b={top.clone().add(new THREE.Vector3(0, 0.03, 0))} />
      <Wire a={new THREE.Vector3(WIRE_ANCHOR, 0, 0)} b={top.clone().add(new THREE.Vector3(0, 0.03, 0))} />
    </group>
  );
};

const Ball: React.FC<{ t: number }> = ({ t }) => {
  const { p } = ballAt(t);
  return (
    <mesh position={p} castShadow>
      <sphereGeometry args={[BALL_R, 64, 48]} />
      <meshPhysicalMaterial color={GOLD} metalness={1} roughness={0.13} clearcoat={0.4} clearcoatRoughness={0.1} envMapIntensity={4.2} />
    </mesh>
  );
};

export const DonutScene: React.FC<{ t: number; cam?: typeof CAM }> = ({ t, cam = CAM }) => {
  const { width, height } = useVideoConfig();
  return (
    <ThreeCanvas width={width} height={height} shadows camera={{ fov: cam.fov, near: 0.1, far: 80 }} gl={{ antialias: true }}>
      <Studio cam={cam} />
      <hemisphereLight args={["#e9f0ff", "#26313d", 0.16]} />
      <spotLight castShadow position={[3.4, 8.8, 4.2]} angle={0.62} penumbra={0.75} intensity={260} decay={2} color="#ffe2c2" shadow-mapSize={[2048, 2048]} shadow-bias={-0.0003} shadow-normalBias={0.01} shadow-radius={8} />
      <directionalLight position={[-6, 3, 3]} intensity={0.35} color="#9fbfff" />
      <directionalLight position={[1, 5, -7]} intensity={1.1} color="#bcd4ff" />
      <Floor />
      <Board />
      <Ramps />
      <Donut t={t} />
      <Ball t={t} />
    </ThreeCanvas>
  );
};

export const DonutLoop: React.FC<{ silent?: boolean }> = ({ silent }) => {
  const frame = useCurrentFrame();
  const t = (frame / FPS) * T_SCALE;
  return (
    <AbsoluteFill style={{ background: BG }}>
      <DonutScene t={t} />
      {!silent && <Html5Audio src={staticFile("vzdonut/donut.wav")} />}
    </AbsoluteFill>
  );
};

// names the cloud sync expects (folder vzdonut → VZDONUT, VZDONUT_FPS, VZDONUT_FRAMES)
export const VZDONUT = DonutLoop;
export const VZDONUT_FPS = FPS;
export const VZDONUT_FRAMES = FRAMES;
