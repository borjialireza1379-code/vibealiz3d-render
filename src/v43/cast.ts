// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing. Characters are yaw-only billboards shaded by cardShade() (scene
// tint, bright floor, side gradient toward the sun, painted crescent in the drawing); standing ones get a soft
// multiply contact blob. Effects are unlit cards. Cards, effects and blobs live on the NOINK layer so the world ink
// pass never outlines their quads. stage(id, f, cam) at the bottom is the acting of v43, shot by shot.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, townsfolk, fxBurst, fxStars, fxPuff, fxCloud, fxShadow, fxContact, Outfit, Expr, FrontOpts, SideOpts } from "./toon";
import { BANKER, FREIGHT, CLERK, POSTMASTER, mailman, fxBag, fxHorse, fxCobweb, fxTumble, fxSocks } from "./toon2";
import {
  FPS, SHOTS, V3, W, HITS, CITY, FRE, KILN, INT, RAIL, WAG, SIGN_P, PM, FGUY, BANKER_HOOK, BANKER_LOT, BANKER_FRE,
  smooth, clamp01, pop, wobble, haulX, trainX, wagonX, walkIn,
} from "./story";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

const at = (o: V3, x: number, y: number, z: number): V3 => [o[0] + x, o[1] + y, o[2] + z];

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
/** world roots that hold actors (to find the scene's sun when world.ts does not pass it) */
const ROOTS = new Set<THREE.Object3D>();

/** lit flat character: cardShade() material, receives shadows (dims to the bright floor only), casts its silhouette
 *  when world.ts says so (golden). Drawn after the contact blobs (renderOrder 1). */
export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    // rim width is in output pixels: tell the card shader the render height (1920 = 1080 x 1920 frame)
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
    ROOTS.add(parent);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
/** unlit effect card: hard cut-out (ink drawings), soft see-through (dust, mist) or a multiply ground blob */
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      // no mipmaps: at grazing views the mip chain averages the blob with its white surround and it fades out
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    }
    else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; }
  }
}

// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body" | "swing"; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
/** sun = world direction TOWARD the sun (optional: when absent the scene's shadow-casting light is used) */
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
/** head-shape seed: 7 shapes, so marching soldiers in step still share canvases */
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
/** drawing resolution by distance: [canvas w, h, scale from the 600 x 1000 design]; sized for the 1440 x 2560 final */
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

// ---------------- light ----------------
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: "day" | "golden" = "day";
const sunOf = (root: THREE.Object3D) => {
  let s: THREE.DirectionalLight | null = null;
  root.traverse((o) => { if (!s && o instanceof THREE.DirectionalLight && o.castShadow) s = o; });
  return s as THREE.DirectionalLight | null;
};
/** the sun of the world that is calling: the attached root whose sun target sits on this camera's view axis */
const findSun = (cam: CamInfo, out: THREE.Vector3) => {
  if (cam.sun) return out.copy(cam.sun).normalize();
  let best: THREE.DirectionalLight | null = null, err = Infinity;
  for (const r of ROOTS) {
    if (!r.parent) continue;
    const s = sunOf(r);
    if (!s) continue;
    const d = tmp.copy(s.target.position).sub(cam.pos), e = Math.abs(d.dot(cam.right)) / (d.length() || 1);
    if (e < err) { err = e; best = s; }
  }
  return best ? out.copy(best.position).sub(best.target.position).normalize() : out;
};
/** canvas angle the sun comes FROM on an upright card facing the camera, in 45-degree steps (small texture cache) */
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};

/** front / side view and mirroring for someone at (x, z) walking along (dx, dz); fs = foreshortening of the walk */
export const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};

// ---------------- life: blinks and reaction timing ----------------
/** reference expression and action changes land 0-3 f before the word onset */
const LEAD = 2 / FPS;
/** eyelid 0 open .. 1 shut. Reference: gaps 0.5-2.3 s, 4-frame blink half / shut / shut / half, plus a blink across
 *  every expression swap (the shut frames hide the swap) */
const LID = [0.5, 1, 1, 0.5];
const lidAt = (t: number, i: number, swaps: number[] = []) => {
  const f = Math.round(t * FPS);
  for (const ts of swaps) { const k = f - Math.round((ts - LEAD) * FPS) + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13)); // next blink 0.5-2.3 s later
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
/** one character drawing in the 600 x 1000 design space, sized by distance, lit from the scene's sun */
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1): Place & { tierKey: string } => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return {
    key, x, y, z, scale, mirror, tierKey: `${w}`,
    draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)),
    size: [w, h, k],
  };
};

/** ground shadow under a standing / sitting card (review rounds 2-4), multiply, blue-violet: a TIGHT contact pool right under
 *  the feet (~.5 on screen at the core) so nobody floats, plus by day (cards cast no real shadow) a lighter soft tail
 *  stretched AWAY from the sun, length ~1.6 m / tan(sun elevation), capped. Golden: world.ts casts real card shadows. */
const CONTACT: Record<"day" | "golden", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h; // feet at v = .2 of the card
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c,
      w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc,
    w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};

// ---------------- who does what in every shot ----------------
export type Stage = { places: Place[]; fx: FxPlace[] };
const FRONT = { side: false, mirror: false }, RIGHT = { side: true, mirror: false }, LEFT = { side: true, mirror: true };
const WHO = {
  banker: { i: 1, o: BANKER, okey: "bk" }, freight: { i: 2, o: FREIGHT, okey: "fr" }, clerk: { i: 3, o: CLERK, okey: "cl" },
  pm: { i: 4, o: POSTMASTER, okey: "pm" },
};
const MAIL = [0, 1, 2, 3].map((v) => mailman(v));
const FOLK = [0, 1, 2, 3, 4, 5].map((v) => townsfolk(v));
const mailWho = (i: number): Who => ({ i: 10 + i, o: MAIL[i % 4], okey: `m${i % 4}` });
const T = (f: number) => f / FPS;
/** a standing / walking character with its ground shadow */
const put = (out: Stage, cam: CamInfo, who: Who, p: V3, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts = {}, scale = 1, shadow = true) => {
  out.places.push(person(cam, who, p[0], p[1], p[2], view, fo, so, scale));
  if (shadow) blob(out, p[0], p[1], p[2], scale);
};
const burst = (out: Stage, f: number, f0: number, p: V3, size: number, n = 6, col?: string) => {
  if (f < f0 || f >= f0 + n) return;
  const u = q((f - f0) / n, 30);
  out.fx.push({ key: `burst${u}${col ?? ""}`, cw: 500, ch: 500, draw: (pp) => fxBurst(pp, u, col), x: p[0], y: p[1], z: p[2], w: size, h: size });
};
const puff = (out: Stage, f: number, f0: number, p: V3, size: number, n = 12) => {
  if (f < f0 || f >= f0 + n) return;
  const u = q((f - f0) / n, 24);
  out.fx.push({ key: `puff${u}`, cw: 300, ch: 300, draw: (pp) => fxPuff(pp, u), x: p[0], y: p[1], z: p[2], w: size, h: size, soft: true });
};
/** rising smoke / steam from a point: n soft cloud cards drifting along (dx, dz) */
const smoke = (out: Stage, f: number, p: V3, n: number, rise: number, dx: number, size: number, rate = 0.012) => {
  for (let k = 0; k < n; k++) {
    const u = (((f * rate + k / n) % 1) + 1) % 1, s = size * (0.35 + 1.1 * u) * (u > 0.8 ? (1 - u) / 0.2 : 1);
    out.fx.push({ key: `cloud${k % 3}`, cw: 600, ch: 300, draw: (pp) => fxCloud(pp, k % 3), x: p[0] + dx * u, y: p[1] + rise * u, z: p[2] - 0.02 * k, w: s, h: s * 0.5, soft: true });
  }
};
const stars = (out: Stage, f: number, i: number, p: V3) => {
  const u = q((f * 0.03 + hh(i)) % 1, 30);
  out.fx.push({ key: `stars${u}`, cw: 420, ch: 210, draw: (pp) => fxStars(pp, u), x: p[0], y: p[1], z: p[2], w: 0.75, h: 0.375 });
};
/** 0 = hammer up, 1 = struck: 4 f wind-up, held 7 f at the top, a 1-frame strike on the word */
const hammerK = (f: number) => {
  let k = 1;
  for (const fh of HITS) { const n = f - fh; if (n >= -11 && n < -7) k = Math.min(k, 1 - smooth((n + 11) / 4)); else if (n >= -7 && n < 0) k = 0; }
  return k;
};

/** everything with a face (and every flat effect) in shot `id` at frame f */
export const stage = (id: number, f: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] }, s = SHOTS[id - 1], t = T(f);
  LNAME = s.light;
  findSun(cam, SUN);
  const lid = (i: number, swaps: number[] = []) => lidAt(t, i, swaps.map(T));
  const B = WHO.banker, G = WHO.freight, C = WHO.clerk;
  switch (id) {
    case 1: {
      if (f < W.notMoney - 2) put(out, cam, B, BANKER_HOOK, FRONT, { mode: "stand", expr: "grin", facing: 1, blink: lid(1), headTilt: 3 });
      else if (f < 114) {
        const held = f < W.bagToss;
        put(out, cam, B, BANKER_HOOK, FRONT, { mode: "stand", expr: held ? "smile" : "smile_closed", prop: held ? "bag" : null, blink: lid(1, [W.bagToss]), headTilt: held ? -3 : 5 });
        if (!held && f < W.bagToss + 12) { // the money sack sails off
          const u = (f - W.bagToss) / 12;
          out.fx.push({ key: "bag", cw: 300, ch: 300, draw: fxBag, x: BANKER_HOOK[0] + 0.45 + 1.5 * u, y: 1.85 + 1.5 * u - 2.4 * u * u, z: BANKER_HOOK[2] + 0.05, w: 0.44, h: 0.44, rot: -5 * u });
        }
      } else put(out, cam, B, BANKER_HOOK, FRONT, { mode: "stand", expr: "grin", wave: q(Math.sin(f * 0.5), 30), blink: lid(1) });
      put(out, cam, mailWho(0), [2.8, 0, 2.4], FRONT, { mode: "stand", expr: "shock", blink: 0, headTilt: -6 });
      if (f >= 114) put(out, cam, mailWho(1), [-3.3, 0, 3.2], FRONT, { mode: "stand", expr: f < W.actual ? "nervous" : "shock", blink: 0 });
      burst(out, f, W.stamp, [-1.35, 6.2, 0.9], 5.2, 7);
      burst(out, f, W.actual - 1, [0, 4.6, 2.2], 10, 8);
      for (const [x, z, d] of [[-4.2, 5, 0], [4.2, 5, 2], [0, 9, 5], [-2.4, 8, 7], [2.6, 8, 9]]) puff(out, f, 134 + d, [x, 0.8, z], 4.2, 16);
      break;
    }
    case 2: {
      put(out, cam, B, BANKER_LOT, FRONT, { mode: "stand", expr: "neutral", blink: lid(1) });
      ([[-9, 4.5], [-13.5, 7.5], [8, 5.5], [12.5, 9], [-5, 10], [17, 6], [-20, 5.2]] as const).forEach(([x, z], i) =>
        put(out, cam, { i: 30 + i, o: FOLK[i % 6], okey: `f${i % 6}` }, [x, 0, z], FRONT, { mode: "stand", expr: i % 2 ? "smile" : "neutral", blink: lid(30 + i) }));
      break;
    }
    case 3: put(out, cam, B, BANKER_LOT, FRONT, { mode: "stand", expr: f < W.tough - 3 ? "smile" : "grin", prop: "brick", blink: lid(1, [W.tough - 3]), headTilt: -4 }); break;
    case 4: smoke(out, f, [KILN[0] + 6.1, 13.8, KILN[2] - 1.3], 6, 9, -7, 5.5); break;
    case 5: put(out, cam, B, BANKER_LOT, FRONT, { mode: "stand", expr: f < W.problem - 2 ? "neutral" : "nervous", blink: lid(1, [W.problem - 2]), headTilt: 5 }); break;
    case 6: for (const [x, z, h] of [[-58, -34, 30], [24, -36, 26], [70, -30, 22]]) smoke(out, f, [CITY[0] + x, h + 2, z], 5, 26, 30, 22, 0.006); break;
    case 7: {
      const big = f >= W.times;
      put(out, cam, G, FGUY, FRONT, { mode: "stand", expr: big ? "laugh" : "grin", blink: lid(2, [W.times]), wave: f >= W.four - 4 ? q(0.4 + 0.5 * Math.sin(f * 0.45), 30) : undefined, facing: 1 });
      ([[0.76, 0.74, W.four], [1.22, 0.74, W.four + 5], [0.8, 1.2, W.times], [1.18, 1.2, W.times + 5]] as const).forEach(([x, y, f0], i) => {
        const k = pop(f, f0);
        if (k > 0) out.fx.push({ key: "bag", cw: 300, ch: 300, draw: fxBag, x: FRE[0] + x, y, z: 3.3 + 0.02 * i, w: 0.56 * k, h: 0.56 * k, rot: (i % 2 ? 1 : -1) * 0.08 });
      });
      break;
    }
    case 8: {
      if (f < 522) put(out, cam, G, [FGUY[0], 0.04 * Math.abs(Math.sin(f * 0.55)), FGUY[2]], FRONT, { mode: "stand", expr: f < 498 ? "grin" : "laugh", blink: 0, headTilt: q(5 * Math.sin(f * 0.55), 20) }, {}, 1, false);
      else {
        put(out, cam, G, FGUY, FRONT, { mode: "stand", expr: "laugh", wave: q(Math.sin(f * 0.5), 30), facing: 1, headTilt: q(4 * Math.sin(f * 0.5), 20) });
        put(out, cam, B, BANKER_FRE, LEFT, {}, { mode: "stand", expr: "stern", blink: lid(1) });
      }
      break;
    }
    case 9: put(out, cam, B, BANKER_FRE, FRONT, { mode: "stand", expr: f < W.smiled - 12 ? "neutral" : f < W.smiled + 2 ? "smile" : "smile_closed", blink: lid(1, [W.smiled - 12, W.smiled + 2]), headTilt: f < W.smiled - 12 ? 0 : -5 }); break;
    case 10: {
      const [x, y, z, gone] = walkIn(f);
      if (!gone) put(out, cam, B, [x, y, z], RIGHT, {}, { mode: "march", phase: q(((f - 618) / FPS * 1.1) % 1, 120), expr: "smile", blink: lid(1), stomp: 0.6, stride: 0.7 });
      break;
    }
    case 11: put(out, cam, B, [INT[0] + 0.05, 0, INT[2] - 0.75], FRONT, { mode: "stand", expr: "grin", wave: q(Math.sin(f * 0.75), 30), blink: lid(1) }); break;
    case 12: put(out, cam, B, [INT[0] - 0.6, 0, INT[2] - 0.75], FRONT, { mode: "stand", expr: "smile", wave: q(Math.sin(f * 0.8), 30), blink: lid(1) }); break;
    case 13: put(out, cam, C, [INT[0] + 0.8, 0, INT[2] - 0.8], FRONT, { mode: "stand", expr: f < W.fifty - 2 ? "neutral" : f < W.heaviest - 3 ? "nervous" : "shock", blink: lid(3, [W.fifty - 2, W.heaviest - 3]), facing: -1 }); break;
    case 14: {
      put(out, cam, C, [INT[0] + 0.55, 0, INT[2] - 0.8], FRONT, { mode: "stand", expr: f < W.one ? "stern" : "neutral", blink: lid(3, [W.one]), facing: -1 });
      burst(out, f, W.one, [INT[0] + 0.14, 1.62, INT[2] + 0.9], 1.0, 5);
      break;
    }
    case 15: {
      put(out, cam, C, [INT[0] + 1.15, 0, INT[2] + 3.7], FRONT, { mode: "stand", expr: "shock", blink: 0, facing: -1, headTilt: -6 });
      put(out, cam, B, [INT[0] - 0.95, 0, INT[2] + 4.0], RIGHT, {}, { mode: "stand", expr: "grin", blink: lid(1) });
      for (const x of [-1.9, 1.9, 0]) puff(out, f, 915, [INT[0] + x, 0.4, INT[2] + 2.3], 2.2, 12);
      break;
    }
    case 16: {
      const done = f >= W.hundred2 + 6;
      put(out, cam, C, at(CITY, 1.2, 0, 14.5), FRONT, { mode: "stand", expr: done ? "dazed" : "shock", blink: 0, facing: 1 });
      if (done) stars(out, f, 3, at(CITY, 1.2, 2.25, 14.5));
      put(out, cam, mailWho(2), at(CITY, -1.1, 0, 16.5), FRONT, { mode: "stand", expr: "shock", blink: 0, facing: 1 });
      for (const [x, z, d] of [[0, 11.5, 0], [11, 11.5, 3], [5.5, 12.5, 6]]) puff(out, f, W.hundred2 + d, at(CITY, x, 0.9, z), 5, 16);
      break;
    }
    case 17: {
      const ex: Expr[] = ["pained", "nervous", "stern", "pained", "dazed", "nervous"];
      for (let i = 0; i < 6; i++) {
        const x = haulX(f) - i * 1.05;
        put(out, cam, mailWho(i), [x, 0, 4.6 + (i % 2) * 0.12], RIGHT, {}, { mode: "march", phase: q((t * 1.1 + hh(i, 3)) % 1, 120), expr: ex[i], blink: lid(10 + i), stomp: 0.5, stride: 0.9, carry: true });
      }
      break;
    }
    case 18: smoke(out, f, [trainX(f) + 2.5, 4.3, RAIL[2]], 7, 3.4, -11, 4.2, 0.03); break;
    case 19: {
      const x = wagonX(f);
      out.fx.push({ key: `horse${q((t * 1.5) % 1, 24)}`, cw: 900, ch: 700, draw: (p) => fxHorse(p, q((t * 1.5) % 1, 24)), x: x + 3.25, y: 0.9, z: WAG[2] + 0.03, w: 2.6, h: 2.02 });
      blob(out, x + 3.2, 0, WAG[2], 1.5);
      put(out, cam, mailWho(1), [x + 0.95, 1.02, WAG[2] + 0.02], FRONT, { mode: "sit", expr: "smile", blink: lid(11) }, {}, 0.9, false);
      for (let k = 0; k < 3; k++) puff(out, f, 1049 + k * 4 - 12, [x - 1.6 - k * 0.5, 0.35, WAG[2] + 0.3], 1.3, 14);
      break;
    }
    case 21: {
      const seat: V3 = [FGUY[0], 0.47, FGUY[2]];
      if (f < 1188) put(out, cam, G, [seat[0], seat[1] + (f >= 1164 ? 0.03 * Math.abs(Math.sin(f * 0.55)) : 0), seat[2]], FRONT, { mode: "sit", expr: "laugh", blink: 0, headTilt: q(4 * Math.sin(f * 0.55), 20) }, {}, 1, false);
      else {
        put(out, cam, G, seat, FRONT, { mode: "sit", expr: f < W.crawling - 3 ? "grin" : "laugh", blink: lid(2, [W.crawling - 3]), facing: 1 }, {}, 1, false);
        out.fx.push({ key: "cobweb", cw: 300, ch: 300, draw: fxCobweb, x: FRE[0] + 1.75, y: 0.86, z: 4.72, w: 0.95, h: 0.95 });
        const u = (f - 1188) / 54, tx = FRE[0] + 4.2 - 5.4 * u;
        out.fx.push({ key: "tumble", cw: 300, ch: 300, draw: fxTumble, x: tx, y: 0.36 + 0.3 * Math.abs(Math.sin(u * 9)), z: 6.4, w: 0.72, h: 0.72, rot: u * 14 });
      }
      break;
    }
    case 22: {
      const on = f >= W.launched;
      put(out, cam, C, at(CITY, -1.65, 0, 3.1), FRONT, { mode: "stand", expr: on ? "grin" : "smile", blink: lid(3, [W.launched]), wave: on ? q(Math.sin(f * 0.6), 30) : undefined, facing: 1 });
      put(out, cam, mailWho(0), at(CITY, 1.65, 0, 3.1), FRONT, { mode: "stand", expr: on ? "grin" : "smile", blink: lid(10, [W.launched]), wave: on ? q(Math.sin(f * 0.6 + 1), 30) : undefined, facing: -1 });
      burst(out, f, W.launched, at(CITY, 0, 4.0, 2.4), 3.4, 6);
      break;
    }
    case 23: put(out, cam, C, [INT[0] + 0.86, 0, INT[2] - 0.8], FRONT, { mode: "stand", expr: f < W.weight ? "neutral" : "smile", blink: lid(3, [W.weight]), facing: -1 }); break;
    case 25: {
      put(out, cam, C, [INT[0] + 0.62, 0, INT[2] - 0.85], FRONT, { mode: "stand", expr: "smile_closed", blink: 0, headTilt: f < W.inside ? -5 : 4 });
      burst(out, f, W.inside, [INT[0] - 0.03, 1.62, INT[2] + 0.9], 1.0, 5);
      break;
    }
    case 26: {
      const th = 0.15 * (f < 1503 ? 1 + 0.06 * Math.sin(f * 0.25) : wobble(f, 1503, 1.15, 2.4));
      out.fx.push({ key: "socks", cw: 520, ch: 300, draw: fxSocks, x: INT[0] + 0.82 * Math.cos(th), y: 2.32 + 0.82 * Math.sin(th) - 0.602 + 0.386 + 0.15, z: INT[2] + 0.56, w: 0.66, h: 0.38 });
      break;
    }
    case 27: {
      put(out, cam, B, [INT[0] - 0.68, 0, INT[2] - 0.8], FRONT, { mode: "stand", expr: "grin", blink: lid(1) });
      put(out, cam, G, [INT[0] + 0.7, 0, INT[2] - 0.8], FRONT, { mode: "stand", expr: f < W.half - 3 ? "grin" : f < W.price2 - 4 ? "shock" : "pained", blink: lid(2, [W.half - 3, W.price2 - 4]) });
      break;
    }
    case 28: {
      const hit = f >= W.happening - 5;
      put(out, cam, WHO.pm, PM, FRONT, { mode: "stand", expr: hit ? "shock" : "stern", blink: hit ? 0 : lid(4), look: hit ? 0 : 1 }, {}, 1, false);
      break;
    }
    case 29: {
      put(out, cam, B, [-1.7, 0, 6.6], FRONT, { mode: "stand", expr: "grin", wave: q(Math.sin(f * 0.5), 30), blink: lid(1) });
      const ex: Expr[] = ["dazed", "pained", "relief", "dazed", "pained", "dazed"];
      ([[-4.4, 7.4], [-3.2, 9.2], [0.4, 8.2], [2.2, 6.6], [3.6, 8.8], [-0.9, 10.2]] as const).forEach(([x, z], i) => {
        put(out, cam, mailWho(i), [x, 0, z], FRONT, { mode: "sit", expr: ex[i], blink: lid(10 + i) }, {}, 1.0);
        if (ex[i] === "dazed") stars(out, f, i, [x, 1.32, z]);
      });
      break;
    }
    case 30: {
      put(out, cam, WHO.pm, SIGN_P, FRONT, { mode: "stand", expr: "stern", prop: ["hammer", q(hammerK(f), 30)], blink: lid(4), facing: 1 }, {}, 1.05);
      for (const fh of HITS) burst(out, f, fh, [SIGN_P[0] + 0.62, 1.55, SIGN_P[2] + 0.1], 0.9, 5);
      break;
    }
    case 31: put(out, cam, B, [-0.8, 0, 9], FRONT, { mode: "stand", expr: "smile_closed", blink: 0, headTilt: 5 }); break;
    case 32: {
      put(out, cam, B, [-2.3, 0, 3.6], FRONT, { mode: "stand", expr: "grin", blink: lid(1) });
      ([[3.2, 4.4], [-4.4, 5.2], [4.6, 6.4]] as const).forEach(([x, z], i) => put(out, cam, { i: 40 + i, o: FOLK[(i * 2 + 1) % 6], okey: `f${(i * 2 + 1) % 6}` }, [x, 0, z], FRONT, { mode: "stand", expr: "smile", blink: lid(40 + i) }));
      if (f >= 1940) {
        const sal = f >= W.mailman - 14;
        put(out, cam, mailWho(0), [1.2, 0, 10.5], FRONT, { mode: "stand", expr: f < W.mailman - 4 ? "relief" : "smile_closed", blink: lid(10, [W.mailman - 4]), wave: sal ? q(0.6 + 0.3 * Math.sin(f * 0.4), 30) : undefined, headTilt: 3 });
      }
      break;
    }
  }
  return out;
};
export { FPS };