// v43 "The bank that came by mail": flat cartoon cards in a painted 3D toon world (cartoon-3d-short skill engine).
// One three.js world (world.ts) posed per frame from the story timeline (story.ts). Post chain:
//   render -> InkPass (world ink lines) -> lens blur pre + main (DOF per shot) -> [bloom + NEUTRAL tone map + grade], MSAA 4.
// Every pixel-sized parameter is given at 1080x1920 and scales with the output size.
import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, Html5Audio, continueRender, delayRender, getInputProps, staticFile, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import { BlendFunction, BloomEffect, EffectComposer, EffectPass, RenderPass, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { World, loadKit } from "./world";
import { InkPass, noInkFallback } from "./ink";
import { LensBlur } from "./lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH, gradeFor } from "./grade";
import { Kit } from "./build";
import { TOTAL, FPS, FLASH_AT, SHOTS, layersAt, dofAt } from "./story";

export const V43_FRAMES = TOTAL;
export const V43_FPS = FPS;

type PostToggles = { ink: boolean; lens: boolean; bloom: boolean; grade: boolean; dpr?: number };
const toggles = (): PostToggles => ({ ink: true, lens: true, bloom: true, grade: true, ...((getInputProps() as { post?: Partial<PostToggles> }).post ?? {}) });

/** bloom for emissive sources only; its MIP chain always starts at 540x960 so the glow keeps its size at any output scale */
const makeBloom = () => {
  const b = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.5, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6 });
  const mip = b.mipmapBlurPass;
  const setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};

const fwd = new THREE.Vector3(), fpt = new THREE.Vector3();

const useKit = () => {
  const [kit, setKit] = useState<Kit | null>(null);
  const [handle] = useState(() => delayRender("v43 kit"));
  useEffect(() => { loadKit().then((k) => { setKit(k); continueRender(handle); }); }, [handle]);
  return kit;
};

const Inner: React.FC<{ id: number; kit: Kit }> = ({ id, kit }) => {
  const f = useCurrentFrame();
  const { camera, scene, gl, size } = useThree();
  const world = useMemo(() => new World(kit), [kit]);
  const target = useMemo(() => new THREE.Vector3(), []);
  const on = useMemo(toggles, []);
  const cam = camera as THREE.PerspectiveCamera;
  const fx = useMemo(() => {
    const ink = new InkPass(scene, cam), lens = new LensBlur({ maxCoC: 24, nearScale: 1.2 });
    const grade = new GradeEffect(GRADES.day, GRADE_STRENGTH.day);
    const composer = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType, multisampling: 4, stencilBuffer: false });
    composer.addPass(new RenderPass(scene, cam));
    if (on.ink) composer.addPass(ink);
    if (on.lens) { composer.addPass(new EffectPass(cam, lens.pre)); composer.addPass(new EffectPass(cam, lens.main)); }
    const tail = [on.bloom ? makeBloom() : null, new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }), on.grade ? grade : null].filter(Boolean) as BloomEffect[];
    composer.addPass(new EffectPass(cam, ...tail));
    return { ink, lens, grade, composer };
  }, [cam, scene, gl, on]);
  useLayoutEffect(() => {
    const old = gl.toneMapping;
    gl.toneMapping = THREE.NoToneMapping;
    return () => { gl.toneMapping = old; fx.composer.dispose(); fx.ink.dispose(); };
  }, [fx, gl]);
  useLayoutEffect(() => { fx.composer.setSize(size.width, size.height); }, [fx, size]);
  target.copy(world.update(id, f, cam, scene));
  noInkFallback(world.root);
  // thin-lens focus: distance along the view axis to the shot's focus point (default: the camera's look target)
  const d = dofAt(f);
  cam.getWorldDirection(fwd);
  if (d.focus) fpt.set(...d.focus(f)); else fpt.copy(target);
  fx.lens.focus = Math.max(0.3, fpt.sub(cam.position).dot(fwd));
  fx.lens.cInf = d.cInf;
  gradeFor(fx.grade, SHOTS[id - 1].light);
  useFrame(() => fx.composer.render(), 1);
  return <primitive object={world.root} dispose={null} />;
};

const ShotView: React.FC<{ id: number; kit: Kit; alpha: number }> = ({ id, kit, alpha }) => {
  const dpr = toggles().dpr;
  return (
    <AbsoluteFill style={{ opacity: alpha }}>
      <ThreeCanvas width={1080} height={1920} {...(dpr ? { dpr } : {})} shadows gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
        camera={{ fov: 40, near: 0.2, far: 1500 }}>
        <Inner id={id} kit={kit} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

export const V43: React.FC<{ silent?: boolean }> = ({ silent }) => {
  const f = useCurrentFrame();
  const kit = useKit();
  if (!kit) return null;
  const flash = f >= FLASH_AT && f < FLASH_AT + 4 ? [1, 0.75, 0.45, 0.2][f - FLASH_AT] : 0;
  return (
    <AbsoluteFill style={{ background: "#cfe3f2" }}>
      {layersAt(f).map((l, i) => <ShotView key={i ? "over" : "base"} id={l.id} kit={kit} alpha={l.alpha} />)}
      {flash > 0 && <AbsoluteFill style={{ background: "#ffffff", opacity: flash }} />}
      {!silent && <Html5Audio src={staticFile("v43/mix-norm.wav")} />}
    </AbsoluteFill>
  );
};
