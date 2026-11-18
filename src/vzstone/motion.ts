// Purple/yellow ball rolling round a ring of marble segments that rise and sink in turn (a travelling wave) — pure
// motion, shared with make-audio.mjs. The ring is N_SEG annular sectors around a hollow centre; each slides up and down
// through a slot in the pedestal. The segment under the ball is always at the top; the ones ahead rise to meet it
// just before the ball reaches them, the ones behind sink, the one opposite the ball is the lowest. A shallow groove
// is carved along the top, so the ball keeps to its circle; it rolls without slipping at a constant speed.
// Angles: a point at angle a is (r·sin a, y, r·cos a): a = 0 front (towards the camera), π/2 right, π back.
// The ball goes back → left → front → right (a increasing). Units: 1 ≈ 1 dm.

export const FPS = 60;
export const N_SEG = 8;
export const SEG = (2 * Math.PI) / N_SEG;
export const R_M = 1.0; // radius of the ball's path (groove centre)
export const K_SPIN = 4; // R_M / BALL_R: whole number → the ball's orientation is exactly the same after one lap
export const BALL_R = R_M / K_SPIN;
export const R_I = 0.78; // ring inner / outer radius
export const R_O = 1.22;
export const GROOVE = { r: 0.29, d: 0.035 }; // groove: circular cross-section (radius r > ball), depth d
export const GROOVE_HALF = Math.sqrt(2 * GROOVE.r * GROOVE.d - GROOVE.d * GROOVE.d); // half width at the top
export const H_TOP = 0.78; // top of a segment at its highest (pedestal top = 0)
export const H_LOW = 0.12; // and at its lowest
export const GAP = 0.008; // joint between segments (at R_M)
export const BALL_Y = H_TOP - GROOVE.d + BALL_R; // ball centre height (resting on the groove bottom)

export const LAP = 6.4; // seconds per lap = one loop
export const FRAMES = Math.round(LAP * FPS); // 384
export const SPEED = (2 * Math.PI * R_M) / LAP; // ≈ 0.98 dm/s ≈ 10 cm/s

// how far a segment's top stays up around the ball: its own half width plus a small margin, so it is already at the
// top (and still) just before the ball's contact point reaches its edge
const MARGIN = (4 * Math.PI) / 180;
const PLATEAU = SEG / 2 + MARGIN;

const wrapPi = (x: number) => {
  const y = ((x + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  return y - Math.PI;
};
const wrapT = (t: number) => ((t % LAP) + LAP) % LAP;

/** ball angle (lathe convention) at time t: starts at the back, centred on segment 4 */
export const ballAngle = (t: number) => Math.PI + (2 * Math.PI * wrapT(t)) / LAP;
/** centre angle of segment i */
export const segCentre = (i: number) => i * SEG;

/** height of a segment's top as a function of its angular distance from the ball */
export const heightAt = (delta: number) => {
  const x = Math.abs(wrapPi(delta));
  if (x <= PLATEAU) return H_TOP;
  const u = (x - PLATEAU) / (Math.PI - PLATEAU);
  const e = (1 - Math.cos(Math.PI * u)) / 2; // eased: still at the top and at the bottom
  return H_TOP - (H_TOP - H_LOW) * e;
};
export const segHeight = (i: number, t: number) => heightAt(segCentre(i) - ballAngle(t));
/** vertical speed of segment i (units/s) — used by the sound */
export const segSpeed = (i: number, t: number) => (segHeight(i, t + 1e-3) - segHeight(i, t - 1e-3)) / 2e-3;

/** ball centre, velocity, the segment it rolls on and the angle past that segment's centre */
export const ballAt = (t: number) => {
  const a = ballAngle(t);
  const p: [number, number, number] = [R_M * Math.sin(a), BALL_Y, R_M * Math.cos(a)];
  const w = (2 * Math.PI) / LAP;
  const v: [number, number, number] = [R_M * w * Math.cos(a), 0, -R_M * w * Math.sin(a)];
  const seg = ((Math.round(a / SEG) % N_SEG) + N_SEG) % N_SEG;
  return { a, p, v, seg, off: wrapPi(a - segCentre(seg)) };
};

/** ball orientation as Euler-free parts: yaw a (faces the centre, like a ball in a circular groove), then roll about
 * the radial axis by −K·a. Combined in the scene as Ry(a)·Rz(−K·a)·Q_BASE. */
export const ballRoll = (t: number) => {
  const a = ballAngle(t);
  return { yaw: a, roll: -K_SPIN * a };
};

/** times (0 ≤ t < LAP) when the ball's contact point crosses a joint, with the segment it rolls onto */
export const SEAMS = (() => {
  const out: { t: number; to: number }[] = [];
  for (let k = 0; k < N_SEG; k++) {
    const seamA = SEG / 2 + k * SEG; // between segment k and k+1
    const t = wrapT(((seamA - Math.PI) / (2 * Math.PI)) * LAP);
    out.push({ t, to: (k + 1) % N_SEG });
  }
  return out.sort((x, y) => x.t - y.t);
})();

// checks: the segment under the contact point is at the top; the next one is at the top (and still) when it arrives
export const SUMMARY = (() => {
  let worstUnder = 0, worstNext = 0;
  for (let t = 0; t < LAP; t += 1e-3) {
    const b = ballAt(t);
    worstUnder = Math.max(worstUnder, H_TOP - segHeight(b.seg, t));
    const ahead = (b.seg + 1) % N_SEG;
    if (b.off > SEG / 2 - 1e-3) worstNext = Math.max(worstNext, H_TOP - segHeight(ahead, t));
  }
  return {
    frames: FRAMES,
    speed: +SPEED.toFixed(3),
    ballR: BALL_R,
    spinRevPerLap: K_SPIN,
    grooveHalf: +GROOVE_HALF.toFixed(3),
    ballClearsFlats: +(BALL_Y - Math.sqrt(BALL_R * BALL_R - GROOVE_HALF * GROOVE_HALF) - H_TOP).toFixed(4),
    worstUnder: +worstUnder.toFixed(5),
    worstNext: +worstNext.toFixed(5),
    seams: SEAMS.map((s) => +s.t.toFixed(3)),
  };
})();
