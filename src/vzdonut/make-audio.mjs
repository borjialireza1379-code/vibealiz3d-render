// ASMR soundtrack of the donut loop, synthesised from motion.ts (no samples, nothing to license, no music).
// v2 (user: "too harsh, make it sound like a ball rolling on wood"): warm and soft.
// - rolling: the ball's contact acts as a low-pass (Hertz contact: softer/darker when slow), wood roughness as
//   low-passed noise with a few soft bumps; it drives a dense set of heavily damped wood modes plus the air of the
//   hollow box base (left ramp smaller → a little higher). Loudness ∝ speed and contact force; silence in the air.
// - a soft wooden "tok" on the far corner of the gap, a light touch when the ball comes back onto a lip
// - a low, airy swish as the ball threads the donut
// - stereo follows the ball, small wooden room, everything rolled off above ~3 kHz (nothing fizzy or sharp)
// One period, seamless (rendered over three periods, the middle one kept), then loudness-normalised by ffmpeg.
// Usage (project root): node --no-warnings src/vzdonut/make-audio.mjs → public/vzdonut/donut.wav
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { BALL_R, EVENTS, FPS, FRAMES, G, GAP_H, LEFT, LOOP_PERIODS, PERIOD, RIGHT, T_SCALE, ballAt } from "./motion.ts";

const SR = 48000, D = FRAMES / FPS, N = Math.round(D * SR), N3 = 3 * N, TAU = Math.PI * 2;
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
// motion time of output sample i (the middle loop is i ∈ [N, 2N))
const tOf = (i) => (((i / SR - D) * T_SCALE) % PERIOD + PERIOD) % PERIOD;

// ─── per-sample ball state: speed, contact force (N/mg), side, pan
const VMAX = Math.sqrt((10 / 7) * G * 3);
const state = (t) => {
  const b = ballAt(t), [x, y] = b.p, v = Math.hypot(b.v[0], b.v[1]);
  let force = 0;
  if (b.phase === "track") {
    if (Math.abs(x) < GAP_H) force = 0.1; // over the gap: barely touching the edges
    else if (x < -LEFT.flat) {
      const rho = LEFT.R - BALL_R, cosA = Math.max(0, (LEFT.R - y) / rho);
      force = cosA + (v * v) / (rho * G);
    } else if (x > RIGHT.flat) {
      const rho = RIGHT.R - BALL_R, cosA = Math.max(0, (RIGHT.R - y) / rho);
      force = cosA + (v * v) / (rho * G);
    } else force = 1;
  }
  return { v, force, side: x < 0 ? 0 : 1, pan: Math.max(-1, Math.min(1, x / 1.5)) * 0.7 };
};

// ─── wood: dense, heavily damped modes (loss factor η → decay τ = 1/(π·f·η)), warm roll-off, plus the box air
const bank = (f0, cavity) => {
  const modes = [[cavity, 0.05, 1.3]];
  let f = f0;
  for (let k = 0; k < 22; k++) {
    const tau = Math.min(0.08, 1 / (Math.PI * f * 0.045));
    modes.push([f, tau, 1 / (1 + (f / 380) ** 1.3)]);
    f *= 1.15 + 0.05 * Math.abs(rnd());
  }
  return modes.map(([fr, tau, w]) => {
    const r = Math.exp(-1 / (tau * SR)), c = 2 * r * Math.cos((TAU * fr) / SR);
    return { r2: r * r, c, w: w * (1 - r * r) * 0.5, y1: 0, y2: 0 }; // band-pass, zeros at DC and Nyquist
  });
};
const BANKS = [bank(165, 215), bank(128, 170)]; // left (smaller), right (bigger)
const ring = (b, x, x2) => {
  let out = 0;
  for (const m of b) {
    const y = m.w * (x - x2) + m.c * m.y1 - m.r2 * m.y2;
    m.y2 = m.y1;
    m.y1 = y;
    out += y;
  }
  return out;
};

// impulses into the wood (gap tok, lip touch) and the donut swish
const exc = [new Float32Array(N3), new Float32Array(N3)];
const swish = new Float32Array(N3);
// events of one ball period, repeated over the three rendered loops (motion time τ ↔ output time τ/T_SCALE + D)
const addEv = (list, fn) => {
  for (let k = -LOOP_PERIODS; k < 2 * LOOP_PERIODS; k++) for (const e of list) fn(Math.round(((e.t + k * PERIOD) / T_SCALE + D) * SR), e);
};
const pulse = (side, i0, width, level) => {
  // raised-cosine force pulse (a soft contact, not a click)
  const L = Math.round(width * SR);
  for (let j = 0; j < L; j++) if (i0 + j >= 0 && i0 + j < N3) exc[side][i0 + j] += level * 0.5 * (1 - Math.cos((TAU * j) / L));
};
addEv(EVENTS.gapTicks, (i0, e) => pulse(e.dir > 0 ? 1 : 0, i0, 0.0016, 2.2));
addEv(EVENTS.lipsOn, (i0, e) => pulse(e.side === "L" ? 0 : 1, i0, 0.004, 0.6));
addEv(EVENTS.passes, (i0) => {
  // low airy swish through the ring: band-passed noise sweeping 900 → 350 Hz
  let lp = 0, bp = 0;
  const L = Math.round(0.24 * SR), start = i0 - Math.round(0.1 * SR);
  for (let j = 0; j < L; j++) {
    const u = j / L, a = Math.min(1, (TAU * (900 - 550 * u)) / SR);
    lp += a * (rnd() - lp);
    bp += a * (lp - bp);
    if (start + j >= 0 && start + j < N3) swish[start + j] += (lp - bp) * Math.sin(Math.PI * u) ** 2.5;
  }
});

// ─── render three loops
const L = new Float32Array(N3), R = new Float32Array(N3);
let g1 = 0, g2 = 0, bump = 0, amp = 0, panS = 0, xl1 = 0, xl2 = 0, xr1 = 0, xr2 = 0, lpA = 0, lpB = 0;
const top = Math.min(1, (TAU * 2800) / SR); // master roll-off
for (let i = 0; i < N3; i++) {
  const s = state(tOf(i));
  const target = s.force > 0 ? Math.min(1, s.v / VMAX) ** 0.9 * Math.sqrt(Math.min(2.5, s.force)) : 0;
  amp += (target - amp) * (target > amp ? 0.006 : 0.003); // soft onset and release (≈ 4–7 ms)
  panS += (s.pan - panS) * 0.0008;
  // contact low-pass: darker when slow, a little brighter when fast (90 → ~1.1 kHz)
  const cut = Math.min(0.5, (TAU * (90 + 220 * s.v)) / SR);
  if ((rnd() + 1) / 2 < (s.v * 30) / SR) bump = 0.25 * (0.5 + Math.abs(rnd())); // soft grain bumps
  bump *= 0.995;
  g1 += cut * (rnd() + bump - g1);
  g2 += cut * (g1 - g2);
  const e = g2 * amp * 6;
  const inL = (s.side === 0 ? e : 0) + exc[0][i], inR = (s.side === 1 ? e : 0) + exc[1][i];
  const wood = ring(BANKS[0], inL, xl2) + ring(BANKS[1], inR, xr2) + g2 * amp * 0.6; // + a little direct contact
  xl2 = xl1; xl1 = inL; xr2 = xr1; xr1 = inR;
  lpA += top * (wood - lpA);
  lpB += top * (lpA - lpB);
  const a = (panS + 1) * (Math.PI / 4);
  L[i] = lpB * Math.cos(a) * 1.41 + swish[i] * 0.05;
  R[i] = lpB * Math.sin(a) * 1.41 + swish[i] * 0.05;
}

// ─── small wooden room (Schroeder: 4 combs + 2 allpasses, slightly different per side), dark and short
const room = (x, offs) => {
  const out = new Float32Array(x.length);
  for (const [d, gain] of [[0.0297, 0.55], [0.0371, 0.53], [0.0411, 0.51], [0.0437, 0.49]]) {
    const k = Math.round((d + offs) * SR), c = new Float32Array(x.length);
    let lp = 0;
    for (let i = 0; i < x.length; i++) {
      lp += 0.25 * ((i >= k ? c[i - k] : 0) - lp);
      c[i] = x[i] + lp * gain;
    }
    for (let i = 0; i < x.length; i++) out[i] += c[i] * 0.25;
  }
  for (const d of [0.005, 0.0017]) {
    const k = Math.round(d * SR), y = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) y[i] = -0.7 * out[i] + (i >= k ? out[i - k] + 0.7 * y[i - k] : 0);
    out.set(y);
  }
  return out;
};
const wl = room(L, 0), wr = room(R, 0.0023);
let pink = 0;
const outL = new Float32Array(N), outR = new Float32Array(N);
for (let i = 0; i < N; i++) {
  pink += 0.01 * (rnd() - pink);
  const j = N + i; // middle loop
  outL[i] = L[j] + 0.1 * wl[j] + pink * 0.003;
  outR[i] = R[j] + 0.1 * wr[j] + pink * 0.003;
}
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(outL[i]), Math.abs(outR[i]));
const g = 0.5 / peak;
const wav = (path, l, r) => {
  const n = l.length, buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, l[i] * g)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, r[i] * g)) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(path, buf);
};
fs.mkdirSync("public/vzdonut", { recursive: true });
wav("public/vzdonut/donut-raw.wav", outL, outR);

// ─── loudness: measure over four loops, one gain, gentle limiter; −16 LUFS (ASMR: soft)
const TARGET = -16;
const run = (args) => spawnSync("ffmpeg", args, { encoding: "utf8" });
const HP = "highpass=f=80:poles=2";
const m1 = run(["-hide_banner", "-nostats", "-stream_loop", "3", "-i", "public/vzdonut/donut-raw.wav", "-af", `${HP},ebur128=peak=true`, "-f", "null", "-"]).stderr;
const I = Number(/I:\s+(-?[\d.]+) LUFS/.exec(m1.slice(m1.lastIndexOf("Summary")))?.[1]);
const gainDb = TARGET - I;
run(["-hide_banner", "-y", "-i", "public/vzdonut/donut-raw.wav", "-af", `${HP},volume=${gainDb.toFixed(2)}dB,alimiter=limit=0.8:attack=2:release=60:level=false`, "-c:a", "pcm_s16le", "public/vzdonut/donut.wav"]);
const m2 = run(["-hide_banner", "-nostats", "-stream_loop", "3", "-i", "public/vzdonut/donut.wav", "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr;
const sum = m2.slice(m2.lastIndexOf("Summary"));
console.log(`raw ${I} LUFS → gain ${gainDb.toFixed(1)} dB → public/vzdonut/donut.wav (${D.toFixed(3)} s)`);
console.log(sum.replace(/\s+/g, " ").trim().slice(0, 260));
