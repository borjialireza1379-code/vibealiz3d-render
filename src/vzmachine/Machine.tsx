// Vibealiz3D "musical marble machine" (1080×1920, 60 fps, seamless ~12 s loop). The motion is in motion.ts (pure
// physics, shared with make-audio.mjs); here: the purple/gold machine, the glass helix with its note-lights, the
// spring launcher on the floor, the channel ball (white + purple ring) rolling without slipping, a grey-lavender
// studio. The ball's spin is integrated from its path and eased back to the start orientation so the loop is seamless.
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, Html5Audio, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  BALL_R, BASE_R, DURATION, FPS, FRAMES, HELIX, HOLE, HOUSING_H, LAUNCHER, LIGHTS, PLATE_TOP, TRAY_R, TRAY_Y,
  T_BASE, T_SETTLE, ballAt, helixPoint, lightState, lightU, plateD,
} from "./motion";

export const MACHINE_FPS = FPS;
export const MACHINE_FRAMES = FRAMES;

const FONT = "Fredoka";
const fh = delayRender("machine font");
new FontFace(FONT, `url('${staticFile("fonts/Fredoka.ttf")}')`, { weight: "300 700" }).load().then((f) => {
  document.fonts.add(f);
  continueRender(fh);
});

const BG = "#9c98a8";
const PURPLE = "#8b4dff";
const GOLD = "#f2c14e";
const CANDY = ["#ff4fb8", "#ffd23f", "#3fd6ff", "#3ddc97", "#ff9f2e", "#c86bff", "#ff5a4f"];
const BASE_H = 0.4;

const v3 = (p: number[]) => new THREE.Vector3(p[0], p[1], p[2]);
const TUBE = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 401 }, (_, i) => v3(helixPoint(i / 400)))), 900, HELIX.tube, 28, false);
// the coil spring of the launcher (scaled in y as it compresses)
const SPRING_LEN = PLATE_TOP - 0.05 - 0.04;
const SPRING = new THREE.TubeGeometry(
  new THREE.CatmullRomCurve3(
    Array.from({ length: 241 }, (_, i) => {
      const a = (i / 240) * 7 * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * 0.13, (i / 240) * SPRING_LEN, Math.sin(a) * 0.13);
    }),
  ),
  480,
  0.018,
  8,
  false,
);

// ─── ball spin: integrate rolling without slipping (ω = n × v / R) along the path, ease back to the start pose
const SPIN = (() => {
  const steps = Math.ceil(DURATION * 240), dt = DURATION / steps;
  const out: THREE.Quaternion[] = [];
  let q = new THREE.Quaternion();
  let w = new THREE.Vector3();
  for (let k = 0; k <= steps; k++) {
    out.push(q.clone());
    const t = k * dt;
    const a = ballAt(t), b = ballAt(t + dt);
    const vel = v3(b.p).sub(v3(a.p)).divideScalar(dt);
    if (a.phase !== "air" && a.phase !== "drop") {
      const n = a.n ? v3(a.n) : new THREE.Vector3(0, 1, 0);
      w = new THREE.Vector3().crossVectors(n, vel).divideScalar(BALL_R);
    }
    const ang = w.length() * dt;
    if (ang > 1e-9) q = new THREE.Quaternion().setFromAxisAngle(w.clone().normalize(), ang).multiply(q);
  }
  // the loop must end in the start orientation: spread the correction over the base roll + hop
  const fix = out[out.length - 1].clone().invert();
  return out.map((qq, k) => {
    const m = THREE.MathUtils.smoothstep(k * dt, T_BASE - 0.6, T_SETTLE);
    return new THREE.Quaternion().slerp(fix, m).multiply(qq);
  });
})();
const spinAt = (t: number) => SPIN[Math.min(SPIN.length - 1, Math.round((t / DURATION) * (SPIN.length - 1)))];

const Studio: React.FC = () => {
  const { gl, scene, camera } = useThree();
  useMemo(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.05;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    scene.background = new THREE.Color(BG);
    scene.fog = new THREE.Fog(BG, 10, 18);
    scene.environment = new THREE.PMREMGenerator(gl).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
  }, [gl, scene]);
  useLayoutEffect(() => {
    camera.position.set(4.05, 4.85, 8.5);
    camera.lookAt(-0.12, 1.9, 0.3);
  }, [camera]);
  return null;
};

const Glossy: React.FC<{ c: string; rough?: number; metal?: number; glow?: number }> = ({ c, rough = 0.25, metal = 0, glow = 0 }) => (
  <meshPhysicalMaterial color={c} roughness={rough} metalness={metal} clearcoat={1} clearcoatRoughness={0.08} emissive={c} emissiveIntensity={glow} />
);
const Glass: React.FC = () => <meshPhysicalMaterial color="#ffffff" transmission={1} thickness={0.015} roughness={0} ior={1.3} clearcoat={1} side={THREE.DoubleSide} transparent opacity={0.75} />;

const disc = (r: number, h: number, hole?: [number, number, number]) => {
  const s = new THREE.Shape();
  s.absarc(0, 0, r, 0, Math.PI * 2, false);
  if (hole) {
    const p = new THREE.Path();
    p.absarc(hole[0], -hole[1], hole[2], 0, Math.PI * 2, true); // shape y → world −z after the rotation
    s.holes.push(p);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 6, curveSegments: 96 });
  g.rotateX(-Math.PI / 2);
  return g;
};
const BASE = disc(BASE_R, BASE_H);
const TRAY = disc(TRAY_R, 0.12, [HOLE[0], HOLE[1], 0.16]);
const CONTACT = (() => {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 256;
  const g = cv.getContext("2d")!;
  const r = g.createRadialGradient(128, 128, 20, 128, 128, 128);
  r.addColorStop(0, "rgba(40,28,70,0.75)");
  r.addColorStop(0.55, "rgba(40,28,70,0.35)");
  r.addColorStop(1, "rgba(40,28,70,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(cv);
})();

const Launcher: React.FC<{ t: number }> = ({ t }) => {
  const d = plateD(t);
  return (
    <group position={[LAUNCHER[0], 0, LAUNCHER[1]]}>
      <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.25, 0.27, 0.04, 48]} />
        <Glossy c={GOLD} metal={1} rough={0.25} />
      </mesh>
      <mesh geometry={SPRING} position={[0, 0.04, 0]} scale={[1, (SPRING_LEN + d) / SPRING_LEN, 1]} castShadow>
        <Glossy c="#d9dbe3" metal={1} rough={0.2} />
      </mesh>
      <mesh position={[0, PLATE_TOP - 0.025 + d, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.19, 0.19, 0.05, 48]} />
        <Glossy c={PURPLE} rough={0.3} />
      </mesh>
      <mesh position={[0, HOUSING_H / 2, 0]}>
        <cylinderGeometry args={[0.225, 0.225, HOUSING_H, 48, 1, true]} />
        <Glass />
      </mesh>
      <mesh position={[0, HOUSING_H, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.225, 0.02, 12, 64]} />
        <Glossy c={GOLD} metal={1} rough={0.2} />
      </mesh>
    </group>
  );
};

const Machine: React.FC<{ t: number }> = ({ t }) => (
  <group>
    <mesh geometry={BASE} castShadow receiveShadow>
      <Glossy c={PURPLE} rough={0.3} />
    </mesh>
    <mesh position={[0, BASE_H + 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[BASE_R + 0.03, 0.035, 16, 128]} />
      <Glossy c={GOLD} metal={1} rough={0.2} />
    </mesh>
    <mesh position={[0, (BASE_H + TRAY_Y) / 2, 0]} castShadow>
      <cylinderGeometry args={[0.045, 0.045, TRAY_Y - BASE_H, 24]} />
      <Glossy c={GOLD} metal={1} rough={0.18} />
    </mesh>
    <mesh geometry={TUBE} castShadow>
      <Glass />
    </mesh>
    {/* glass drop tube from the tray hole down to the helix entry */}
    <mesh position={[HOLE[0], (HELIX.y1 + TRAY_Y) / 2, HOLE[1]]}>
      <cylinderGeometry args={[HELIX.tube, HELIX.tube, TRAY_Y - HELIX.y1, 32, 1, true]} />
      <Glass />
    </mesh>
    {Array.from({ length: LIGHTS }, (_, i) => {
      const p = v3(helixPoint(lightU(i)));
      const out = new THREE.Vector3(p.x, 0, p.z).normalize().multiplyScalar(HELIX.tube + 0.03);
      const { on, flash } = lightState(i, t);
      const c = new THREE.Color(CANDY[i % CANDY.length]);
      const col = c.clone().lerp(new THREE.Color("#ffffff"), 0.35).lerp(c, on);
      return (
        <mesh key={i} position={[p.x + out.x, p.y, p.z + out.z]} scale={0.03 + on * (0.024 + 0.03 * flash)}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshPhysicalMaterial color={col} roughness={0.3} clearcoat={1} emissive={c} emissiveIntensity={on * (2.4 + 4 * flash)} />
        </mesh>
      );
    })}
    <group position={[0, TRAY_Y, 0]}>
      <mesh geometry={TRAY} castShadow receiveShadow>
        <Glossy c={PURPLE} rough={0.3} />
      </mesh>
      <mesh position={[0, 0.16, 0]} castShadow>
        <cylinderGeometry args={[TRAY_R + 0.04, TRAY_R + 0.04, 0.26, 96, 1, true]} />
        <Glossy c={PURPLE} rough={0.3} />
      </mesh>
      <mesh position={[0, 0.29, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[TRAY_R + 0.04, 0.035, 16, 128]} />
        <Glossy c={GOLD} metal={1} rough={0.2} />
      </mesh>
    </group>
    <Launcher t={t} />
  </group>
);

const Ball: React.FC<{ t: number }> = ({ t }) => {
  const { p } = ballAt(t);
  return (
    <group position={[p[0], p[1], p[2]]} quaternion={spinAt(t)}>
      <mesh castShadow>
        <sphereGeometry args={[BALL_R, 48, 32]} />
        <meshPhysicalMaterial color="#fbf8f3" roughness={0.14} clearcoat={1} clearcoatRoughness={0.04} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[BALL_R * 0.995, BALL_R * 0.17, 16, 64]} />
        <Glossy c="#a24bff" rough={0.3} glow={0.35} />
      </mesh>
      <pointLight color="#c98bff" intensity={0.6} distance={0.9} decay={2} />
    </group>
  );
};

export const VZMachine: React.FC<{ silent?: boolean; at?: number }> = ({ silent, at }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = at ?? frame / fps;
  return (
    <AbsoluteFill style={{ background: BG }}>
      <ThreeCanvas width={width} height={height} shadows camera={{ fov: 33, near: 0.1, far: 60 }} gl={{ antialias: true }}>
        <Studio />
        <hemisphereLight args={["#ffffff", "#8a8299", 0.6]} />
        <spotLight castShadow position={[-3.5, 9, 4.5]} angle={0.45} penumbra={0.9} intensity={110} decay={2} color="#fff3e6" shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-radius={6} />
        <directionalLight position={[5, 3, -4]} intensity={0.9} color="#b9a4ff" />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
          <planeGeometry args={[60, 60]} />
          <meshStandardMaterial color="#a7a2b4" roughness={0.9} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.1, -0.04, 0.1]}>
          <planeGeometry args={[4.8, 4.8]} />
          <meshBasicMaterial map={CONTACT} transparent depthWrite={false} />
        </mesh>
        <Machine t={t} />
        <Ball t={t} />
      </ThreeCanvas>
      <div style={{ position: "absolute", right: 44, bottom: 300, fontFamily: FONT, fontWeight: 600, fontSize: 34, color: "#ffffffb0", letterSpacing: 1 }}>@Vibealiz3D</div>
      {!silent && at === undefined && <Html5Audio src={staticFile("vzmachine/machine.wav")} />}
    </AbsoluteFill>
  );
};

/** look tests: one still at a chosen moment, or several moments as a sequence */
export const VZMachineFrame: React.FC<{ at?: number }> = ({ at = 6.4 }) => <VZMachine at={at} silent />;
export const MACHINE_LOOK = [0.2, 1.15, 1.45, 2.3, 3.6, 4.6, 6.4, 8.6, 9.8, 10.1, 10.9, 11.95];
export const VZMachineLook: React.FC = () => {
  const frame = useCurrentFrame();
  return <VZMachine at={MACHINE_LOOK[Math.min(frame, MACHINE_LOOK.length - 1)]} silent />;
};

// names the cloud sync expects (folder vzmachine → VZMACHINE, VZMACHINE_FPS, VZMACHINE_FRAMES)
export const VZMACHINE = VZMachine;
export const VZMACHINE_FPS = MACHINE_FPS;
export const VZMACHINE_FRAMES = MACHINE_FRAMES;
