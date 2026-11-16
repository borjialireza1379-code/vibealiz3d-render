// Vibealiz3D "vortex funnel" marble machine (from the user's reference: ball spirals down a funnel, drops through
// the hole onto twin rails, sweeps along the base, a J-ramp throws it back up into the funnel). Pure math, no
// three.js, so a later audio script can import the same geometry and timeline.
// Units: 1 ≈ 1 dm. y is up. The funnel stands over the back (−x) end of the base, the J-ramp near the front (+x).
export type V3 = [number, number, number];

export const BALL_R = 0.125;
export const G = 40; // gentle slow motion (same as the first machine)

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
