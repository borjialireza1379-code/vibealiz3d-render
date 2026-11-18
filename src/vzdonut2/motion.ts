// Gold ball looping one way through a wooden "wave" half-pipe, threading a hanging donut in mid-air — pure physics,
// shared with make-audio.mjs. One bent-plywood plate: a flat bottom and two curls that bend past vertical by PHI.
// The ball rolls without slipping (v² = 10/7·g·Δh) left → right along the bottom, up the right curl, leaves its tip
// moving up-left, flies a parabola over the middle (its apex, where it moves level, is the centre of the donut's
// hole) and lands tangentially on the left curl's tip — mirror-symmetric, so the landing speed and direction match
// the curl exactly, and the ball's spin (always clockwise as seen from the front) matches rolling again: no slip,
// nothing lost, an endless loop. The donut hangs from the ceiling on two long wires and sways a little, slowly.
// Units: 1 ≈ 1 dm. Ball path = path of the ball's centre (z = 0).

export const FPS = 60;
export const G = 5;
export const BALL_R = 0.14;
export const PLATE_T = 0.05;
export const BOX_H = 0.5;
export const WIDTH = 1.0;
export const FLAT = 0.35; // half length of the flat bottom
export const RS = 0.95; // surface radius of each curl (centre at (±FLAT, RS))
export const PHI = (40 * Math.PI) / 180; // how far each curl bends past vertical
const K = 10 / 7;
const rho = RS - BALL_R;

// launch point (ball centre) at the right tip and the speed that carries the ball exactly onto the mirrored tip
export const P = { x: FLAT + rho * Math.cos(PHI), y: RS + rho * Math.sin(PHI) };
const vE = Math.sqrt((G * P.x) / (Math.sin(PHI) * Math.cos(PHI)));
export const V_LAUNCH = vE;
export const H_E = P.y + (vE * vE) / (K * G); // rolling energy height
const speed = (y: number) => Math.sqrt(Math.max(0, K * G * (H_E - y)));
export const V_BOTTOM = speed(BALL_R);
export const APEX_Y = P.y + (vE * Math.cos(PHI)) ** 2 / (2 * G);
export const T_FLIGHT = (2 * vE * Math.cos(PHI)) / G;

// ─── ground track as arc length s: left tip (s = 0) → left curl → flat → right curl → right tip (s = S_END)
const ARC = rho * (Math.PI / 2 + PHI);
const S1 = ARC, S2 = ARC + 2 * FLAT, S_END = 2 * ARC + 2 * FLAT;
const track = (s: number): [number, number] => {
  if (s <= S1) {
    const th = PHI - s / rho; // from PHI at the tip down to −90° at the bottom
    return [-FLAT - rho * Math.cos(th), RS + rho * Math.sin(th)];
  }
  if (s <= S2) return [-FLAT + (s - S1), BALL_R];
  const th = -Math.PI / 2 + (s - S2) / rho;
  return [FLAT + rho * Math.cos(th), RS + rho * Math.sin(th)];
};

// ─── one lap, sampled; t = 0 a little before the apex (the ball is about to thread the donut)
export type Phase = "air" | "track";
type Sample = { x: number; y: number; vx: number; vy: number; phase: Phase };
const SR = 2400;
const lap: Sample[] = [];
const ev = { land: 0, launch: 0 };
{
  const dt = 1e-5;
  let t = 0, next = 0;
  const push = (x: number, y: number, vx: number, vy: number, phase: Phase) => {
    while (next <= t + 1e-12) {
      lap.push({ x, y, vx, vy, phase });
      next += 1 / SR;
    }
  };
  // track: from landing on the left tip to launch from the right tip
  let s = 0;
  while (s < S_END) {
    const [x, y] = track(s);
    const v = speed(y);
    const [xn, yn] = track(Math.min(S_END, s + v * 1e-4));
    const len = Math.hypot(xn - x, yn - y) || 1;
    push(x, y, (v * (xn - x)) / len, (v * (yn - y)) / len, "track");
    s += v * dt;
    t += dt;
  }
  ev.launch = t;
  const t0 = t;
  const vx = -vE * Math.sin(PHI), vy0 = vE * Math.cos(PHI);
  for (; t < t0 + T_FLIGHT; t += dt) {
    const u = t - t0;
    push(P.x + vx * u, P.y + vy0 * u - 0.5 * G * u * u, vx, vy0 - G * u, "air");
  }
  t = t0 + T_FLIGHT;
  push(-P.x, P.y, vx, -vy0, "air");
  ev.land = t; // = lap length (landing again on the left tip)
}
export const LAP = ev.land;
const T_APEX_IN_LAP = ev.launch + T_FLIGHT / 2;
const T0 = T_APEX_IN_LAP - 0.6; // the loop starts 0.6 s before the ball reaches the donut (ball climbing the curl)
/** lap events in loop time (0 ≤ t < LAP) */
const wrap = (t: number) => ((t % LAP) + LAP) % LAP;
export const EVENTS = {
  pass: wrap(T_APEX_IN_LAP - T0), // through the donut
  land: wrap(0 - T0), // onto the left tip
  launch: wrap(ev.launch - T0), // off the right tip
};

export const LOOP_LAPS = 2; // one donut swing period
export const FRAMES = Math.round(LOOP_LAPS * LAP * FPS);
export const T_SCALE = (LOOP_LAPS * LAP) / (FRAMES / FPS);

export const ballAt = (tIn: number) => {
  const t = wrap(tIn + T0);
  const f = t * SR, i = Math.min(lap.length - 2, Math.floor(f)), k = f - i;
  const a = lap[i], b = lap[i + 1];
  return {
    p: [a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, 0] as [number, number, number],
    v: [a.vx + (b.vx - a.vx) * k, a.vy + (b.vy - a.vy) * k, 0] as [number, number, number],
    phase: a.phase,
  };
};

// ─── the donut: fat, its hole just bigger than the ball (0.025 of room), centred on the apex of the flight when it
// hangs straight. It hangs from the ceiling (just above the frame) on two wires meeting at an eyelet on its top; the
// anchors sit on a line along z, so it swings in the plane of the flight (x), wide, back and forth along the ball's
// path. Physical pendulum (axis ⊥ to the torus axis: I/m = R²/2 + 5a²/8) with a period of two laps: it passes the
// bottom once per lap, exactly when the ball reaches the apex — once swinging against the ball, once with it. At the
// bottom it moves along its own hole axis, so the ball threads it; the true clearance over the whole flight
// (ball sphere vs torus, both moving) is checked in SUMMARY.
export const DONUT = { R: 0.3, a: 0.135 };
export const DONUT_Y = APEX_Y;
const kk = (DONUT.R * DONUT.R) / 2 + (5 * DONUT.a * DONUT.a) / 8;
const T_SWING = 2 * LAP;
const Gp = (G * T_SWING * T_SWING) / (4 * Math.PI * Math.PI);
export const PEND_L = (Gp + Math.sqrt(Gp * Gp - 4 * kk)) / 2;
export const PIVOT_Y = DONUT_Y + PEND_L;
// amplitude of the swing angle: 15° → ±0.55 along the path; the pass where the donut swings along with the ball is
// the tight one (ball and donut miss by 0.011 — the "will it make it?" moment); 16° leaves 0.002, 17° touches
export const SWING_DEG = 15;
const theta0 = (SWING_DEG * Math.PI) / 180;
/** swing angle (rad, about the z axis through the ceiling pivot): zero (hanging straight) at every pass */
export const donutAngle = (t: number) => theta0 * Math.sin((2 * Math.PI * (t - EVENTS.pass)) / T_SWING);
/** donut centre (the pivot is at (0, PIVOT_Y, 0)) */
export const donutAt = (t: number) => {
  const th = donutAngle(t);
  return { x: PEND_L * Math.sin(th), y: PIVOT_Y - PEND_L * Math.cos(th), th };
};
// clearance between the ball and the donut over the whole loop: ball centre in the donut's frame, distance to the
// tube's centre circle minus tube and ball radius (negative = touching)
const clearance = (() => {
  let worst = 9, at = 0;
  for (let t = 0; t < LOOP_LAPS * LAP; t += 2e-4) {
    const b = ballAt(t).p, d = donutAt(t);
    const dx = b[0] - d.x, dy = b[1] - d.y, c = Math.cos(-d.th), s = Math.sin(-d.th);
    const lx = dx * c - dy * s, ly = dx * s + dy * c; // rotate into the donut frame (hole axis = local x)
    const rho = Math.abs(ly); // z = 0 for both
    const gap = Math.hypot(lx, rho - DONUT.R) - DONUT.a - BALL_R;
    if (gap < worst) { worst = gap; at = t; }
  }
  return { worst, at };
})();
// the donut must also clear the curls' tips (surface tip at (±(FLAT + RS·cos PHI), RS + RS·sin PHI))
const tipClear = (() => {
  let worst = 9;
  const tips = [-1, 1].map((sd) => [sd * (FLAT + (RS + PLATE_T) * Math.cos(PHI)), RS + (RS + PLATE_T) * Math.sin(PHI)]);
  for (let t = 0; t < T_SWING; t += 2e-3) {
    const d = donutAt(t), c = Math.cos(-d.th), s = Math.sin(-d.th);
    for (const [tx, ty] of tips) {
      const dx = tx - d.x, dy = ty - d.y, lx = dx * c - dy * s, ly = dx * s + dy * c;
      worst = Math.min(worst, Math.hypot(lx, Math.abs(ly) - DONUT.R) - DONUT.a);
    }
  }
  return worst;
})();

export const SUMMARY = {
  lap: +LAP.toFixed(3),
  frames: FRAMES,
  vLaunch: +vE.toFixed(2),
  vBottom: +V_BOTTOM.toFixed(2),
  tip: [+P.x.toFixed(3), +P.y.toFixed(3)],
  apexY: +APEX_Y.toFixed(3),
  flight: +T_FLIGHT.toFixed(3),
  pivotY: +PIVOT_Y.toFixed(2),
  pendL: +PEND_L.toFixed(3),
  swingX: +(PEND_L * Math.sin(theta0)).toFixed(3),
  ballClear: { worst: +clearance.worst.toFixed(4), at: +clearance.at.toFixed(3) },
  tipClear: +tipClear.toFixed(3),
  events: EVENTS,
  // on the curl just before launch the plate must still push: N/m = v²/ρ − g·sin(PHI) > 0
  gripAtTip: +((vE * vE) / rho - G * Math.sin(PHI)).toFixed(2),
};
