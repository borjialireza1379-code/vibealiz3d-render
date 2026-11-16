// Vibealiz3D "vortex funnel" marble machine (from the user's reference: ball spirals down a funnel, drops through
// the hole onto twin rails, sweeps along the base, a J-ramp throws it back up into the funnel). Pure math, no
// three.js, so a later audio script can import the same geometry and timeline.
// Units: 1 ≈ 1 dm. y is up. The funnel stands over the back (−x) end of the base, the J-ramp near the front (+x).
export type V3 = [number, number, number];

export const BALL_R = 0.125;
export const G = 24; // slow motion: the throw back into the funnel takes ~0.65 s

// ─── base: rounded slab
export const BASE = { x0: -2.0, x1: 1.85, z0: -0.72, z1: 1.0, r: 0.3, h: 0.35, bevel: 0.05 };
export const BASE_TOP = BASE.h + 2 * BASE.bevel; // the slab is lifted so its bevelled bottom sits on the floor

// ─── funnel: a chunky rounded ring round a trumpet-shaped dish (flat at the wall, steeper towards the hole, but
// never steeper than the camera looks down, so the hole stays visible)
export const FUNNEL = { cx: -1.05, cz: 0, rOut: 1.08, rIn: 0.84, yBot: 2.72, yLip: 3.28, ySurf: 3.15, hole: 0.19, depth: 0.27, power: 1.45 };
const SPAN = FUNNEL.rIn - FUNNEL.hole;
export const surfY = (r: number) => FUNNEL.ySurf - FUNNEL.depth * (Math.min(Math.max(FUNNEL.rIn - r, 0), SPAN) / SPAN) ** FUNNEL.power;
export const surfSlope = (r: number) => ((FUNNEL.depth * FUNNEL.power) / SPAN) * (Math.min(Math.max(FUNNEL.rIn - r, 0), SPAN) / SPAN) ** (FUNNEL.power - 1); // dy/dr
export const RING_R = 0.5; // the gold groove on the dish
/** ball centre resting on the dish at radius r, angle a (0 = +x, π/2 = +z) */
export const onDish = (r: number, a: number): V3 => {
  const k = surfSlope(r), n = Math.hypot(1, k);
  const rr = r - (k / n) * BALL_R; // the normal leans towards the centre
  return [FUNNEL.cx + Math.cos(a) * rr, surfY(r) + BALL_R / n, FUNNEL.cz + Math.sin(a) * rr];
};

// ─── pillars under the funnel ring (behind the rails)
export const PILLARS: [number, number][] = [150, 212].map((d) => {
  const a = (d * Math.PI) / 180;
  return [FUNNEL.cx + Math.cos(a) * 0.8, FUNNEL.cz + Math.sin(a) * 0.8];
});

// ─── the ball's path on the rails: drop → bend → one sideways sweep → J-ramp (one clean curve, like the reference)
// The drop and the bend lie in a vertical plane turned by PSI0 towards +z; the sweep then eases back to +x, so in
// plan view the whole track is a single arc. Every sample carries T (tangent) and N (support normal: from the rails
// towards the ball centre).
const Y_TOP = FUNNEL.yBot - 0.02; // rails start just under the funnel
const RB = 0.72; // bend radius
const Y_RUN = BASE_TOP + 0.24; // ball centre height on the low run
const Y_BEND = Y_RUN + RB;
export const X_J = 0.92;
export const Z_J = 0.66; // the ramp's plane: the flight lands tangentially on the dish at this radius (clear of the wall)
const RJ = 0.55;
export const J_END = (110 * Math.PI) / 180; // the ramp curls past vertical: the ball leaves going up and back
// heading of the drop/bend plane: the sweep z(k) = zb + (Z_J − zb)(1 − (1 − k)²) must start along it
const PSI0 = (() => {
  let p = 0.4;
  for (let k = 0; k < 40; k++) {
    const xb = FUNNEL.cx + RB * Math.cos(p), zb = FUNNEL.cz + RB * Math.sin(p);
    p = Math.atan((2 * (Z_J - zb)) / (X_J - xb));
  }
  return p;
})();
const H0: V3 = [Math.cos(PSI0), 0, Math.sin(PSI0)];
const XB = FUNNEL.cx + RB * H0[0], ZB = FUNNEL.cz + RB * H0[2];

type Sample = { p: V3; t: V3; n: V3 };
const norm = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
};

const drop = (k: number): Sample => ({ p: [FUNNEL.cx, Y_TOP + (Y_BEND - Y_TOP) * k, FUNNEL.cz], t: [0, -1, 0], n: H0 });
const bend = (k: number): Sample => {
  const th = (k * Math.PI) / 2, out = RB * (1 - Math.cos(th));
  return {
    p: [FUNNEL.cx + H0[0] * out, Y_BEND - RB * Math.sin(th), FUNNEL.cz + H0[2] * out],
    t: [H0[0] * Math.sin(th), -Math.cos(th), H0[2] * Math.sin(th)],
    n: [H0[0] * Math.cos(th), Math.sin(th), H0[2] * Math.cos(th)],
  };
};
const run = (k: number): Sample => {
  const L = X_J - XB, D = Z_J - ZB;
  return {
    p: [XB + L * k, Y_RUN, ZB + D * (1 - (1 - k) ** 2)],
    t: norm([L, 0, 2 * D * (1 - k)]),
    n: [0, 1, 0],
  };
};
const ramp = (k: number): Sample => {
  const ps = k * J_END;
  return {
    p: [X_J + RJ * Math.sin(ps), Y_RUN + RJ - RJ * Math.cos(ps), Z_J],
    t: [Math.cos(ps), Math.sin(ps), 0],
    n: [-Math.sin(ps), Math.cos(ps), 0],
  };
};
const runLen = (() => {
  let s = 0, a = run(0).p;
  for (let i = 1; i <= 400; i++) {
    const b = run(i / 400).p;
    s += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    a = b;
  }
  return s;
})();
export const SEGS = [
  { name: "drop", len: Y_TOP - Y_BEND, f: drop },
  { name: "bend", len: (Math.PI / 2) * RB, f: bend },
  { name: "run", len: runLen, f: run },
  { name: "ramp", len: J_END * RJ, f: ramp },
] as const;
export const TRACK_LEN = SEGS.reduce((a, s) => a + s.len, 0);
/** a point on the track by arc length (the run's S is close enough to arc-length in k) */
export const trackAt = (s: number): Sample & { seg: string } => {
  s = Math.min(Math.max(s, 0), TRACK_LEN);
  for (const g of SEGS) {
    if (s <= g.len) return { ...g.f(s / g.len), seg: g.name };
    s -= g.len;
  }
  const last = SEGS[SEGS.length - 1];
  return { ...last.f(1), seg: last.name };
};

// rails: two chrome rods; the ball sits on both (contact at BALL_R + RAIL_R from its centre)
export const RAIL_R = 0.022;
export const RAIL_W = 0.085; // half the gap
export const RAIL_D = Math.sqrt((BALL_R + RAIL_R) ** 2 - RAIL_W ** 2); // rails sit this far "below" the centre
export const side = (smp: Sample): V3 => norm([
  smp.t[1] * smp.n[2] - smp.t[2] * smp.n[1],
  smp.t[2] * smp.n[0] - smp.t[0] * smp.n[2],
  smp.t[0] * smp.n[1] - smp.t[1] * smp.n[0],
]);
export const railPoint = (s: number, which: -1 | 1): V3 => {
  const m = trackAt(s), b = side(m);
  return [0, 1, 2].map((j) => m.p[j] - m.n[j] * RAIL_D + b[j] * RAIL_W * which) as V3;
};

// ties with candy note-lights: from the start of the bend to the tip of the ramp
export const S_LIGHTS0 = SEGS[0].len + 0.32;
export const LIGHTS = 16;
export const lightS = (i: number) => S_LIGHTS0 + ((i + 0.5) / LIGHTS) * (TRACK_LEN - S_LIGHTS0 - 0.08);

// ─── flight from the ramp tip back into the funnel (lands on the dish going along the tangent)
export const LAUNCH = trackAt(TRACK_LEN).p;
// the dish radius whose resting ball centre lies in the ramp's plane (the normal leans the centre inwards)
const R_LAND = (() => {
  let r = Z_J - FUNNEL.cz;
  for (let k = 0; k < 8; k++) r += Z_J - FUNNEL.cz - (onDish(r, Math.PI / 2)[2] - FUNNEL.cz);
  return r;
})();
export const LAND = onDish(R_LAND, Math.PI / 2);
const DX = LAND[0] - LAUNCH[0];
const DY = LAND[1] - LAUNCH[1];
export const T_FLIGHT = Math.sqrt((2 * (Math.tan(J_END) * DX - DY)) / G);
const VX = DX / T_FLIGHT, VY = Math.tan(J_END) * VX;
export const flightAt = (s: number): V3 => [LAUNCH[0] + VX * s, LAUNCH[1] + VY * s - (G * s * s) / 2, Z_J];
export const FLIGHT_V = { vx: VX, vy: VY, speed: Math.hypot(VX, VY) };

// ─── the loop (starts and ends at the landing in the dish) ───────────────────────────────────────────────────────
// dish: lands at R_LAND going along the tangent (angle grows), small bounces, friction takes the landing speed down,
// then it spirals in and speeds up as the radius shrinks (a gravity well), until its centre is over the hole.
// fall: through the throat to the top of the rails. track: gravity pulls it down the drop, round the bend, along
// the sweep and up the ramp (a hidden boost keeps the illusion: it leaves the ramp fast enough to reach the funnel).
// flight: the arc above, back to the landing. 60 fps, a whole number of frames.
export const FPS = 60;
export const FRAMES = 420; // 7.0 s
export const DURATION = FRAMES / FPS;
const R0 = R_LAND, R_END = FUNNEL.hole - 0.015;
const DISH_BOUNCES = [0.07, 0.02, 0.006];
const Y_DISH_END = onDish(R_END, 0)[1];
export const T_FALL = Math.sqrt((2 * (Y_DISH_END - Y_TOP)) / G);
const V_TOP = G * T_FALL;
const V_LAUNCH = FLIGHT_V.speed;
const G_TRACK = (V_LAUNCH ** 2 - V_TOP ** 2) / (2 * (Y_TOP - LAUNCH[1]));
const trackV = (s: number) => Math.sqrt(Math.max(0.01, V_TOP ** 2 + 2 * G_TRACK * (Y_TOP - trackAt(s).p[1])));
// time → arc length on the track (integrated once)
const TRACK_T: number[] = [0];
const TRACK_S: number[] = [0];
(() => {
  let s = 0, t = 0;
  const dt = 1 / 2400;
  while (s < TRACK_LEN) {
    s += trackV(s) * dt;
    t += dt;
    TRACK_T.push(t);
    TRACK_S.push(Math.min(s, TRACK_LEN));
  }
})();
export const T_TRACK = TRACK_T[TRACK_T.length - 1];
export const T_DISH = DURATION - T_FALL - T_TRACK - T_FLIGHT;
// dish radius over the spiral: stays out at first, then winds in faster and faster
const dishR = (x: number) => R_END + (R0 - R_END) * (1 - x ** 2.4);
// tangential speed: the landing speed bleeds off, then the gravity well speeds the ball up as r shrinks
const V_LAND_T = Math.abs(FLIGHT_V.vx) * 0.62;
const dishV = (t: number, r: number) => (1.55 + (V_LAND_T - 1.55) * Math.exp(-t / 0.5)) * (R0 / r) ** 0.75;
const DISH_TH: number[] = [];
(() => {
  let th = Math.PI / 2;
  const n = 4000;
  for (let k = 0; k <= n; k++) {
    DISH_TH.push(th);
    const t = (k / n) * T_DISH, r = dishR(k / n);
    th += (dishV(t, r) / r) * (T_DISH / n);
  }
})();
export const DISH_LAPS = (DISH_TH[DISH_TH.length - 1] - DISH_TH[0]) / (2 * Math.PI);
const bounce = (s: number) => {
  for (const h of DISH_BOUNCES) {
    const T = 2 * Math.sqrt((2 * h) / G);
    if (s < T) return Math.sqrt(2 * G * h) * s - (G * s * s) / 2;
    s -= T;
  }
  return 0;
};
export const T_HOLE = T_DISH;
export const T_RAILS = T_DISH + T_FALL;
export const T_LAUNCH = T_RAILS + T_TRACK;

export type Phase = "dish" | "fall" | "track" | "air";
export type Pose = { p: V3; phase: Phase; n?: V3; s?: number };
const lookup = (xs: number[], ys: number[], x: number) => {
  let lo = 0, hi = xs.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (xs[m] <= x) lo = m;
    else hi = m;
  }
  const k = (x - xs[lo]) / (xs[hi] - xs[lo] || 1);
  return ys[lo] + (ys[hi] - ys[lo]) * Math.min(1, Math.max(0, k));
};
export const dishAngle = (t: number) => {
  const f = (Math.min(Math.max(t, 0), T_DISH) / T_DISH) * (DISH_TH.length - 1), i = Math.floor(f), k = f - i;
  return DISH_TH[Math.min(i, DISH_TH.length - 1)] * (1 - k) + DISH_TH[Math.min(i + 1, DISH_TH.length - 1)] * k;
};
export const trackS = (t: number) => lookup(TRACK_T, TRACK_S, t);

export function ballAt(t: number): Pose {
  t = ((t % DURATION) + DURATION) % DURATION;
  if (t < T_DISH) {
    const r = dishR(t / T_DISH), a = dishAngle(t), p = onDish(r, a);
    const k = surfSlope(r), m = Math.hypot(1, k);
    return { p: [p[0], p[1] + bounce(t), p[2]], phase: "dish", n: [(-k / m) * Math.cos(a), 1 / m, (-k / m) * Math.sin(a)] };
  }
  if (t < T_RAILS) {
    // over the hole → down the throat: slides to the axis while it falls
    const s = t - T_DISH, a = dishAngle(T_DISH), u = s / T_FALL;
    const r = R_END * (1 - u * u * (3 - 2 * u));
    const y = Y_DISH_END - (G * s * s) / 2;
    return { p: [FUNNEL.cx + Math.cos(a) * r, y, FUNNEL.cz + Math.sin(a) * r], phase: "fall" };
  }
  if (t < T_LAUNCH) {
    const s = trackS(t - T_RAILS), m = trackAt(s);
    return { p: m.p, phase: "track", n: m.n, s };
  }
  return { p: flightAt(t - T_LAUNCH), phase: "air" };
}

// ─── note-lights: on as the ball passes; at the landing they go out one by one from the ramp back to the bend
export const LIGHT_ON = Array.from({ length: LIGHTS }, (_, i) => T_RAILS + lookup(TRACK_S, TRACK_T, lightS(i)));
const OFF_START = 0.55, OFF_SPREAD = 1.1, FADE = 0.35;
export const LIGHT_OFF = Array.from({ length: LIGHTS }, (_, i) => OFF_START + (1 - (i + 0.5) / LIGHTS) * OFF_SPREAD);
/** on 0..1 and the fresh flash; the loop starts lit (the ball has just come round) */
export const lightState = (i: number, t: number) => {
  t = ((t % DURATION) + DURATION) % DURATION;
  const sm = (a: number, b: number, x: number) => {
    const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return k * k * (3 - 2 * k);
  };
  if (t >= LIGHT_ON[i]) return { on: 1, flash: Math.exp(-(t - LIGHT_ON[i]) / 0.3) };
  const since = t + DURATION - LIGHT_ON[i]; // time since it lit in the previous loop
  return { on: 1 - sm(LIGHT_OFF[i], LIGHT_OFF[i] + FADE, t), flash: Math.exp(-since / 0.3) };
};

export const EVENTS = {
  land: 0,
  dishBounces: DISH_BOUNCES.map((_, k) => DISH_BOUNCES.slice(0, k + 1).reduce((a, h) => a + 2 * Math.sqrt((2 * h) / G), 0)).slice(0, -1),
  dishRoll: [0.25, T_DISH] as [number, number],
  hole: T_DISH,
  rails: T_RAILS,
  trackRoll: [T_RAILS, T_LAUNCH] as [number, number],
  launch: T_LAUNCH,
  lightsOn: LIGHT_ON,
  lightsOff: LIGHT_OFF,
};
