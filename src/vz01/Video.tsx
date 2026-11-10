// Vibealiz3D #01 — Guess all 12 meme songs (16:9, 60 fps, ~2 min). A white ball hops along a different
// instrument-world per song (keypad keys, neon slabs, tetrominoes, drums, planks, stone pillars, coins, slabs,
// piano keys, gem tiles, organ pipes, disco tiles); every landing plays one note (public/vz01/mix-norm.wav).
// 3D CTAs (only two): mid-video the ball presses a 3D subscribe button (+ bell), at the end it lands on a stage
// under a ringing bell and the score card appears. Local render: --gl=angle · cloud (no GPU): --gl=swangle.
import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import { BloomEffect, EffectComposer, EffectPass, RenderPass, ToneMappingEffect, ToneMappingMode, VignetteEffect } from "postprocessing";
import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, Html5Audio, continueRender, delayRender, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { CTA_HIT, DURATION, FINAL_HIT, FPS, FRAMES, HITS, INTRO, SONGS, SPANS, type Hit, type Song } from "./songs";

export const VZ01_FPS = FPS;
export const VZ01_FRAMES = FRAMES;
/** one still per world + the CTA and the outro, for the -Look composition */
export const VZ01_LOOK = [1.6, ...SPANS.map((s) => s.start + (s.end - s.start) * 0.35), CTA_HIT.t + 0.25, FINAL_HIT.t + 3];

const BR = 0.17; // ball radius
const G = 24; // gravity of the hops
const WALL_Z = -1.9;
const V3 = THREE.Vector3;
const clamp01 = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ─────────────── fonts + canvas labels (built once the fonts are in)
const HEAD = "Anton";
const LABEL = "Chakra Petch";
let LABELS: THREE.CanvasTexture[] = [];
const label = (text: string, done: boolean) => {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.font = `150px ${HEAD}`;
  g.textBaseline = "middle";
  if (done) {
    g.lineWidth = 22;
    g.strokeStyle = "#fff";
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(70, 132);
    g.lineTo(115, 178);
    g.lineTo(200, 82);
    g.stroke();
  } else {
    g.beginPath();
    g.moveTo(80, 70);
    g.lineTo(80, 186);
    g.lineTo(190, 128);
    g.fill();
  }
  g.fillText(text, 245, 136);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
};
const fontHandle = delayRender("vz01 fonts");
Promise.all(
  [
    [HEAD, "fonts/Anton-Regular.ttf"],
    [LABEL, "fonts/ChakraPetch-Bold.ttf"],
  ].map(([family, file]) => new FontFace(family, `url('${staticFile(file)}')`).load().then((f) => document.fonts.add(f))),
)
  .then(() => {
    LABELS = [label("SUBSCRIBE", false), label("SUBSCRIBED", true)];
    continueRender(fontHandle);
  })
  .catch((err) => console.error("vz01 font load failed", err));

// ─────────────── deterministic hash
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// ─────────────── motion
const land = (h: Hit) => new V3(h.x, h.y + BR, 0.3);
// long hops (transitions, held notes) get a lower gravity so the apex stays in frame (≤ HMAX)
const HMAX = 1.25;
const arc = (a: THREE.Vector3, b: THREE.Vector3, T: number, s: number) => {
  const g = Math.min(G, (8 * HMAX) / (T * T));
  const vy = (b.y - a.y) / T + (g * T) / 2;
  const u = s / T;
  return new V3(a.x + (b.x - a.x) * u, a.y + vy * s - (g * s * s) / 2, a.z + (b.z - a.z) * u);
};
const lastIndex = (t: number) => {
  let lo = -1, hi = HITS.length - 1;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (HITS[m].t <= t) lo = m;
    else hi = m - 1;
  }
  return lo;
};
const DROP = 1.1;
const DROP_FROM = land(HITS[0]).add(new V3(-1.0, 3.6, 0));
function ballAt(t: number): THREE.Vector3 {
  if (t < HITS[0].t) return arc(DROP_FROM, land(HITS[0]), DROP, t - (HITS[0].t - DROP));
  if (t >= FINAL_HIT.t) {
    // settles on the stage in shrinking bounces
    let s = t - FINAL_HIT.t, h = 0.6;
    const p = land(FINAL_HIT);
    while (h > 0.003) {
      const T = 2 * Math.sqrt((2 * h) / G);
      if (s < T) return p.add(new V3(0, Math.sqrt(2 * G * h) * s - (G * s * s) / 2, 0));
      s -= T;
      h *= 0.4;
    }
    return p;
  }
  const i = lastIndex(t);
  return arc(land(HITS[i]), land(HITS[i + 1]), HITS[i + 1].t - HITS[i].t, t - HITS[i].t);
}
// the camera follows a gaussian-smoothed track (±1 s), never the hop itself
function trackAt(t: number) {
  const p = new V3();
  let w = 0;
  for (let j = -12; j <= 12; j++) {
    const k = Math.exp(-((j / 6) ** 2));
    p.addScaledVector(ballAt(Math.min(FINAL_HIT.t, Math.max(HITS[0].t - 0.4, t + j * 0.08))), k);
    w += k;
  }
  return p.divideScalar(w);
}

// which song the HUD and the world are on: switches during the hop into a song
const songAt = (t: number) => {
  let k = -1;
  for (let i = 0; i < SPANS.length; i++) if (t >= SPANS[i].start - 0.9) k = i;
  return k;
};
const songOfHit = (idx: number) => {
  for (let j = idx; j >= 0; j--) if (HITS[j].song >= 0) return HITS[j].song;
  return 0;
};
const songAtX = (x: number) => {
  let lo = 0, hi = HITS.length - 1;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (HITS[m].x <= x) lo = m;
    else hi = m - 1;
  }
  return songOfHit(lo);
};
const wallAt = (t: number) => {
  const k = Math.max(0, songAt(t));
  const from = new THREE.Color(SONGS[Math.max(0, k - 1)].wall);
  const to = new THREE.Color(SONGS[k].wall);
  const u = k === 0 ? 1 : interpolate(t, [SPANS[k].start - 1.3, SPANS[k].start - 0.2], [0, 1], clamp01);
  return from.lerp(to, u);
};

// ─────────────── shared geometry + textures
const GEO = {
  key: new RoundedBoxGeometry(0.62, 0.24, 0.9, 4, 0.07),
  button: new RoundedBoxGeometry(1.45, 0.26, 0.9, 4, 0.08),
  slab: new RoundedBoxGeometry(0.66, 0.16, 1.0, 3, 0.04),
  pianoW: new RoundedBoxGeometry(0.6, 0.16, 1.1, 3, 0.03),
  pianoB: new RoundedBoxGeometry(0.26, 0.12, 0.7, 3, 0.03),
  neon: new THREE.BoxGeometry(0.7, 0.14, 1.1),
  neonStrip: new THREE.BoxGeometry(0.7, 0.03, 0.05),
  neonTop: new THREE.BoxGeometry(0.64, 0.01, 1.02),
  cube: new RoundedBoxGeometry(0.235, 0.235, 0.6, 2, 0.025),
  drum: new THREE.CylinderGeometry(0.3, 0.3, 0.45, 40),
  drumTop: new THREE.CylinderGeometry(0.285, 0.285, 0.02, 40),
  rim: new THREE.TorusGeometry(0.3, 0.022, 10, 48),
  plank: new THREE.BoxGeometry(0.72, 0.12, 1.2),
  pillar: new THREE.CylinderGeometry(0.32, 0.36, 3, 6),
  crystal: new THREE.OctahedronGeometry(0.13),
  coin: new THREE.CylinderGeometry(0.32, 0.32, 0.09, 48),
  coinRing: new THREE.TorusGeometry(0.22, 0.018, 8, 48),
  gem: new THREE.CylinderGeometry(0.36, 0.28, 0.16, 6),
  organ: new THREE.CylinderGeometry(0.2, 0.2, 2.6, 40, 1, true),
  organCap: new THREE.CylinderGeometry(0.19, 0.19, 0.04, 40),
  organRing: new THREE.TorusGeometry(0.2, 0.03, 10, 48),
  discoFrame: new THREE.BoxGeometry(0.7, 0.1, 0.92),
  discoTile: new THREE.BoxGeometry(0.6, 0.02, 0.82),
  stick: new THREE.CylinderGeometry(1, 1, 1, 14),
  ring: new THREE.TorusGeometry(1, 0.22, 10, 32),
  spark: new THREE.SphereGeometry(1, 8, 6),
  confetti: new THREE.BoxGeometry(1, 0.15, 0.6),
  bell: new THREE.LatheGeometry(
    [
      [0, 0.02], [0.33, 0], [0.31, 0.06], [0.25, 0.18], [0.21, 0.36], [0.18, 0.46], [0.11, 0.53], [0, 0.55],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    40,
  ),
};
const canvasTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};
const STRIPES = canvasTex(256, 32, (g) => {
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? "#f4f0e8" : "#e8473d";
    g.fillRect(i * 32, 0, 32, 32);
  }
});
const WOOD = canvasTex(256, 256, (g) => {
  g.fillStyle = "#fff";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 46; i++) {
    g.strokeStyle = `rgba(70,40,20,${0.08 + hash(i) * 0.18})`;
    g.lineWidth = 1 + hash(i + 9) * 3;
    g.beginPath();
    const y = hash(i + 3) * 256;
    g.moveTo(0, y);
    for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x * 0.03 + i) * 4);
    g.stroke();
  }
});
const TETRO: [number, number][][] = [
  [[0, 0], [0, -1], [0, -2], [0, -3]],
  [[0, 0], [1, 0], [0, -1], [1, -1]],
  [[-1, 0], [0, 0], [1, 0], [0, -1]],
  [[0, 0], [0, -1], [0, -2], [1, -2]],
  [[0, 0], [1, 0], [-1, -1], [0, -1]],
  [[0, 0], [0, -1], [0, -2], [-1, -2]],
  [[-1, 0], [0, 0], [0, -1], [1, -1]],
];

// ─────────────── camera + look
const Rig: React.FC<{ t: number }> = ({ t }) => {
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    const c = trackAt(t);
    const outro = interpolate(t, [FINAL_HIT.t, FINAL_HIT.t + 6], [0, 1], clamp01);
    const kick = t > CTA_HIT.t ? 0.06 * Math.exp(-(t - CTA_HIT.t) / 0.12) * Math.sin((t - CTA_HIT.t) * 70) : 0;
    camera.position.set(c.x - 2.3 + 0.5 * Math.sin(t * 0.33) + 0.6 * outro, c.y + 1.8 + 0.15 * Math.sin(t * 0.47) + kick + 0.5 * outro, 7.2 - 0.5 * outro);
    camera.lookAt(c.x + 1.3 - 3.1 * outro, c.y - 0.3 + 1.55 * outro, 0);
  }, [camera, t]);
  return null;
};

const Look: React.FC = () => {
  const { gl, scene, camera, size } = useThree();
  const composer = useMemo(() => {
    gl.toneMapping = THREE.NoToneMapping;
    const pm = new THREE.PMREMGenerator(gl);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.32;
    const c = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType, multisampling: 4 });
    c.addPass(new RenderPass(scene, camera));
    c.addPass(
      new EffectPass(
        camera,
        new BloomEffect({ mipmapBlur: true, luminanceThreshold: 1.15, luminanceSmoothing: 0.2, intensity: 0.75, radius: 0.65 }),
        new VignetteEffect({ darkness: 0.45, offset: 0.35 }),
        new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
      ),
    );
    c.setSize(size.width, size.height);
    return c;
  }, [gl, scene, camera, size.width, size.height]);
  useFrame(() => composer.render(), 1);
  return null;
};

// ─────────────── pads
type PadProps = { h: Hit; idx: number; t: number };
const Phys: React.FC<{ color: string; flash?: number; glow?: string; rough?: number; metal?: number; coat?: number; map?: THREE.Texture; base?: number; flat?: boolean }> = ({ color, flash = 0, glow, rough = 0.35, metal = 0, coat = 0.8, map, base = 0, flat }) => (
  <meshPhysicalMaterial color={color} roughness={rough} metalness={metal} clearcoat={coat} clearcoatRoughness={0.15} emissive={glow ?? color} emissiveIntensity={base + flash} map={map} flatShading={flat} />
);

const NotePad: React.FC<PadProps> = ({ h, idx, t }) => {
  const s = SONGS[h.song];
  const k = t - h.t;
  const hit = k >= 0;
  const flash = hit ? Math.exp(-k / 0.2) : 0;
  const spring = hit ? Math.exp(-k * 7) * Math.cos(k * 30) : 0;
  const c = s.colors[h.i % s.colors.length];
  const r = hash(idx);
  let body: React.ReactNode = null;
  switch (s.pad) {
    case "key":
      body = (
        <mesh geometry={GEO.key} position={[0, -0.12, 0]} castShadow receiveShadow>
          <Phys color={c} glow={s.accent} flash={1.4 * flash} coat={0.6} />
        </mesh>
      );
      break;
    case "neon": {
      const n = s.colors[1 + (h.i % 2)];
      body = (
        <>
          <mesh geometry={GEO.neon} position={[0, -0.07, 0]} castShadow receiveShadow>
            <Phys color={s.colors[0]} rough={0.4} metal={0.3} coat={0.5} />
          </mesh>
          <mesh geometry={GEO.neonStrip} position={[0, -0.03, 0.56]}>
            <meshBasicMaterial color={new THREE.Color(n).multiplyScalar(1.6 + 3 * flash)} toneMapped={false} />
          </mesh>
          <mesh geometry={GEO.neonTop} position={[0, 0.002, 0]}>
            <Phys color="#1c1e24" glow={n} flash={2.6 * flash} rough={0.3} />
          </mesh>
        </>
      );
      break;
    }
    case "tetro": {
      const shape = TETRO[Math.floor(r * TETRO.length)];
      const col = s.colors[Math.floor(hash(idx + 7) * s.colors.length)];
      body = (
        <>
          {shape.map(([cx, cy], j) => (
            <mesh key={j} geometry={GEO.cube} position={[cx * 0.24, -0.12 + cy * 0.24, 0]} castShadow receiveShadow>
              <Phys color={col} flash={(j === 0 ? 1.6 : 0.6) * flash} rough={0.3} />
            </mesh>
          ))}
        </>
      );
      break;
    }
    case "drum":
      body = (
        <>
          <mesh geometry={GEO.drum} position={[0, -0.245, 0]} castShadow receiveShadow>
            <Phys color="#ffffff" map={STRIPES} rough={0.4} coat={0.7} />
          </mesh>
          <mesh geometry={GEO.drumTop} position={[0, -0.012, 0]} receiveShadow>
            <Phys color="#f6efe2" glow={s.accent} flash={1.3 * flash} rough={0.6} coat={0} />
          </mesh>
          <mesh geometry={GEO.rim} position={[0, -0.01, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <Phys color="#e9c46a" metal={0.9} rough={0.25} />
          </mesh>
        </>
      );
      break;
    case "plank":
      body = (
        <mesh geometry={GEO.plank} position={[0, -0.06, 0]} rotation={[0, (r - 0.5) * 0.35, (hash(idx + 2) - 0.5) * 0.06]} castShadow receiveShadow>
          <meshStandardMaterial color={c} map={WOOD} roughness={0.75} emissive={s.accent} emissiveIntensity={0.9 * flash} />
        </mesh>
      );
      break;
    case "pillar":
      body = (
        <>
          <mesh geometry={GEO.pillar} position={[0, -1.5, 0]} rotation={[0, r, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={c} roughness={0.92} flatShading emissive={s.accent} emissiveIntensity={0.6 * flash} />
          </mesh>
          <mesh geometry={GEO.crystal} position={[0.12, 0.14, -0.38]} rotation={[0, t * 0.8 + r * 6, 0.3]} castShadow>
            <Phys color={s.colors[2 + (h.i % 2)]} flash={0.5 + 3 * flash} rough={0.1} coat={1} />
          </mesh>
        </>
      );
      break;
    case "coin":
      body = (
        <group rotation={[0, 0, 0.25 * spring]}>
          <mesh geometry={GEO.coin} position={[0, -0.045, 0]} castShadow receiveShadow>
            <Phys color={c} metal={1} rough={0.22} coat={0.4} flash={0.5 * flash} />
          </mesh>
          <mesh geometry={GEO.coinRing} position={[0, 0.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <Phys color={c} metal={1} rough={0.18} flash={0.8 * flash} />
          </mesh>
        </group>
      );
      break;
    case "slab":
      body = (
        <mesh geometry={GEO.slab} position={[0, -0.08, 0]} castShadow receiveShadow>
          <Phys color={c} glow={s.accent} flash={1.5 * flash} rough={0.35} />
        </mesh>
      );
      break;
    case "piano":
      body = (
        <>
          <mesh geometry={GEO.pianoW} position={[0, -0.08, 0]} castShadow receiveShadow>
            <Phys color={s.colors[0]} glow={s.accent} flash={1.4 * flash} rough={0.25} coat={1} />
          </mesh>
          <mesh geometry={GEO.pianoB} position={[0.33, -0.02, -0.32]} castShadow receiveShadow>
            <Phys color={s.colors[1]} rough={0.2} coat={1} />
          </mesh>
        </>
      );
      break;
    case "gem":
      body = (
        <mesh geometry={GEO.gem} position={[0, -0.08, 0]} rotation={[0, r, 0]} castShadow receiveShadow>
          <meshPhysicalMaterial color={c} roughness={0.12} clearcoat={1} iridescence={0.7} flatShading emissive={s.accent} emissiveIntensity={0.15 + 1.6 * flash} />
        </mesh>
      );
      break;
    case "organ":
      body = (
        <>
          <mesh geometry={GEO.organ} position={[0, -1.3, 0]} castShadow receiveShadow>
            <Phys color={c} metal={0.95} rough={0.22} coat={0.3} flash={0.7 * flash} />
          </mesh>
          <mesh geometry={GEO.organCap} position={[0, -0.03, 0]}>
            <meshStandardMaterial color="#3a2f1c" roughness={0.6} emissive={s.accent} emissiveIntensity={2.4 * flash} />
          </mesh>
          <mesh geometry={GEO.organRing} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <Phys color={c} metal={1} rough={0.2} />
          </mesh>
        </>
      );
      break;
    case "disco": {
      const hue = s.colors[(h.i + Math.floor(t * 4)) % s.colors.length];
      body = (
        <>
          <mesh geometry={GEO.discoFrame} position={[0, -0.06, 0]} castShadow receiveShadow>
            <Phys color="#2a2b31" rough={0.35} metal={0.4} />
          </mesh>
          <mesh geometry={GEO.discoTile} position={[0, -0.005, 0]}>
            <Phys color={hue} flash={0.7 + 2.4 * flash} rough={0.15} coat={1} />
          </mesh>
        </>
      );
      break;
    }
  }
  return (
    <group position={[h.x, h.y - 0.08 * spring, 0]} rotation={[0.04 * spring, 0, 0]} dispose={null}>
      {body}
    </group>
  );
};

// the subscribe button: the ball lands on it, it sinks, turns grey and says SUBSCRIBED; a bell swings beside it
const CtaPad: React.FC<{ t: number }> = ({ t }) => {
  const h = CTA_HIT;
  const k = t - h.t;
  const pressed = k >= 0;
  const sink = pressed ? 0.13 * (1 - Math.exp(-k / 0.03)) - 0.05 * Math.exp(-k / 0.3) * Math.sin(k * 18) * (k > 0.1 ? 1 : 0) : 0;
  const red = new THREE.Color("#ff2b2b").lerp(new THREE.Color("#7d7f86"), interpolate(k, [0.05, 0.35], [0, 1], clamp01));
  const swing = pressed ? 0.5 * Math.exp(-k / 0.9) * Math.sin(k * 11) : 0;
  const tex = LABELS[pressed ? 1 : 0];
  return (
    <group position={[h.x, h.y, 0]} dispose={null}>
      <mesh position={[0, -0.33, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.75, 0.26, 1.15]} />
        <Phys color="#2b2c32" rough={0.4} metal={0.3} />
      </mesh>
      <group position={[0, -0.12 - sink, 0]}>
        <mesh geometry={GEO.button} castShadow receiveShadow>
          <Phys color={`#${red.getHexString()}`} rough={0.3} coat={1} flash={pressed ? 0.6 * Math.exp(-k / 0.25) : 0.05} />
        </mesh>
        {tex && (
          <mesh position={[0, 0.133, 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.3, 0.325]} />
            <meshBasicMaterial map={tex} transparent toneMapped={false} />
          </mesh>
        )}
      </group>
      <group position={[-1.05, 1.05, -0.55]} rotation={[0, 0, swing]}>
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.5, 6]} />
          <meshStandardMaterial color="#555" />
        </mesh>
        <mesh geometry={GEO.bell} position={[0, -0.55, 0]} castShadow>
          <Phys color="#f2c14e" metal={1} rough={0.2} coat={0.5} flash={pressed ? 0.8 * Math.exp(-k / 0.5) : 0} />
        </mesh>
        <mesh position={[0.5 * swing * 0.3, -0.56, 0]}>
          <sphereGeometry args={[0.06, 16, 12]} />
          <Phys color="#c99a2e" metal={1} rough={0.3} />
        </mesh>
      </group>
    </group>
  );
};

// the final stage + the big bell that rings when the ball lands
const FinalPad: React.FC<{ t: number }> = ({ t }) => {
  const h = FINAL_HIT;
  const k = t - h.t;
  const swing = k >= 0 ? 0.35 * Math.exp(-k / 1.6) * Math.sin(k * 7) : 0;
  const glow = k >= 0 ? 0.6 + 2.5 * Math.exp(-k / 0.5) : 0.6;
  return (
    <group position={[h.x, h.y, 0]} dispose={null}>
      <mesh position={[0, -0.14, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.15, 1.25, 0.28, 64]} />
        <Phys color="#2a2b31" rough={0.35} metal={0.4} />
      </mesh>
      <mesh position={[0, 0.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.12, 0.03, 10, 96]} />
        <meshBasicMaterial color={new THREE.Color("#c86bff").multiplyScalar(glow)} toneMapped={false} />
      </mesh>
      <group position={[0.15, 2.5, -0.3]} rotation={[0, 0, swing]}>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 1, 6]} />
          <meshStandardMaterial color="#444" />
        </mesh>
        <mesh geometry={GEO.bell} position={[0, -0.85, 0]} scale={1.55} castShadow>
          <Phys color="#f2c14e" metal={1} rough={0.18} coat={0.5} flash={k >= 0 ? 1.2 * Math.exp(-k / 0.6) : 0} />
        </mesh>
      </group>
    </group>
  );
};

// glowing sparks at every landing, confetti at the subscribe press
const Sparks: React.FC<{ t: number; i0: number }> = ({ t, i0 }) => {
  const out: React.ReactNode[] = [];
  for (let i = Math.max(0, i0 - 6); i <= i0; i++) {
    const h = HITS[i];
    const k = t - h.t;
    if (k < 0) continue;
    if (h.kind === "cta") {
      if (k > 2.2) continue;
      for (let j = 0; j < 48; j++) {
        const a = hash(j * 3.1) * Math.PI * 2;
        const v = new V3(Math.cos(a) * (1 + 2.4 * hash(j)), 4 + 3.5 * hash(j + 5), Math.sin(a) * 1.4);
        const p = land(h).addScaledVector(v, k);
        p.y -= 0.5 * 7 * k * k;
        const col = SONGS[j % SONGS.length].accent;
        out.push(
          <mesh key={`c${j}`} geometry={GEO.confetti} position={p} rotation={[k * 9 * hash(j + 1), k * 7 * hash(j + 2), k * 5]} scale={0.09 * (1 - k / 2.2)}>
            <Phys color={col} flash={0.4} />
          </mesh>,
        );
      }
      continue;
    }
    if (h.kind !== "note" || k > 0.5) continue;
    const col = new THREE.Color(SONGS[h.song].accent).multiplyScalar(4);
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * Math.PI * 2 + i * 1.7;
      const sp = 1.5 + ((j * 37 + i * 11) % 7) * 0.25;
      const v = new V3(Math.cos(a) * sp * 0.8, 2.1 + Math.abs(Math.sin(a * 1.3)) * 1.5, Math.sin(a) * sp * 0.6);
      const p = land(h).add(new V3(0, -BR, 0)).addScaledVector(v, k);
      p.y -= 4.5 * k * k;
      out.push(
        <mesh key={`${i}-${j}`} geometry={GEO.spark} position={p} scale={0.035 * (1 - k / 0.5)}>
          <meshBasicMaterial color={col} toneMapped={false} />
        </mesh>,
      );
    }
  }
  return <>{out}</>;
};

const Ball: React.FC<{ t: number; i0: number }> = ({ t, i0 }) => {
  const p = ballAt(t);
  const h = i0 >= 0 ? HITS[i0] : null;
  const k = h ? t - h.t : 1;
  const glow = h ? Math.exp(-k / 0.3) : 0;
  const song = SONGS[Math.max(0, songAt(t))];
  const sq = h && h.kind !== "final" ? 0.22 * Math.exp(-k / 0.04) - 0.05 * Math.exp(-k / 0.09) * Math.sin(k * 40) : 0;
  return (
    <group position={[p.x, p.y - sq * BR, p.z]}>
      <group scale={[1 + sq * 0.55, 1 - sq, 1 + sq * 0.55]}>
        <group rotation={[0.3, 0, -p.x / BR]}>
          <mesh castShadow>
            <sphereGeometry args={[BR, 48, 32]} />
            <meshPhysicalMaterial color="#fbf8f3" roughness={0.16} clearcoat={1} clearcoatRoughness={0.05} emissive={song.accent} emissiveIntensity={0.25 * glow} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[BR * 0.995, BR * 0.16, 16, 64]} />
            <meshPhysicalMaterial color={song.accent} roughness={0.3} clearcoat={0.6} emissive={song.accent} emissiveIntensity={0.35} />
          </mesh>
        </group>
      </group>
      <pointLight color={song.accent} intensity={0.6 + 4 * glow} distance={3} decay={2} />
    </group>
  );
};

// decorative props on the wall: sticks and rings in the colours of the song at that spot
const DECOR = Array.from({ length: Math.ceil((FINAL_HIT.x + 22) / 0.85) }, (_, n) => {
  const x = -8 + n * 0.85 + hash(n) * 0.6;
  const near = HITS[Math.min(HITS.length - 1, Math.max(0, HITS.findIndex((h) => h.x >= x)))];
  const s = SONGS[songAtX(x)];
  const above = hash(n + 1) < 0.55;
  return {
    x,
    y: near.y + (above ? 1.9 + hash(n + 2) * 2.4 : -(1.6 + hash(n + 3) * 2.2)),
    z: WALL_Z + 0.25 + hash(n + 4) * 0.5,
    ring: hash(n + 5) < 0.18,
    len: 0.5 + hash(n + 6) * 1.2,
    r: 0.035 + hash(n + 7) * 0.035,
    tilt: (hash(n + 8) - 0.5) * 1.3,
    col: [...s.colors, s.accent][Math.floor(hash(n + 9) * (s.colors.length + 1))],
  };
});

const Scene: React.FC<{ t: number }> = ({ t }) => {
  const c = trackAt(t);
  const target = useMemo(() => new THREE.Object3D(), []);
  target.position.set(c.x, c.y, 0);
  const i0 = lastIndex(t);
  const h = i0 >= 0 ? HITS[i0] : null;
  const k = h ? t - h.t : 9;
  const pool = h ? (h.song >= 0 ? SONGS[h.song].accent : "#ffffff") : "#ffffff";
  const near = (x: number, r: number) => Math.abs(x - c.x) < r;
  return (
    <>
      <Rig t={t} />
      <Look />
      <hemisphereLight args={["#f7f8fb", "#b9b4c4", 0.55]} />
      <primitive object={target} />
      <directionalLight
        castShadow
        color="#fff1e2"
        position={[c.x - 3, c.y + 6, 7]}
        target={target}
        intensity={1.75}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={1}
        shadow-camera-far={34}
        shadow-bias={-0.0005}
        shadow-radius={7}
      />
      <directionalLight color="#a9cbff" position={[c.x + 7, c.y + 3, 1]} target={target} intensity={0.7} />
      {h && <pointLight color={pool} position={[h.x, h.y + 0.6, -0.6]} intensity={5 * Math.exp(-k / 0.28)} distance={3.2} decay={2} />}
      <mesh position={[c.x, c.y, WALL_Z]} receiveShadow>
        <planeGeometry args={[70, 46]} />
        <meshStandardMaterial color={wallAt(t)} roughness={0.92} />
      </mesh>
      {DECOR.filter((d) => near(d.x, 14)).map((d, j) =>
        d.ring ? (
          <mesh key={`r${j}`} geometry={GEO.ring} position={[d.x, d.y, d.z]} rotation={[0.2, 0.3, d.tilt]} scale={0.18} castShadow>
            <Phys color={d.col} rough={0.35} />
          </mesh>
        ) : (
          <mesh key={`s${j}`} geometry={GEO.stick} position={[d.x, d.y, d.z]} rotation={[0, 0, Math.PI / 2 + d.tilt]} scale={[d.r, d.len, d.r]} castShadow>
            <Phys color={d.col} rough={0.35} />
          </mesh>
        ),
      )}
      {HITS.map((hh, idx) => {
        if (!near(hh.x, 12)) return null;
        if (hh.kind === "cta") return <CtaPad key="cta" t={t} />;
        if (hh.kind === "bounce") return null;
        if (hh.kind === "final") return <FinalPad key="final" t={t} />;
        return <NotePad key={idx} h={hh} idx={idx} t={t} />;
      })}
      <Sparks t={t} i0={i0} />
      <Ball t={t} i0={i0} />
    </>
  );
};

// ─────────────── HUD
const LEVEL: Record<string, string> = { EASY: "#3ddc6a", MEDIUM: "#ffb02e", HARD: "#ff4f4f", LEGEND: "#c86bff" };
const pad2 = (n: number) => String(n).padStart(2, "0");

const Tiles: React.FC<{ title: string; t: number; reveal: number }> = ({ title, t, reveal }) => {
  const w = Math.min(54, Math.floor(1080 / title.length));
  return (
    <div style={{ display: "flex", gap: Math.max(3, w * 0.1), marginTop: 14 }}>
      {[...title].map((ch, i) => {
        if (ch === " ") return <span key={i} style={{ width: w * 0.45 }} />;
        const k = interpolate(t, [reveal + i * 0.035, reveal + i * 0.035 + 0.16], [0, 1], clamp01);
        const shown = k > 0.5;
        return (
          <span
            key={i}
            style={{
              width: w,
              height: w * 1.38,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#1f1b24",
              color: shown ? "#fff" : "#7f7788",
              borderRadius: 6,
              fontFamily: HEAD,
              fontSize: w * 0.95,
              transform: `scaleY(${Math.abs(1 - 2 * k)})`,
              boxShadow: "0 4px 0 #0004",
            }}
          >
            {shown ? ch : "?"}
          </span>
        );
      })}
    </div>
  );
};

const Countdown: React.FC<{ t: number; s: (typeof SPANS)[number]; song: Song }> = ({ t, s, song }) => {
  const total = s.reveal - s.start;
  const left = Math.max(0, s.reveal - t);
  const p = 1 - left / total;
  const done = t >= s.reveal;
  const pop = done ? interpolate(t, [s.reveal, s.reveal + 0.12, s.reveal + 0.3], [1, 1.25, 1], clamp01) : 1;
  const R = 46, L = 2 * Math.PI * R;
  return (
    <div style={{ position: "absolute", right: 70, top: 46, width: 120, height: 120, transform: `scale(${pop})` }}>
      <svg width={120} height={120} viewBox="0 0 120 120">
        <circle cx={60} cy={60} r={R + 8} fill="#1f1b24" />
        <circle cx={60} cy={60} r={R} fill="none" stroke="#ffffff22" strokeWidth={8} />
        <circle cx={60} cy={60} r={R} fill="none" stroke={done ? LEVEL.EASY : song.accent} strokeWidth={8} strokeLinecap="round" strokeDasharray={`${L * (done ? 1 : p)} ${L}`} transform="rotate(-90 60 60)" />
        {done ? (
          <path d="M40 62 L54 76 L82 46" fill="none" stroke="#fff" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <text x={60} y={74} textAnchor="middle" fontFamily={HEAD} fontSize={44} fill="#fff">
            {Math.ceil(left)}
          </text>
        )}
      </svg>
    </div>
  );
};

const Pips: React.FC<{ k: number; t: number }> = ({ k, t }) => (
  <div style={{ position: "absolute", top: 58, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 10 }}>
    {SONGS.map((s, i) => {
      const cur = i === k;
      const done = i < k || (cur && t >= SPANS[i].reveal);
      return (
        <span
          key={i}
          style={{
            width: cur ? 34 : 16,
            height: 16,
            borderRadius: 8,
            background: done ? s.accent : cur ? "#ffffff" : "#00000026",
            boxShadow: cur ? `0 0 0 3px ${s.accent}` : "none",
          }}
        />
      );
    })}
  </div>
);

const Pill: React.FC<{ text: string; t: number; at: number; dur?: number; bottom?: number; color?: string }> = ({ text, t, at, dur = 1.9, bottom = 92, color = "#1f1b24" }) => {
  const k = t - at;
  if (k < 0 || k > dur) return null;
  const a = interpolate(k, [0, 0.14, dur - 0.25, dur], [0, 1, 1, 0], clamp01);
  const sc = interpolate(k, [0, 0.12, 0.22], [0.6, 1.08, 1], clamp01);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom, display: "flex", justifyContent: "center", opacity: a }}>
      <span style={{ background: color, color: "#fff", fontFamily: LABEL, fontSize: 38, letterSpacing: 2, padding: "10px 28px", borderRadius: 14, transform: `scale(${sc})`, boxShadow: "0 8px 24px #0003" }}>{text}</span>
    </div>
  );
};

const Intro: React.FC<{ t: number }> = ({ t }) => {
  if (t > INTRO + 0.2) return null;
  const a = interpolate(t, [0, 0.25, INTRO - 0.35, INTRO], [0, 1, 1, 0], clamp01);
  const y = interpolate(t, [INTRO - 0.35, INTRO], [0, -60], clamp01);
  const pop = (d: number) => interpolate(t, [d, d + 0.18, d + 0.3], [0.4, 1.1, 1], clamp01);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: a, transform: `translateY(${y - 120}px)` }}>
      <div style={{ fontFamily: HEAD, fontSize: 120, color: "#1f1b24", lineHeight: 1, transform: `scale(${pop(0.05)})` }}>GUESS ALL</div>
      <div style={{ fontFamily: HEAD, fontSize: 168, lineHeight: 1.05, color: "#fff", WebkitTextStroke: "0px", textShadow: "0 6px 0 #1f1b24, 0 10px 30px #0004", transform: `scale(${pop(0.3)})` }}>
        <span style={{ color: "#ffcf3a" }}>12</span> MEME SONGS
      </div>
      <div style={{ marginTop: 18, fontFamily: LABEL, fontSize: 36, letterSpacing: 3, color: "#fff", background: "#c86bff", padding: "8px 26px", borderRadius: 12, transform: `scale(${pop(0.75)})` }}>
        ONLY LEGENDS GET 12/12
      </div>
    </AbsoluteFill>
  );
};

const Outro: React.FC<{ t: number }> = ({ t }) => {
  const at = FINAL_HIT.t + 0.5;
  if (t < at) return null;
  const a = interpolate(t, [at, at + 0.3], [0, 1], clamp01);
  const pop = (d: number) => interpolate(t, [at + d, at + d + 0.18, at + d + 0.3], [0.5, 1.08, 1], clamp01);
  return (
    <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 90, paddingTop: 60, opacity: a }}>
      <div style={{ alignSelf: "flex-start", background: "#1f1b24ee", borderRadius: 28, padding: "34px 56px", display: "flex", flexDirection: "column", alignItems: "flex-start", transformOrigin: "left center", transform: `scale(${pop(0)})`, boxShadow: "0 20px 60px #0005" }}>
        <div style={{ fontFamily: HEAD, fontSize: 92, color: "#fff", lineHeight: 1.02 }}>HOW MANY<br />DID YOU GET?</div>
        <div style={{ fontFamily: LABEL, fontSize: 40, color: "#ffcf3a", marginTop: 10, transform: `scale(${pop(0.35)})` }}>COMMENT YOUR SCORE &nbsp;__ / 12</div>
        <div style={{ display: "flex", gap: 18, marginTop: 26, transform: `scale(${pop(0.7)})` }}>
          <span style={{ fontFamily: LABEL, fontSize: 32, color: "#fff", background: "#ff2b2b", padding: "8px 22px", borderRadius: 10 }}>SUBSCRIBE FOR PART 2</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Hud: React.FC<{ t: number }> = ({ t }) => {
  const k = songAt(t);
  const progress = Math.min(1, t / DURATION);
  const song = k >= 0 ? SONGS[k] : null;
  const s = k >= 0 ? SPANS[k] : null;
  const inSong = song && s && t < FINAL_HIT.t + 0.4;
  const hudIn = interpolate(t, [INTRO - 0.5, INTRO - 0.1], [0, 1], clamp01);
  return (
    <AbsoluteFill>
      <Intro t={t} />
      {inSong && (
        <div style={{ position: "absolute", left: 70, top: 46, opacity: hudIn }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", fontFamily: LABEL }}>
            <span style={{ background: song.accent, color: "#fff", borderRadius: 8, padding: "4px 14px", fontSize: 28, letterSpacing: 1, textShadow: "0 1px 2px #0005" }}>SONG {pad2(k + 1)}/{SONGS.length}</span>
            <span style={{ background: "#1f1b24", color: LEVEL[song.level], borderRadius: 8, padding: "4px 12px", fontSize: 24, letterSpacing: 2 }}>{song.level}</span>
          </div>
          <Tiles title={song.title} t={t} reveal={s.reveal} />
        </div>
      )}
      {inSong && t < s.end + 0.6 && <Countdown t={t} s={s} song={song} />}
      {inSong && <div style={{ opacity: hudIn }}><Pips k={k} t={t} /></div>}
      {SONGS.map((sg, i) => (sg.caption ? <Pill key={i} text={sg.caption[1]} t={t} at={SPANS[i].start + sg.caption[0]} /> : null))}
      <Pill text="YOU JUST GOT RICKROLLED" t={t} at={SPANS[SPANS.length - 1].reveal + 0.5} dur={2.2} color="#c86bff" />
      <Pill text="THE BALL SUBSCRIBED. YOUR TURN!" t={t} at={CTA_HIT.t + 0.25} dur={2.0} color="#ff2b2b" />
      <Outro t={t} />
      <div style={{ position: "absolute", right: 34, bottom: 26, fontFamily: LABEL, fontSize: 26, color: "#ffffffcc", textShadow: "0 1px 4px #0006", letterSpacing: 1 }}>@Vibealiz3D</div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 7, background: "#0000001a" }}>
        <div style={{ width: `${progress * 100}%`, height: "100%", background: song?.accent ?? "#c86bff" }} />
      </div>
    </AbsoluteFill>
  );
};

export const VZ01: React.FC<{ silent?: boolean; times?: number[] }> = ({ silent, times }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = times ? times[Math.min(frame, times.length - 1)] : frame / fps;
  return (
    <AbsoluteFill style={{ background: "#9a9da4" }}>
      <ThreeCanvas width={width} height={height} shadows camera={{ fov: 32, near: 0.1, far: 90 }} gl={{ antialias: false, stencil: false }}>
        <Scene t={t} />
      </ThreeCanvas>
      <Hud t={t} />
      {!silent && !times && <Html5Audio src={staticFile("vz01/mix-norm.wav")} />}
    </AbsoluteFill>
  );
};
