// Purple/yellow ball rolling round a ring of marble segments that rise and sink in turn (1080×1920, 60 fps,
// seamless, one lap = one loop). Motion: motion.ts. Here: the marble segments (annular sectors with a shallow groove,
// rounded edges) sliding through a slot in a deep-green pedestal, a wall of pale stone cubes behind, the two-tone
// ball. Static camera.
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, Html5Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {
  BALL_R, FPS, FRAMES, GAP, GROOVE, GROOVE_HALF, H_TOP, LAP, N_SEG, R_I, R_M, R_O, SEG,
  ballAt, ballRoll, segHeight,
} from "./motion";

export const STONE_FPS = FPS;
export const STONE_FRAMES = FRAMES;

const BG = "#b9c3cf";
const PURPLE = "#6a2fd6";
const YELLOW = "#ffc81f";
const PED = "#2c5a50"; // deep green pedestal
const R_P = 1.72; // pedestal radius
const SLOT = 0.016; // slot around the ring in the pedestal top
const BODY = H_TOP + 0.34; // segment height below its top (always reaches into the pedestal)
const BEVEL = 0.014;

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
const fbm = (x: number, y: number, oct = 5) => {
  let s = 0, a = 0.5, f = 1;
  for (let o = 0; o < oct; o++) {
    s += a * vnoise(x * f, y * f);
    f *= 2.03;
    a *= 0.5;
  }
  return s;
};
const canvasTex = (N: number, M: number, px: (x: number, y: number) => [number, number, number]) => {
  const cv = document.createElement("canvas");
  cv.width = N;
  cv.height = M;
  const g = cv.getContext("2d")!;
  const img = g.createImageData(N, M);
  for (let y = 0; y < M; y++)
    for (let x = 0; x < N; x++) {
      const [r, gg, b] = px(x, y);
      const i = (y * N + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = gg;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  return cv;
};
const toTex = (cv: HTMLCanvasElement, srgb = true) => {
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};
// white marble: soft grey clouds, a few thin dark veins, tiny pits
const marbleCanvas = () =>
  canvasTex(1024, 1024, (x, y) => {
    const s = 1 / 1024;
    const cloud = fbm(x * s * 5, y * s * 5);
    const tw = fbm(x * s * 2.5 + 7.1, y * s * 2.5 + 2.3);
    const v1 = Math.abs(Math.sin((x * s * 1.6 + y * s * 0.9 + tw * 3.2) * Math.PI * 2));
    const v2 = Math.abs(Math.sin((x * s * 0.9 - y * s * 1.7 + fbm(x * s * 4, y * s * 4 + 9) * 2.8) * Math.PI * 2));
    // soft grey halo around a fine darker core; the second family fainter
    // vein strength fades in and out along its length, so lines don't read as contour lines
    const fade = Math.max(0, fbm(x * s * 3 + 4.2, y * s * 3 + 1.7) * 1.8 - 0.55);
    const vein = (Math.exp(-v1 * 7) * 0.2 + Math.exp(-v1 * 45) * 0.22) * fade + (Math.exp(-v2 * 10) * 0.1 + Math.exp(-v2 * 70) * 0.1) * (1.2 - fade);
    const speck = hash(x, y) > 0.997 ? 0.12 : 0;
    const m = Math.max(0, Math.min(1, (cloud - 0.3) * 0.45 + vein + speck + fbm(x * s * 60, y * s * 60, 2) * 0.05));
    return [226 - 118 * m, 224 - 114 * m, 220 - 104 * m];
  });
// pale cool stone for the wall cubes
const wallCanvas = () =>
  canvasTex(512, 512, (x, y) => {
    const s = 1 / 512;
    const n = fbm(x * s * 4, y * s * 4) * 0.6 + fbm(x * s * 18, y * s * 18) * 0.28 + fbm(x * s * 70, y * s * 70, 2) * 0.12;
    const m = (n - 0.45) * 0.55 + hash(x, y) * 0.035;
    return [182 - 70 * m, 192 - 70 * m, 205 - 66 * m];
  });
// deep green painted plaster with brush scratches
const pedCanvas = () => {
  const N = 1024;
  const base = new THREE.Color(PED).convertLinearToSRGB(); // three.js colours are linear; the canvas wants sRGB
  const cv = canvasTex(N, N, (x, y) => {
    const s = 1 / N;
    const n = fbm(x * s * 8, y * s * 3) * 0.6 + fbm(x * s * 40, y * s * 12) * 0.4;
    const k = 0.82 + (n - 0.5) * 0.35;
    return [base.r * 255 * k + 8, base.g * 255 * k + 8, base.b * 255 * k + 8].map((v) => Math.max(0, Math.min(255, v))) as [number, number, number];
  });
  const g = cv.getContext("2d")!;
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) {
    const x = rnd() * N, y = rnd() * N, len = 20 + rnd() * 140, a = (rnd() - 0.5) * 0.9;
    g.strokeStyle = rnd() < 0.6 ? `rgba(160,200,185,${0.04 + rnd() * 0.08})` : `rgba(10,30,25,${0.05 + rnd() * 0.08})`;
    g.lineWidth = 0.6 + rnd() * 1.6;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  return cv;
};
// ball: purple north half, yellow south half, a thin dark seam on the equator, faint grain
const ballCanvas = () => {
  const P = new THREE.Color(PURPLE), Y = new THREE.Color(YELLOW);
  return canvasTex(1024, 512, (x, y) => {
    const lat = 0.5 - y / 512; // +0.5 north pole … −0.5 south pole
    const g = 1 + (fbm(x / 60, y / 60, 3) - 0.5) * 0.06;
    if (Math.abs(lat) < 0.0085) return [26, 20, 30];
    const c = lat > 0 ? P : Y;
    // three.js colours are linear; the canvas wants sRGB
    const s = c.clone().convertLinearToSRGB();
    return [s.r * 255 * g, s.g * 255 * g, s.b * 255 * g].map((v) => Math.max(0, Math.min(255, v))) as [number, number, number];
  });
};

// ─── segment geometry: one annular sector (lathe of the cross-section) + two flat end caps; uv in world units
const profile = (() => {
  const pts: [number, number][] = [];
  const arc = (cx: number, cy: number, r: number, a0: number, a1: number, n: number) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  };
  // outer wall up → top (outer → inner, across the groove) → inner wall down; outside is on the right of the walk
  pts.push([R_O, -BODY]);
  pts.push([R_O, -BEVEL - 0.2]);
  arc(R_O - BEVEL, -BEVEL, BEVEL, 0, Math.PI / 2, 5);
  pts.push([R_M + GROOVE_HALF + 0.012, 0]);
  // groove: centre (R_M, r − d), from its outer top edge round the bottom to the inner top edge
  const gy = GROOVE.r - GROOVE.d, edge = Math.asin(GROOVE_HALF / GROOVE.r);
  arc(R_M, gy, GROOVE.r, -Math.PI / 2 + edge, -Math.PI / 2 - edge, 28);
  pts.push([R_M - GROOVE_HALF - 0.012, 0]);
  arc(R_I + BEVEL, -BEVEL, BEVEL, Math.PI / 2, Math.PI, 5);
  pts.push([R_I, -BEVEL - 0.2]);
  pts.push([R_I, -BODY]);
  return pts;
})();

const segGeometry = (i: number) => {
  const gapA = GAP / R_M;
  const a0 = i * SEG - SEG / 2 + gapA / 2, len = SEG - gapA;
  const lathe = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 40, a0, len);
  // world-unit uvs: u = arc length at that radius, v = distance along the profile; offset per segment
  const sAlong: number[] = [0];
  for (let k = 1; k < profile.length; k++) sAlong.push(sAlong[k - 1] + Math.hypot(profile[k][0] - profile[k - 1][0], profile[k][1] - profile[k - 1][1]));
  const uv = lathe.getAttribute("uv") as THREE.BufferAttribute;
  const np = profile.length;
  const TILE = 2.6, ou = (i * 0.37) % 1, ov = (i * 0.61) % 1;
  for (let j = 0; j <= 40; j++)
    for (let k = 0; k < np; k++) {
      const idx = j * np + k;
      const r = profile[k][0];
      uv.setXY(idx, ((j / 40) * len * r) / TILE + ou, sAlong[k] / TILE + ov);
    }
  uv.needsUpdate = true;
  // end caps: the cross-section polygon (closed along the bottom)
  const shapeOf = (sign: number) => new THREE.Shape(profile.map(([r, y]) => new THREE.Vector2(sign * r, y)));
  const capStart = new THREE.ShapeGeometry(shapeOf(1), 24);
  capStart.rotateY(a0 - Math.PI / 2);
  const capEnd = new THREE.ShapeGeometry(shapeOf(-1), 24);
  capEnd.rotateY(a0 + len + Math.PI / 2);
  for (const c of [capStart, capEnd]) {
    const u = c.getAttribute("uv") as THREE.BufferAttribute;
    for (let k = 0; k < u.count; k++) u.setXY(k, Math.abs(u.getX(k)) / TILE + ou + 0.5, u.getY(k) / TILE + ov);
  }
  return [lathe, capStart, capEnd];
};
const SEG_GEO = Array.from({ length: N_SEG }, (_, i) => segGeometry(i));

// ─── camera (static)
export const CAM = { pos: new THREE.Vector3(0, 4.15, 6.2), look: new THREE.Vector3(0, 0.12, 0), fov: 37 };

const Studio: React.FC<{ cam: typeof CAM }> = ({ cam }) => {
  const { gl, scene, camera } = useThree();
  useMemo(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 0.92;
    gl.shadowMap.type = THREE.PCFShadowMap;
    scene.background = new THREE.Color(BG);
    scene.environment = new THREE.PMREMGenerator(gl).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.3;
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

const useMarble = () =>
  useMemo(() => {
    const cv = marbleCanvas();
    const map = toTex(cv);
    const bump = toTex(cv, false);
    return new THREE.MeshPhysicalMaterial({ map, bumpMap: bump, bumpScale: 0.8, roughness: 0.36, clearcoat: 0.25, clearcoatRoughness: 0.4 });
  }, []);

const Ring: React.FC<{ t: number; mat: THREE.Material }> = ({ t, mat }) => (
  <group>
    {SEG_GEO.map((geos, i) => (
      <group key={i} position={[0, segHeight(i, t), 0]}>
        {geos.map((g, k) => (
          <mesh key={k} geometry={g} material={mat} castShadow receiveShadow />
        ))}
      </group>
    ))}
  </group>
);

const Pedestal: React.FC<{ marble: THREE.Material }> = ({ marble }) => {
  const mat = useMemo(() => {
    const t = toTex(pedCanvas());
    t.repeat.set(5, 2);
    return new THREE.MeshPhysicalMaterial({ map: t, color: "#ffffff", roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.35 });
  }, []);
  const top = useMemo(() => {
    const t = toTex(pedCanvas());
    t.repeat.set(1.2, 1.2);
    return new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.3 });
  }, []);
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: "#0d1412", roughness: 1, side: THREE.DoubleSide }), []);
  return (
    <group>
      <mesh position={[0, -4.015, 0]} receiveShadow material={mat}>
        <cylinderGeometry args={[R_P, R_P, 7.97, 128, 1, true]} />
      </mesh>
      {/* rounded top edge */}
      <mesh position={[0, -0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={top}>
        <torusGeometry args={[R_P - 0.03, 0.03, 12, 128]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow material={top}>
        <ringGeometry args={[R_O + SLOT, R_P - 0.03, 128, 1]} />
      </mesh>
      {/* the hollow centre: a marble floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow material={marble}>
        <circleGeometry args={[R_I - SLOT, 96]} />
      </mesh>
      {/* the slot the segments slide through */}
      <mesh position={[0, -0.25, 0]} material={dark}>
        <cylinderGeometry args={[R_O + SLOT, R_O + SLOT, 0.5, 128, 1, true]} />
      </mesh>
      <mesh position={[0, -0.25, 0]} material={dark}>
        <cylinderGeometry args={[R_I - SLOT, R_I - SLOT, 0.5, 96, 1, true]} />
      </mesh>
      <mesh position={[0, -0.12, 0]} rotation={[-Math.PI / 2, 0, 0]} material={dark}>
        <ringGeometry args={[R_I - SLOT, R_O + SLOT, 128, 1]} />
      </mesh>
    </group>
  );
};

// wall of pale stone cubes, some pushed out further than others
const WALL_Z = -2.55;
const CELL = 0.66;
const Wall: React.FC = () => {
  const tex = useMemo(() => toTex(wallCanvas()), []);
  // four slightly different tints, so the blocks read as separate stones
  const mats = useMemo(
    () => ["#ffffff", "#f1f4fa", "#e6ebf2", "#f8f6f2"].map((c) => new THREE.MeshPhysicalMaterial({ map: tex, color: c, roughness: 0.66, clearcoat: 0.08 })),
    [tex],
  );
  const cubes = useMemo(() => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const out: { p: [number, number, number]; s: [number, number, number]; g: THREE.BufferGeometry; m: number }[] = [];
    const used = new Set<string>();
    for (let row = -5; row < 11; row++)
      for (let col = -7; col <= 7; col++) {
        const key = `${row},${col}`;
        if (used.has(key)) continue;
        // a few big 2×2 blocks
        const big = rnd() < 0.14 && !used.has(`${row + 1},${col}`) && !used.has(`${row},${col + 1}`) && col < 7;
        const n = big ? 2 : 1;
        for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) used.add(`${row + a},${col + b}`);
        const size = CELL * n - 0.012;
        const r = rnd();
        const out_ = big ? 0.25 + rnd() * 0.3 : r < 0.55 ? rnd() * 0.05 : r < 0.85 ? 0.08 + rnd() * 0.12 : 0.22 + rnd() * 0.2;
        const g = new RoundedBoxGeometry(size, size, size, 3, 0.022);
        const uv = g.getAttribute("uv") as THREE.BufferAttribute;
        const ou = rnd(), ov = rnd(), sc = size / 2.2;
        for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * sc + ou, uv.getY(k) * sc + ov);
        out.push({ p: [(col + (n - 1) / 2) * CELL, (row + (n - 1) / 2) * CELL + 0.2, WALL_Z - size / 2 + out_], s: [size, size, size], g, m: Math.floor(rnd() * 4) });
      }
    return out;
  }, []);
  return (
    <group>
      {cubes.map((c, i) => (
        <mesh key={i} position={c.p} geometry={c.g} material={mats[c.m]} castShadow receiveShadow />
      ))}
      {/* dark backing behind the joints */}
      <mesh position={[0, 2, WALL_Z - CELL - 0.05]}>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial color="#5d6772" roughness={1} />
      </mesh>
    </group>
  );
};

// warm key from the upper left (sun-like), soft shadows over the ring, the pedestal top and the wall
const KeyLight: React.FC = () => {
  const light = useMemo(() => {
    const l = new THREE.DirectionalLight("#fff0dc", 2.3);
    l.position.set(-4.2, 7.5, 3.2);
    l.castShadow = true;
    l.shadow.mapSize.set(4096, 4096);
    const c = l.shadow.camera as THREE.OrthographicCamera;
    c.left = -4.5; c.right = 4.5; c.top = 4.5; c.bottom = -4.5; c.near = 1; c.far = 20;
    l.shadow.bias = -0.0002;
    l.shadow.normalBias = 0.01;
    l.shadow.radius = 5;
    l.target.position.set(0, 0.3, -0.6);
    return l;
  }, []);
  return (
    <>
      <primitive object={light} />
      <primitive object={light.target} />
    </>
  );
};

const Q_BASE =new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0, 0.0));
const Ball: React.FC<{ t: number }> = ({ t }) => {
  const tex = useMemo(() => {
    const t_ = toTex(ballCanvas());
    t_.wrapS = THREE.RepeatWrapping;
    t_.wrapT = THREE.ClampToEdgeWrapping;
    return t_;
  }, []);
  const { p } = ballAt(t);
  const { yaw, roll } = ballRoll(t);
  const q = new THREE.Quaternion()
    .setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll))
    .multiply(Q_BASE);
  return (
    <mesh position={p} quaternion={q} castShadow receiveShadow>
      <sphereGeometry args={[BALL_R, 96, 64]} />
      <meshPhysicalMaterial map={tex} roughness={0.5} clearcoat={0.3} clearcoatRoughness={0.35} />
    </mesh>
  );
};

export const StoneScene: React.FC<{ t: number; cam?: typeof CAM }> = ({ t, cam = CAM }) => {
  const { width, height } = useVideoConfig();
  const marble = useMarble();
  return (
    <ThreeCanvas width={width} height={height} shadows camera={{ fov: cam.fov, near: 0.1, far: 60 }} gl={{ antialias: true }}>
      <Studio cam={cam} />
      <hemisphereLight args={["#e6eeff", "#2a3a36", 0.18]} />
      <KeyLight />
      <directionalLight position={[4, 3.5, -2]} intensity={0.45} color="#bcd0ff" />
      <directionalLight position={[2, 2, 6]} intensity={0.18} color="#ffffff" />
      <Wall />
      <Pedestal marble={marble} />
      <Ring t={t} mat={marble} />
      <Ball t={t} />
    </ThreeCanvas>
  );
};

export const StoneLoop: React.FC<{ silent?: boolean }> = ({ silent }) => {
  const frame = useCurrentFrame();
  const t = (frame / FPS) * (LAP / (FRAMES / FPS));
  return (
    <AbsoluteFill style={{ background: BG }}>
      <StoneScene t={t} />
      {!silent && <Html5Audio src={staticFile("vzstone/stone.wav")} />}
    </AbsoluteFill>
  );
};

// names the cloud sync expects (folder vzstone → VZSTONE, VZSTONE_FPS, VZSTONE_FRAMES)
export const VZSTONE = StoneLoop;
export const VZSTONE_FPS = FPS;
export const VZSTONE_FRAMES = FRAMES;
