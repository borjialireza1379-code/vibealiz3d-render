// Vibealiz3D musical marble machine: geometry + the whole loop as physics, pure math (no three.js), so the audio
// script (Node) imports the same timeline. One loop: rest on the spring plate → spring compresses → release →
// ballistic flight into the top tray → bounces, circles the tray (decelerating, drifting to the wall, then in)
// → drops through the hole → glass helix (gravity to a terminal speed, banks on the outer wall: tan φ = v²/(r·g))
// → rolls across the base → hops onto the spring plate → settles; note-lights fade off bottom-up → loop.
export type V3 = [number, number, number];

export const FPS = 60;
export const G = 40; // gravity in scene units/s² (1 unit ≈ 1 dm; real g ≈ 98 → a gentle slow-motion)
export const BALL_R = 0.125;

export const BASE_R = 1.35;
export const BASE_TOP = 0.45; // extruded 0.4 + bevel 0.05
export const TRAY_Y = 3.75;
export const TRAY_R = 0.95;
export const TRAY_FLOOR = 3.92;
export const HELIX = { r: 0.62, y0: 0.62, y1: 3.2, turns: 5.5, tube: 0.15 };
export const LAUNCH_ANGLE = (100 * Math.PI) / 180;
export const LAUNCH_R = 1.62; // spring launcher stands on the floor just outside the base
export const PLATE_TOP = 0.38; // spring plate top at rest
export const HOUSING_H = 0.42;
const A_END = LAUNCH_ANGLE - (66 * Math.PI) / 180; // helix exit angle: its tangent points at the launcher
const TAU = Math.PI * 2;
export const helixAngle = (u: number) => A_END - (1 - u) * HELIX.turns * TAU;
export const HOLE_ANGLE = helixAngle(0);
export const HOLE: [number, number] = [Math.cos(HOLE_ANGLE) * HELIX.r, Math.sin(HOLE_ANGLE) * HELIX.r];
export const LAUNCHER: [number, number] = [Math.cos(LAUNCH_ANGLE) * LAUNCH_R, Math.sin(LAUNCH_ANGLE) * LAUNCH_R];

export const helixPoint = (u: number): V3 => {
  const a = helixAngle(u);
  return [Math.cos(a) * HELIX.r, HELIX.y1 - u * (HELIX.y1 - HELIX.y0), Math.sin(a) * HELIX.r];
};
const HELIX_LEN = Math.hypot(TAU * HELIX.r * HELIX.turns, HELIX.y1 - HELIX.y0);

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a: number, b: number, x: number) => {
  const k = clamp((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const arc = (a: V3, b: V3, T: number, s: number): V3 => {
  const vy = (b[1] - a[1]) / T + (G * T) / 2;
  const u = s / T;
  return [lerp(a[0], b[0], u), a[1] + vy * s - (G * s * s) / 2, lerp(a[2], b[2], u)];
};
// a ball dropped from rest-height h keeps bouncing: heights h, h·e², …; returns the height above the floor
const bounces = (s: number, hs: number[]) => {
  for (const h of hs) {
    const T = 2 * Math.sqrt((2 * h) / G);
    if (s < T) return Math.sqrt(2 * G * h) * s - (G * s * s) / 2;
    s -= T;
  }
  return 0;
};
const bounceSpan = (hs: number[]) => hs.reduce((a, h) => a + 2 * Math.sqrt((2 * h) / G), 0);

// ─── times
export const T_REST = 0.35;
export const T_COMP = 0.85;
export const T_RELEASE = T_REST + T_COMP;
const T_LIFT = 0.056; // the plate reaches its rest height a quarter-cycle after release: the ball leaves it there
export const T_LAUNCH = T_RELEASE + T_LIFT;
const T_FLIGHT = 0.62;
export const T_TRAY = T_LAUNCH + T_FLIGHT;
const TRAY_BOUNCES = [0.1, 0.028, 0.007];
const TRAY_DUR = 2.6;
export const T_HOLE = T_TRAY + TRAY_DUR;
const LAUNCH_POS: V3 = [LAUNCHER[0], PLATE_TOP + BALL_R, LAUNCHER[1]];
const TRAY_LAND_R = 0.7;
const TRAY_LAND: V3 = [Math.cos(LAUNCH_ANGLE) * TRAY_LAND_R, TRAY_FLOOR + BALL_R, Math.sin(LAUNCH_ANGLE) * TRAY_LAND_R];
let dTheta = (((HOLE_ANGLE - LAUNCH_ANGLE) % TAU) + TAU) % TAU;
if (dTheta < Math.PI) dTheta += TAU; // at least one lap round the tray
const HELIX_IN_Y = HELIX.y1 - (HELIX.tube - BALL_R);
const T_DROP = Math.sqrt((2 * (TRAY_FLOOR + BALL_R - HELIX_IN_Y)) / G);
export const T_HELIX = T_HOLE + T_DROP;
const V_IN = 3.2, V_TERM = 4.6, V_TAU = 0.7;
const helixS = (s: number) => V_TERM * s - (V_TERM - V_IN) * V_TAU * (1 - Math.exp(-s / V_TAU));
const helixV = (s: number) => V_TERM - (V_TERM - V_IN) * Math.exp(-s / V_TAU);
const HELIX_DUR = (() => {
  let lo = 0, hi = 20;
  for (let k = 0; k < 60; k++) {
    const m = (lo + hi) / 2;
    if (helixS(m) < HELIX_LEN) lo = m;
    else hi = m;
  }
  return lo;
})();
export const T_BASE = T_HELIX + HELIX_DUR;
// base roll: a cubic Bézier from the helix exit (along its tangent) to the base edge above the launcher
const EXIT: V3 = (() => {
  const p = helixPoint(1);
  return [p[0], BASE_TOP + BALL_R, p[2]];
})();
const EXIT_T: V3 = [-Math.sin(A_END), 0, Math.cos(A_END)];
const EDGE: V3 = [Math.cos(LAUNCH_ANGLE) * (BASE_R + 0.02), BASE_TOP + BALL_R, Math.sin(LAUNCH_ANGLE) * (BASE_R + 0.02)];
const EDGE_N: V3 = [Math.cos(LAUNCH_ANGLE), 0, Math.sin(LAUNCH_ANGLE)];
const BZ: V3[] = [EXIT, add(EXIT, EXIT_T, 0.45), add(EDGE, EDGE_N, -0.35), EDGE];
const bez = (k: number): V3 => {
  const m = 1 - k;
  const w = [m * m * m, 3 * m * m * k, 3 * m * k * k, k * k * k];
  return [0, 1, 2].map((j) => BZ.reduce((a, p, i) => a + p[j] * w[i], 0)) as V3;
};
const BZ_TABLE = (() => {
  const n = 200, out: number[] = [0];
  for (let i = 1; i <= n; i++) {
    const a = bez((i - 1) / n), b = bez(i / n);
    out.push(out[i - 1] + Math.hypot(b[0] - a[0], b[2] - a[2]));
  }
  return out;
})();
const BZ_LEN = BZ_TABLE[BZ_TABLE.length - 1];
const bezAt = (dist: number) => {
  let i = 1;
  while (i < BZ_TABLE.length - 1 && BZ_TABLE[i] < dist) i++;
  const k = (i - 1 + (dist - BZ_TABLE[i - 1]) / (BZ_TABLE[i] - BZ_TABLE[i - 1] || 1)) / (BZ_TABLE.length - 1);
  return bez(clamp(k));
};
const V_EXIT = helixV(HELIX_DUR) * 0.85, V_EDGE = 2.3; // rolling friction on the base
const BASE_DUR = (2 * BZ_LEN) / (V_EXIT + V_EDGE);
export const T_HOP = T_BASE + BASE_DUR;
const HOP_DUR = 0.24;
export const T_PLATE = T_HOP + HOP_DUR;
const PLATE_BOUNCES = [0.05, 0.014, 0.004];
export const T_SETTLE = T_PLATE + bounceSpan(PLATE_BOUNCES);
export const LIGHTS = 30;
const OFF_START = T_PLATE + 0.35, OFF_SPREAD = 0.8, FADE = 0.3;
export const DURATION = Math.ceil((OFF_START + OFF_SPREAD + FADE + 0.35) * FPS) / FPS;
export const FRAMES = Math.round(DURATION * FPS);

// ─── spring plate: compress, release (damped spring), small dip when the ball comes back
export const plateD = (t: number) => {
  let d = -0.12 * smooth(T_REST, T_RELEASE, t);
  if (t >= T_RELEASE) {
    const s = t - T_RELEASE;
    d = -0.12 * Math.exp(-6 * s) * Math.cos(28 * s);
  }
  if (t >= T_PLATE) {
    const s = t - T_PLATE;
    d += -0.045 * Math.exp(-5 * s) * Math.sin(24 * s);
  }
  return d;
};

export type Phase = "plate" | "air" | "tray" | "drop" | "helix" | "base";
export type Pose = { p: V3; phase: Phase; u?: number; v?: number; n?: V3 };

export function ballAt(t: number): Pose {
  t = ((t % DURATION) + DURATION) % DURATION;
  const onPlate = (lift = 0): Pose => ({ p: [LAUNCHER[0], PLATE_TOP + plateD(t) + BALL_R + lift, LAUNCHER[1]], phase: "plate" });
  if (t < T_LAUNCH) return onPlate();
  if (t < T_TRAY) return { p: arc(LAUNCH_POS, TRAY_LAND, T_FLIGHT, t - T_LAUNCH), phase: "air" };
  if (t < T_HOLE) {
    const s = t - T_TRAY, x = s / TRAY_DUR;
    const th = LAUNCH_ANGLE + dTheta * (x + 0.7 * x * (1 - x)); // decelerates: speed 1.7 → 0.3 of the mean
    const rOut = TRAY_LAND_R + 0.11 * Math.sin(clamp(x / 0.35) * (Math.PI / 2)); // pushed to the wall first
    const r = lerp(rOut, HELIX.r, smooth(0.6, 1, x)); // then slows and drifts in to the hole
    return { p: [Math.cos(th) * r, TRAY_FLOOR + BALL_R + bounces(s, TRAY_BOUNCES), Math.sin(th) * r], phase: "tray" };
  }
  if (t < T_HELIX) {
    const s = t - T_HOLE;
    return { p: [HOLE[0], TRAY_FLOOR + BALL_R - 0.5 * G * s * s, HOLE[1]], phase: "drop" };
  }
  if (t < T_BASE) {
    const s = t - T_HELIX;
    const u = clamp(helixS(s) / HELIX_LEN);
    const v = helixV(s);
    const c = helixPoint(u);
    const a = helixAngle(u);
    const phi = Math.atan((v * v) / (HELIX.r * G)); // banking on the outer wall
    const out: V3 = [Math.cos(a), 0, Math.sin(a)];
    const dir: V3 = [out[0] * Math.sin(phi), -Math.cos(phi), out[2] * Math.sin(phi)];
    return { p: add(c, dir, HELIX.tube - BALL_R), phase: "helix", u, v, n: [-dir[0], -dir[1], -dir[2]] };
  }
  if (t < T_HOP) {
    const s = t - T_BASE;
    const acc = (V_EDGE - V_EXIT) / BASE_DUR;
    return { p: bezAt(V_EXIT * s + 0.5 * acc * s * s), phase: "base" };
  }
  if (t < T_PLATE) return { p: arc(EDGE, LAUNCH_POS, HOP_DUR, t - T_HOP), phase: "air" };
  return onPlate(bounces(t - T_PLATE, PLATE_BOUNCES));
}

// ─── note-lights along the helix: on when the ball passes, off bottom-up after it is home
export const lightU = (i: number) => (i + 0.5) / LIGHTS;
export const LIGHT_ON = Array.from({ length: LIGHTS }, (_, i) => {
  let lo = 0, hi = HELIX_DUR;
  for (let k = 0; k < 50; k++) {
    const m = (lo + hi) / 2;
    if (helixS(m) / HELIX_LEN < lightU(i)) lo = m;
    else hi = m;
  }
  return T_HELIX + lo;
});
export const LIGHT_OFF = Array.from({ length: LIGHTS }, (_, i) => OFF_START + (1 - lightU(i)) * OFF_SPREAD);
/** 0 = off, 1 = on; flash = fresh glow right after it lights */
export const lightState = (i: number, t: number) => {
  const on = t >= LIGHT_ON[i] ? 1 - smooth(LIGHT_OFF[i], LIGHT_OFF[i] + FADE, t) : 0;
  const flash = t >= LIGHT_ON[i] ? Math.exp(-(t - LIGHT_ON[i]) / 0.25) : 0;
  return { on, flash };
};

// ─── sound events for the audio script
export const EVENTS = {
  release: T_RELEASE,
  trayLand: T_TRAY,
  trayBounces: TRAY_BOUNCES.map((_, k) => T_TRAY + bounceSpan(TRAY_BOUNCES.slice(0, k + 1))).slice(0, -1),
  trayRoll: [T_TRAY + 0.3, T_HOLE] as [number, number],
  hole: T_HOLE,
  helixIn: T_HELIX,
  helixRoll: [T_HELIX, T_BASE] as [number, number],
  baseRoll: [T_BASE, T_HOP] as [number, number],
  plateLand: T_PLATE,
  plateBounces: PLATE_BOUNCES.map((_, k) => T_PLATE + bounceSpan(PLATE_BOUNCES.slice(0, k + 1))).slice(0, -1),
  lightsOn: LIGHT_ON,
  lightsOff: LIGHT_OFF,
};
