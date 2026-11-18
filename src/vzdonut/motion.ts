// Gold ball in a wooden half-pipe (reference-style, back and forth) — pure physics, shared with make-audio.mjs.
// Two bent-plywood ramps on hollow box bases, a narrow gap between them at x = 0; a glossy donut hangs on two wires
// and swings sideways (z) through that gap. The ball rolls without slipping (v² = 10/7·g·Δh), leaves each ramp at the
// top of its curve going straight up (vertical lip), falls back, and threads the donut hole every time it crosses x = 0.
// The donut is a physical pendulum whose period equals the ball's period, so it is centred at every pass.
// Units: 1 ≈ 1 dm. Ball path = path of the ball's centre (z = 0).

export const FPS = 60;
export const G = 7; // gentle slow motion
export const BALL_R = 0.14;
export const GAP_H = 0.15; // half width of the gap between the two ramps (gap 0.30 ≈ ball diameter + a hair)
export const PLATE_T = 0.05; // plywood thickness
export const BOX_H = 0.5; // ramp base height (track surface at y = 0, board top at y = −BOX_H)
export const WIDTH = 1.0; // ramp width (z)
export const RIGHT = { R: 1.05, flat: 0.4, lip: 0.16 }; // surface radius, flat length from x = 0, plate above the curve
export const LEFT_R = 0.72;
export const LEFT_LIP = 0.12;
export const APEX_RIGHT = 0.9; // the ball rises this far above the top of the right curve
const K = 10 / 7; // rolling solid sphere

// energy height of the ball's centre (where a rolling ball would stop)
const yTopR = RIGHT.R;
export const H_E = yTopR + (2 * G * APEX_RIGHT) / (K * G);
const speed = (y: number) => Math.sqrt(Math.max(0, K * G * (H_E - y)));
export const V_BOTTOM = speed(BALL_R);

// time spent on one side of x = 0 (out and back, including the flight above the lip)
const sideTime = (R: number, flat: number) => {
  const rho = R - BALL_R;
  const n = 4000;
  let tc = 0;
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * (Math.PI / 2);
    tc += (rho * (Math.PI / 2)) / n / speed(R - rho * Math.cos(a));
  }
  return 2 * (flat / V_BOTTOM + tc) + (2 * speed(R)) / G;
};
// the left ramp is lower (more air above it), so its flat is longer: both sides take the same time, the ball crosses
// x = 0 at equal intervals and a plain pendulum can be centred at every pass
const solveLeftFlat = () => {
  const target = sideTime(RIGHT.R, RIGHT.flat);
  let lo = 0.2, hi = 3;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (sideTime(LEFT_R, mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};
export const LEFT = { R: LEFT_R, flat: solveLeftFlat(), lip: LEFT_LIP };

// ─── track (ball centre) as arc length s: left curve top (s = 0) → flat → right curve top (s = S)
const rhoL = LEFT.R - BALL_R, rhoR = RIGHT.R - BALL_R;
const L1 = (rhoL * Math.PI) / 2, F = LEFT.flat + RIGHT.flat, L2 = (rhoR * Math.PI) / 2;
export const S_END = L1 + F + L2;
const track = (s: number): [number, number, number] => {
  // returns x, y, curvature sign info: a = angle along the curve (0 at the bottom)
  if (s <= L1) {
    const a = Math.PI / 2 - s / rhoL;
    return [-LEFT.flat - rhoL * Math.sin(a), LEFT.R - rhoL * Math.cos(a), a];
  }
  if (s <= L1 + F) return [-LEFT.flat + (s - L1), BALL_R, 0];
  const a = (s - L1 - F) / rhoR;
  return [RIGHT.flat + rhoR * Math.sin(a), RIGHT.R - rhoR * Math.cos(a), a];
};
export const LIP_X = { left: -LEFT.flat - rhoL, right: RIGHT.flat + rhoR }; // ball centre x on the vertical lips
const vTopL = speed(LEFT.R), vTopR = speed(RIGHT.R);
export const APEX = { left: LEFT.R + (vTopL * vTopL) / (2 * G), right: RIGHT.R + (vTopR * vTopR) / (2 * G) };

// tiny dip over the gap: the ball flies across (its centre falls g·t²/2) and rolls back up over the far corner
const gapDip = (x: number, dir: number) => {
  const u = dir > 0 ? x + GAP_H : GAP_H - x; // distance travelled since the near edge
  if (u <= 0 || u >= 2 * GAP_H) return 0;
  const fall = (G * u * u) / (2 * V_BOTTOM * V_BOTTOM);
  const w = 2 * GAP_H - u; // distance still to the far corner
  const corner = BALL_R - Math.sqrt(Math.max(0, BALL_R * BALL_R - w * w)); // resting on the far corner
  return Math.min(fall, corner);
};

// ─── one period, sampled: starts with the ball at its apex above the left lip, falling
export type Phase = "airL" | "track" | "airR";
type Sample = { x: number; y: number; vx: number; vy: number; phase: Phase };
const SR = 2400; // samples per second
const samples: Sample[] = [];
export const EVENTS = {
  passes: [] as { t: number; dir: number }[], // ball centre crosses x = 0 (through the donut)
  gapTicks: [] as { t: number; dir: number }[], // far corner of the gap
  lipsOff: [] as { t: number; side: "L" | "R" }[],
  lipsOn: [] as { t: number; side: "L" | "R" }[],
};
let DUR = 0;
{
  const dt = 1e-5;
  let t = 0, nextSample = 0;
  const push = (x: number, y: number, vx: number, vy: number, phase: Phase) => {
    while (nextSample <= t + 1e-12) {
      samples.push({ x, y, vx, vy, phase });
      nextSample += 1 / SR;
    }
  };
  // 1) fall from the left apex to the lip
  const tFallL = vTopL / G;
  for (; t < tFallL; t += dt) {
    const tt = t;
    push(LIP_X.left, APEX.left - 0.5 * G * tt * tt, 0, -G * tt, "airL");
  }
  EVENTS.lipsOn.push({ t: tFallL, side: "L" });
  t = tFallL;
  // 2) roll: left → right, flight on the right, right → left
  let s = 0, dir = 1, lastX = track(0)[0], phaseDone = false;
  while (!phaseDone) {
    const [x, y0] = track(s);
    const y = y0 - (Math.abs(x) < GAP_H ? gapDip(x, dir) : 0);
    const v = speed(y0);
    const [xn, yn] = track(Math.min(S_END, Math.max(0, s + dir * v * 1e-4)));
    const len = Math.hypot(xn - x, yn - y0) || 1;
    push(x, y, (dir * v * (xn - x)) / len, (dir * v * (yn - y0)) / len, "track");
    if ((lastX < 0 && x >= 0) || (lastX > 0 && x <= 0)) EVENTS.passes.push({ t, dir });
    const far = dir > 0 ? GAP_H - 0.065 : -GAP_H + 0.065;
    if ((dir > 0 && lastX < far && x >= far) || (dir < 0 && lastX > far && x <= far)) EVENTS.gapTicks.push({ t, dir });
    lastX = x;
    s += dir * v * dt;
    t += dt;
    if (s >= S_END) {
      // straight up from the right lip and back
      EVENTS.lipsOff.push({ t, side: "R" });
      const t0 = t, tf = (2 * vTopR) / G;
      for (; t < t0 + tf; t += dt) {
        const u = t - t0;
        push(LIP_X.right, RIGHT.R + vTopR * u - 0.5 * G * u * u, 0, vTopR - G * u, "airR");
      }
      t = t0 + tf;
      EVENTS.lipsOn.push({ t, side: "R" });
      s = S_END;
      dir = -1;
    } else if (s <= 0 && dir < 0) {
      EVENTS.lipsOff.push({ t, side: "L" });
      phaseDone = true;
    }
  }
  // 3) rise above the left lip back to the apex: the period closes
  const t0 = t;
  for (; t < t0 + tFallL; t += dt) {
    const u = t - t0;
    push(LIP_X.left, LEFT.R + vTopL * u - 0.5 * G * u * u, 0, vTopL - G * u, "airL");
  }
  DUR = t0 + tFallL;
}
/** one period of the ball's motion (s) */
export const PERIOD = DUR;
/** the rendered loop holds two ball periods (one donut sway period) */
export const LOOP_PERIODS = 2;
export const FRAMES = Math.round(LOOP_PERIODS * PERIOD * FPS);
/** time scale so the loop is an exact whole number of frames */
export const T_SCALE = (LOOP_PERIODS * PERIOD) / (FRAMES / FPS);

export const ballAt = (tIn: number) => {
  const t = ((tIn % PERIOD) + PERIOD) % PERIOD; // the ball repeats every PERIOD
  const f = t * SR, i = Math.min(samples.length - 2, Math.floor(f)), k = f - i;
  const a = samples[i], b = samples[i + 1];
  return {
    p: [a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, 0] as [number, number, number],
    v: [a.vx + (b.vx - a.vx) * k, a.vy + (b.vy - a.vy) * k, 0] as [number, number, number],
    phase: a.phase,
  };
};

// ─── the donut: a torus (hole along x) hung from the ceiling (far above the frame) on two wires that meet at an
// eyelet on its top; the anchors sit on a line along x, so it can only sway sideways (z). Physical pendulum:
// T = 2π·√((I/m + l²)/(g·l)), I about an axis parallel to the torus axis: I/m = R² + ¾·a². A long wire sways slowly:
// its period is two ball periods (so the loop closes), and the sway is small enough that the ball never touches it:
// at every pass the donut is 0.71·A off centre, the hole leaves 0.095 of room.
export const DONUT = { R: 0.36, a: 0.125 };
export const DONUT_Y = BALL_R; // hole centre = ball centre height on the flat
const kk = DONUT.R * DONUT.R + 0.75 * DONUT.a * DONUT.a;
const T_SWAY = LOOP_PERIODS * PERIOD;
const Gp = (G * T_SWAY * T_SWAY) / (4 * Math.PI * Math.PI);
export const PEND_L = (Gp + Math.sqrt(Gp * Gp - 4 * kk)) / 2; // ceiling pivot → donut centre
export const PIVOT_Y = DONUT_Y + PEND_L;
export const SWING_A = 0.07; // sideways amplitude of the donut centre
const theta0 = Math.asin(SWING_A / PEND_L);
const tPass0 = EVENTS.passes[0]?.t ?? 0;
/** sway angle (rad, about the x axis through the ceiling pivot); every pass at a quarter-phase (|offset| = 0.71·A) */
export const donutAngle = (tIn: number) => theta0 * Math.sin((2 * Math.PI * (tIn - tPass0)) / T_SWAY + Math.PI / 4);

// summary for the console (node --no-warnings src/vzdonut/motion.ts)
export const SUMMARY = {
  period: +PERIOD.toFixed(3),
  frames: FRAMES,
  leftFlat: +LEFT.flat.toFixed(3),
  vBottom: +V_BOTTOM.toFixed(2),
  apexL: +APEX.left.toFixed(2),
  apexR: +APEX.right.toFixed(2),
  pendL: +PEND_L.toFixed(3),
  pivotY: +PIVOT_Y.toFixed(2),
  passes: EVENTS.passes.map((e) => +e.t.toFixed(3)),
  lipsOff: EVENTS.lipsOff.map((e) => e.side + e.t.toFixed(3)),
  lipsOn: EVENTS.lipsOn.map((e) => e.side + e.t.toFixed(3)),
};
