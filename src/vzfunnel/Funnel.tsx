// Vibealiz3D vortex-funnel marble machine (1080×1920, 60 fps). Same look as the first machine (src/vzmachine):
// deep purple + gold, a grey-lavender studio, the channel ball (satin off-white, purple ring), candy note-lights
// that light up as the ball passes, no channel name on the object. Geometry and the ball path: track.ts.
// Loop: VZFUNNEL (7 s, seamless), check stills: VZFUNNELLOOK (one frame per moment in LOOK_T). Sound: make-audio.mjs.
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, Html5Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  BALL_R, BASE, BASE_TOP, DURATION, FPS, FRAMES, FUNNEL, LIGHTS, PILLARS, RAIL_D, RAIL_R, RAIL_W, RING_R, T_DISH,
  T_FLIGHT, T_LAUNCH, T_RAILS, T_TRACK, TRACK_LEN, V3, ballAt, lightS, lightState, railPoint, side, surfY, trackAt,
} from "./track";

const BG = "#9c98a8";
const PURPLE = "#6a34cc";
const GOLD = "#f2c14e";
const PEARL = "#ece6f4";
const CANDY = ["#ff4fb8", "#ffd23f", "#3fd6ff", "#3ddc97", "#ff9f2e", "#c86bff", "#ff5a4f"];

const v3 = (p: number[]) => new THREE.Vector3(p[0], p[1], p[2]);

// ─── camera: high three-quarter view like the reference (funnel top-left, ramp right, base running at us)
export const CAM = { pos: new THREE.Vector3(4.9, 9.9, 8.0), look: new THREE.Vector3(-0.3, 1.7, 0.1), fov: 30 };

const Studio: React.FC<{ pos: THREE.Vector3; look: THREE.Vector3 }> = ({ pos, look }) => {
  const { gl, scene, camera } = useThree();
  useMemo(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.0;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    scene.background = new THREE.Color(BG);
    scene.fog = new THREE.Fog(BG, 15, 30);
    scene.environment = new THREE.PMREMGenerator(gl).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.5;
  }, [gl, scene]);
  useLayoutEffect(() => {
    camera.position.copy(pos);
    camera.lookAt(look);
  }, [camera, pos, look]);
  return null;
};

const Glossy: React.FC<{ c: string; rough?: number; metal?: number; glow?: number }> = ({ c, rough = 0.25, metal = 0, glow = 0 }) => (
  <meshPhysicalMaterial color={c} roughness={rough} metalness={metal} clearcoat={1} clearcoatRoughness={0.08} emissive={c} emissiveIntensity={glow} />
);
const Chrome: React.FC = () => <meshPhysicalMaterial color="#e3e5ee" metalness={1} roughness={0.14} clearcoat={0.4} />;

// ─── geometry built once
const roundedRect = (x0: number, x1: number, z0: number, z1: number, r: number, n = 12): THREE.Vector2[] => {
  const out: THREE.Vector2[] = [];
  const corners: [number, number, number][] = [[x1 - r, z1 - r, 0], [x0 + r, z1 - r, 90], [x0 + r, z0 + r, 180], [x1 - r, z0 + r, 270]];
  for (const [cx, cz, a0] of corners)
    for (let i = 0; i <= n; i++) {
      const a = ((a0 + (i / n) * 90) * Math.PI) / 180;
      out.push(new THREE.Vector2(cx + Math.cos(a) * r, cz + Math.sin(a) * r));
    }
  return out;
};
const BASE_GEO = (() => {
  // shape y = world −z (rotateX(−π/2) below)
  const s = new THREE.Shape(roundedRect(BASE.x0, BASE.x1, BASE.z0, BASE.z1, BASE.r).map((p) => new THREE.Vector2(p.x, -p.y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: BASE.h, bevelEnabled: true, bevelThickness: BASE.bevel, bevelSize: BASE.bevel, bevelSegments: 6, curveSegments: 24 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, BASE.bevel, 0);
  return g;
})();
const BASE_TRIM = (() => {
  const o = BASE.bevel + 0.022;
  const pts = roundedRect(BASE.x0 - o, BASE.x1 + o, BASE.z0 - o, BASE.z1 + o, BASE.r + o, 16).map((p) => new THREE.Vector3(p.x, BASE.bevel + BASE.h, p.y));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, "centripetal"), 400, 0.03, 12, true);
})();

// funnel ring: a lathe of a rounded rectangle (r: rIn..rOut, y: yBot..yLip)
const RING_GEO = (() => {
  const { rIn, rOut, yBot, yLip } = FUNNEL, c = 0.11, pts: THREE.Vector2[] = [];
  const arc = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= 8; i++) {
      const a = ((a0 + (i / 8) * 90) * Math.PI) / 180;
      pts.push(new THREE.Vector2(cx + Math.cos(a) * c, cy + Math.sin(a) * c));
    }
  };
  arc(rIn + c, yBot + c, 180); // inner bottom
  arc(rOut - c, yBot + c, 270); // outer bottom
  arc(rOut - c, yLip - c, 0); // outer top
  arc(rIn + c, yLip - c, 90); // inner top
  pts.push(pts[0].clone());
  return new THREE.LatheGeometry(pts, 160);
})();
// the dish: the gravity-well surface from the wall to the hole, then the hole's throat
const DISH_GEO = (() => {
  // profile from the wall down to the hole (normals face up into the dish); samples crowd near the steep throat
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 90; i++) {
    const r = FUNNEL.hole + (FUNNEL.rIn + 0.02 - FUNNEL.hole) * (1 - i / 90) ** 1.6;
    pts.push(new THREE.Vector2(r, surfY(r)));
  }
  return new THREE.LatheGeometry(pts, 160);
})();
const THROAT_H = surfY(FUNNEL.hole) - FUNNEL.yBot;

// rails + ties
const RAIL_GEO = ([-1, 1] as const).map((w) => {
  const pts = Array.from({ length: 321 }, (_, i) => v3(railPoint((i / 320) * TRACK_LEN, w)));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 900, RAIL_R, 12, false);
});
const RAIL_ENDS = ([-1, 1] as const).flatMap((w) => [v3(railPoint(0, w)), v3(railPoint(TRACK_LEN, w))]);
const TIES = Array.from({ length: LIGHTS }, (_, i) => {
  const m = trackAt(lightS(i));
  const b = v3(side(m)), n = v3(m.n), c = v3(m.p).addScaledVector(n, -(RAIL_D + 0.03));
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b);
  // one note-light per tie, on the end that faces the camera
  const w = Math.sign(b.dot(CAM.pos.clone().sub(c))) || 1;
  const beads = [c.clone().addScaledVector(b, w * (RAIL_W + 0.075))];
  const post = m.seg === "run" || (m.seg === "ramp" && c.y < BASE_TOP + 0.35) || (m.seg === "bend" && c.y < BASE_TOP + 0.35);
  return { c, q, beads, post };
});

// soft contact shadow under the base
const CONTACT = (() => {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 256;
  const g = cv.getContext("2d")!;
  const r = g.createRadialGradient(128, 128, 30, 128, 128, 128);
  r.addColorStop(0, "rgba(40,28,70,0.7)");
  r.addColorStop(0.6, "rgba(40,28,70,0.3)");
  r.addColorStop(1, "rgba(40,28,70,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(cv);
})();

const Funnel: React.FC = () => (
  <group position={[FUNNEL.cx, 0, FUNNEL.cz]}>
    <mesh geometry={RING_GEO} castShadow receiveShadow>
      <Glossy c={PURPLE} rough={0.3} />
    </mesh>
    <mesh position={[0, FUNNEL.yLip + 0.004, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[(FUNNEL.rIn + FUNNEL.rOut) / 2, 0.028, 16, 160]} />
      <Glossy c={GOLD} metal={1} rough={0.2} />
    </mesh>
    <mesh geometry={DISH_GEO} castShadow receiveShadow>
      <meshPhysicalMaterial color={PEARL} roughness={0.32} clearcoat={0.8} clearcoatRoughness={0.15} side={THREE.DoubleSide} />
    </mesh>
    <mesh position={[0, surfY(RING_R) + 0.004, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[RING_R, 0.011, 8, 160]} />
      <Glossy c={GOLD} metal={1} rough={0.25} />
    </mesh>
    {/* the throat under the hole (dark inside) and the underside disc */}
    <mesh position={[0, FUNNEL.yBot + THROAT_H / 2, 0]}>
      <cylinderGeometry args={[FUNNEL.hole, FUNNEL.hole, THROAT_H, 48, 1, true]} />
      <meshStandardMaterial color="#2c2142" roughness={0.6} side={THREE.DoubleSide} />
    </mesh>
    {/* invisible shadow caster over the hole: no bright spot of light through it on the floor */}
    <mesh position={[0, FUNNEL.yBot - 0.01, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <circleGeometry args={[FUNNEL.hole + 0.02, 48]} />
      <meshBasicMaterial colorWrite={false} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
    <mesh position={[0, FUNNEL.yBot + 0.002, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <ringGeometry args={[FUNNEL.hole, FUNNEL.rIn + 0.05, 96]} />
      <Glossy c={PURPLE} rough={0.35} />
    </mesh>
  </group>
);

const Pillars: React.FC = () => (
  <>
    {PILLARS.map(([x, z], i) => (
      <group key={i} position={[x, 0, z]}>
        <mesh position={[0, (BASE_TOP + FUNNEL.yBot) / 2, 0]} castShadow>
          <cylinderGeometry args={[0.062, 0.062, FUNNEL.yBot - BASE_TOP, 32]} />
          <Glossy c={GOLD} metal={1} rough={0.18} />
        </mesh>
        <mesh position={[0, BASE_TOP + 0.03, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.17, 0.19, 0.06, 48]} />
          <Glossy c="#3d1f80" rough={0.3} />
        </mesh>
        <mesh position={[0, BASE_TOP + 0.075, 0]}>
          <cylinderGeometry args={[0.09, 0.11, 0.04, 32]} />
          <Glossy c={GOLD} metal={1} rough={0.2} />
        </mesh>
      </group>
    ))}
  </>
);

const Track: React.FC<{ t: number }> = ({ t }) => (
  <>
    {RAIL_GEO.map((g, i) => (
      <mesh key={i} geometry={g} castShadow>
        <Chrome />
      </mesh>
    ))}
    {RAIL_ENDS.map((p, i) => (
      <mesh key={i} position={p}>
        <sphereGeometry args={[RAIL_R, 16, 12]} />
        <Chrome />
      </mesh>
    ))}
    {TIES.map(({ c, q, beads, post }, i) => {
      const { on, flash } = lightState(i, t);
      return (
        <group key={i}>
          <mesh position={c} quaternion={q} castShadow>
            <cylinderGeometry args={[0.016, 0.016, 2 * (RAIL_W + 0.075), 12]} />
            <Glossy c={GOLD} metal={1} rough={0.2} />
          </mesh>
          {post && (
            <mesh position={[c.x, (c.y + BASE_TOP) / 2, c.z]} castShadow>
              <cylinderGeometry args={[0.016, 0.016, c.y - BASE_TOP, 10]} />
              <Glossy c={GOLD} metal={1} rough={0.2} />
            </mesh>
          )}
          {beads.map((p, k) => {
            const col = new THREE.Color(CANDY[(i + k) % CANDY.length]);
            const shown = col.clone().lerp(new THREE.Color("#ffffff"), 0.45).lerp(col, on);
            return (
              <mesh key={k} position={p} scale={0.03 + on * (0.014 + 0.016 * flash)}>
                <sphereGeometry args={[1, 16, 12]} />
                <meshPhysicalMaterial color={shown} roughness={0.3} clearcoat={1} emissive={col} emissiveIntensity={on * (0.8 + 1.6 * flash)} />
              </mesh>
            );
          })}
        </group>
      );
    })}
  </>
);

// ─── ball spin: rolling without slipping (ω = n × v / R) on the dish and the rails, kept in the air; the loop must end
// in the start orientation, so the leftover rotation is eased out over the calm part of the spiral
const SPIN = (() => {
  const steps = Math.ceil(DURATION * 240), dt = DURATION / steps;
  const out: THREE.Quaternion[] = [];
  let q = new THREE.Quaternion(), w = new THREE.Vector3();
  for (let k = 0; k <= steps; k++) {
    out.push(q.clone());
    const a = ballAt(k * dt), b = ballAt(Math.min((k + 1) * dt, DURATION - 1e-6));
    const vel = v3(b.p).sub(v3(a.p)).divideScalar(dt);
    if (a.n && vel.length() < 40) w = new THREE.Vector3().crossVectors(v3(a.n), vel).divideScalar(BALL_R);
    const ang = w.length() * dt;
    if (ang > 1e-9) q = new THREE.Quaternion().setFromAxisAngle(w.clone().normalize(), ang).multiply(q);
  }
  const fix = out[out.length - 1].clone().invert();
  return out.map((qq, k) => new THREE.Quaternion().slerp(fix, THREE.MathUtils.smoothstep(k * dt, 0.6, T_DISH - 0.6)).multiply(qq));
})();
const spinAt = (t: number) => SPIN[Math.min(SPIN.length - 1, Math.round((t / DURATION) * (SPIN.length - 1)))];

// ─── camera: the approved three-quarter pose; while the ball spirals it cranes in and up over the dish, and it is
// back (and still) before the ball drops, so the run down the rails and the throw are seen whole. Same pose and no
// motion at both ends of the loop.
const CAM_IN = (() => {
  const look = new THREE.Vector3(FUNNEL.cx + 0.05, 2.95, FUNNEL.cz + 0.05);
  return { look, pos: look.clone().add(CAM.pos.clone().sub(CAM.look).multiplyScalar(0.64)).add(new THREE.Vector3(0, 0.6, 0)) };
})();
export const cameraAt = (t: number) => {
  const w = THREE.MathUtils.smoothstep(t, 0.3, 2.2) * (1 - THREE.MathUtils.smoothstep(t, T_DISH - 1.5, T_DISH - 0.15));
  return { pos: CAM.pos.clone().lerp(CAM_IN.pos, w), look: CAM.look.clone().lerp(CAM_IN.look, w) };
};

const Ball: React.FC<{ p: V3; q: THREE.Quaternion }> = ({ p, q }) => (
  <group position={[p[0], p[1], p[2]]} quaternion={q}>
    <mesh castShadow>
      <sphereGeometry args={[BALL_R, 48, 32]} />
      {/* the user's colour for this video (stands out on the purple and the pearl dish); satin, no glow */}
      <meshPhysicalMaterial color="#34cc9a" roughness={0.32} clearcoat={0.6} clearcoatRoughness={0.2} />
    </mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[BALL_R * 0.995, BALL_R * 0.17, 16, 64]} />
      <Glossy c="#7a3fe0" rough={0.35} />
    </mesh>
  </group>
);

export const Scene: React.FC<{ t: number; silent?: boolean }> = ({ t, silent }) => {
  const { width, height } = useVideoConfig();
  const cam = cameraAt(t);
  return (
    <AbsoluteFill style={{ background: BG }}>
      <ThreeCanvas width={width} height={height} shadows camera={{ fov: CAM.fov, near: 0.1, far: 80 }} gl={{ antialias: true }}>
        <Studio pos={cam.pos} look={cam.look} />
        <hemisphereLight args={["#ffffff", "#8a8299", 0.6]} />
        <spotLight castShadow position={[-3.5, 9, 4.5]} angle={0.5} penumbra={0.9} intensity={115} decay={2} color="#fff3e6" shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-radius={6} />
        <directionalLight position={[5, 3, -4]} intensity={0.9} color="#b9a4ff" />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[80, 80]} />
          <meshStandardMaterial color="#a7a2b4" roughness={0.9} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(BASE.x0 + BASE.x1) / 2, 0.01, (BASE.z0 + BASE.z1) / 2]}>
          <planeGeometry args={[BASE.x1 - BASE.x0 + 1.6, BASE.z1 - BASE.z0 + 1.6]} />
          <meshBasicMaterial map={CONTACT} transparent depthWrite={false} />
        </mesh>
        <mesh geometry={BASE_GEO} castShadow receiveShadow>
          <Glossy c={PURPLE} rough={0.3} />
        </mesh>
        <mesh geometry={BASE_TRIM}>
          <Glossy c={GOLD} metal={1} rough={0.2} />
        </mesh>
        <Pillars />
        <Funnel />
        <Track t={t} />
        <Ball p={ballAt(t).p} q={spinAt(t)} />
      </ThreeCanvas>
      {!silent && <Html5Audio src={staticFile("vzfunnel/funnel.wav")} />}
    </AbsoluteFill>
  );
};

/** the video starts with the ball at the top of the rails (the user's wish: speed first), on a whole frame; the
 * timeline itself still starts at the landing, so the loop is just read from a later point. make-audio shifts the
 * sound by the same amount. */
export const START = Math.floor(T_RAILS * FPS) / FPS;
export const FunnelLoop: React.FC<{ silent?: boolean }> = ({ silent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <Scene t={(frame / fps + START) % DURATION} silent={silent} />;
};

// check moments: landing, dish close-up, late spiral, over the hole, on the rails, the ramp, the throw, last frame
export const LOOK_T = [0.05, 1.6, 3.6, 5.6, T_RAILS + 0.12, T_RAILS + T_TRACK * 0.85, T_LAUNCH + T_FLIGHT * 0.35, DURATION - 1 / FPS];
export const FunnelLook: React.FC<{ silent?: boolean }> = () => {
  const frame = useCurrentFrame();
  return <Scene t={LOOK_T[Math.min(frame, LOOK_T.length - 1)]} silent />;
};

// names the cloud sync expects (--file=Funnel --export=VZFUNNEL / VZFUNNELLOOK)
export const VZFUNNEL = FunnelLoop;
export const VZFUNNEL_FPS = FPS;
export const VZFUNNEL_FRAMES = FRAMES;
export const VZFUNNELLOOK = FunnelLook;
export const VZFUNNELLOOK_FPS = FPS;
export const VZFUNNELLOOK_FRAMES = LOOK_T.length;
