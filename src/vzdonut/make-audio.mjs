// ASMR soundtrack of the donut loop, synthesised from motion.ts (no samples, nothing to license, no music).
// - rolling: wood-grain excitation (filtered noise + micro clicks, rate ∝ speed) driving the modes of the hollow
//   plywood ramp the ball is on (left ramp smaller → higher modes), loudness ∝ speed and contact force; a crisp
//   close-mic contact hiss on top; silence while the ball flies
// - a tick on the far corner of the gap at every crossing, a soft scrub when the ball comes back onto a lip
// - an airy swish as the ball threads the donut
// - stereo follows the ball (left ramp left, right ramp right), small wooden room, faint room tone
// One period, seamless (rendered over three periods, the middle one kept), then loudness-normalised by ffmpeg.
// Usage (project root): node --no-warnings src/vzdonut/make-audio.mjs → public/vzdonut/donut.wav
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { BALL_R, EVENTS, FPS, FRAMES, G, GAP_H, LEFT, LOOP_PERIODS, PERIOD, RIGHT, T_SCALE, ballAt } from "./motion.ts";

const SR = 48000, D = FRAMES / FPS, N = Math.round(D * SR), N3 = 3 * N, TAU = Math.PI * 2;
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
// motion time of output sample i (the middle period is i ∈ [N, 2N))
const tOf = (i) => (((i / SR - D) * T_SCALE) % PERIOD + PERIOD) % PERIOD;

// ─── per-sample ball state: speed, contact force (N/mg), side, pan
const VMAX = Math.sqrt((10 / 7) * G * 3);
const state = (t) => {
  const b = ballAt(t), [x, y] = b.p, v = Math.hypot(b.v[0], b.v[1]);
  let force = 0, side = x < 0 ? 0 : 1;
  if (b.phase === "track") {
    if (Math.abs(x) < GAP_H) force = 0.15; // over the gap: barely touching the edges
    else if (x < -LEFT.flat) {
      const rho = LEFT.R - BALL_R, cosA = Math.max(0, (LEFT.R - y) / rho);
      force = cosA + (v * v) / (rho * G);
    } else if (x > RIGHT.flat) {
      const rho = RIGHT.R - BALL_R, cosA = Math.max(0, (RIGHT.R - y) / rho);
      force = cosA + (v * v) / (rho * G);
    } else force = 1;
  }
  return { v, force, side, pan: Math.max(-1, Math.min(1, x / 1.5)) * 0.75 };
};

// ─── modal banks of the two hollow plywood ramps (freq Hz, decay s, weight)
const BANKS = [
  [[150, 0.16, 0.7], [262, 0.12, 1], [415, 0.1, 0.8], [596, 0.08, 0.6], [838, 0.06, 0.45], [1190, 0.045, 0.35], [1710, 0.035, 0.25], [2520, 0.025, 0.18]], // left (smaller)
  [[118, 0.18, 0.8], [196, 0.14, 1], [305, 0.11, 0.85], [452, 0.09, 0.65], [645, 0.07, 0.5], [925, 0.05, 0.38], [1360, 0.04, 0.27], [2060, 0.03, 0.2]], // right (bigger)
].map((modes) => modes.map(([f, tau, w]) => {
  // two-pole resonator with zeros at DC and Nyquist (a true band-pass): peak gain ≈ w
  const r = Math.exp(-1 / (tau * SR)), c = 2 * r * Math.cos((TAU * f) / SR);
  return { r2: r * r, c, w: w * (1 - r * r) * 0.5 * 3, y1: 0, y2: 0 };
}));
const ring = (bank, x, x2) => {
  let out = 0;
  for (const m of bank) {
    const y = m.w * (x - x2) + m.c * m.y1 - m.r2 * m.y2;
    m.y2 = m.y1;
    m.y1 = y;
    out += y;
  }
  return out;
};

// impulses (gap ticks, lip scrubs) fed into the banks, plus direct clicks
const exc = [new Float32Array(N3), new Float32Array(N3)];
const direct = new Float32Array(N3);
const swish = new Float32Array(N3);
// events of one ball period, repeated over the three rendered loops (motion time τ ↔ output time τ/T_SCALE + D)
const addEv = (list, fn) => {
  for (let k = -LOOP_PERIODS; k < 2 * LOOP_PERIODS; k++) for (const e of list) fn(Math.round(((e.t + k * PERIOD) / T_SCALE + D) * SR), e);
};
addEv(EVENTS.gapTicks, (i0, e) => {
  const side = e.dir > 0 ? 1 : 0;
  for (let j = 0; j < 0.004 * SR && i0 + j < N3; j++) {
    const env = Math.exp(-j / (0.0006 * SR));
    exc[side][i0 + j] += 0.55 * env * (j < 3 ? 1 : rnd() * 0.5);
    direct[i0 + j] += 0.16 * env * rnd();
  }
});
addEv(EVENTS.lipsOn, (i0, e) => {
  const side = e.side === "L" ? 0 : 1;
  for (let j = 0; j < 0.05 * SR && i0 + j < N3; j++) {
    const env = Math.min(1, j / (0.004 * SR)) * Math.exp(-j / (0.012 * SR));
    exc[side][i0 + j] += 0.05 * env * rnd();
  }
});
// the swish: band-passed noise sweeping down as the ball passes through the ring
addEv(EVENTS.passes, (i0) => {
  let lp = 0, bp = 0;
  const L = Math.round(0.22 * SR), start = i0 - Math.round(0.08 * SR);
  for (let j = 0; j < L; j++) {
    const u = j / L, f = 2600 - 1700 * u, a = Math.min(1, (TAU * f) / SR);
    const n = rnd();
    lp += a * (n - lp);
    bp += a * (lp - bp);
    const env = Math.sin(Math.PI * u) ** 2.2;
    if (start + j >= 0 && start + j < N3) swish[start + j] += (lp - bp) * env * 0.5;
  }
});

// ─── render three periods
const L = new Float32Array(N3), R = new Float32Array(N3);
let g1 = 0, g2 = 0, hiss = 0, hissLp = 0, clickPhase = 0, amp = 0, panS = 0;
let xl1 = 0, xl2 = 0, xr1 = 0, xr2 = 0, grainHp = 0, hissTop = 0;
for (let i = 0; i < N3; i++) {
  const s = state(tOf(i));
  const target = s.force > 0 ? Math.min(1, s.v / VMAX) ** 1.1 * Math.sqrt(Math.min(2.5, s.force)) : 0;
  amp += (target - amp) * (target > amp ? 0.02 : 0.004); // fast-ish attack, soft release (≈ 5 ms)
  panS += (s.pan - panS) * 0.0008;
  // wood grain: low-passed noise (brighter when faster) + micro clicks at a rate ∝ speed
  const cut = Math.min(0.5, (TAU * (250 + 700 * s.v)) / SR);
  const n = rnd();
  g1 += cut * (n - g1);
  g2 += cut * (g1 - g2);
  clickPhase += (s.v * 55) / SR;
  let click = 0;
  if (clickPhase >= 1) { clickPhase -= 1; click = rnd() * 0.9; }
  const e = (g2 * 1.4 + click) * amp;
  // contact hiss (close mic): high-passed noise
  hissLp += 0.35 * (n - hissLp);
  hissTop += 0.6 * (n - hissLp - hissTop); // keep it under ~7 kHz: soft, not fizzy
  hiss = hissTop * amp * 0.03;
  const inL = (s.side === 0 ? e : 0) + exc[0][i], inR = (s.side === 1 ? e : 0) + exc[1][i];
  const left = ring(BANKS[0], inL, xl2), right = ring(BANKS[1], inR, xr2);
  xl2 = xl1; xl1 = inL; xr2 = xr1; xr1 = inR;
  // a little of the raw grain too (the ball itself on the wood), high-passed so it adds texture, not rumble
  grainHp += 0.08 * (e - grainHp);
  const body = left + right + hiss + direct[i] + (e - grainHp) * 0.14;
  // equal-power pan of the ball sounds; the swish is centred (the donut is at x = 0)
  const a = (panS + 1) * (Math.PI / 4);
  L[i] = body * Math.cos(a) * 1.41 + swish[i] * 0.09;
  R[i] = body * Math.sin(a) * 1.41 + swish[i] * 0.09;
}

// ─── small wooden room (Schroeder: 4 combs + 2 allpasses per channel, slightly different), faint room tone
const room = (x, offs) => {
  const out = new Float32Array(x.length);
  for (const [d, gain] of [[0.0297, 0.6], [0.0371, 0.58], [0.0411, 0.56], [0.0437, 0.54]]) {
    const k = Math.round((d + offs) * SR), c = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) c[i] = x[i] + (i >= k ? c[i - k] * gain : 0);
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
  pink += 0.02 * (rnd() - pink);
  const j = N + i; // middle period
  outL[i] = L[j] + 0.14 * wl[j] + pink * 0.004;
  outR[i] = R[j] + 0.14 * wr[j] + pink * 0.004;
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

// ─── loudness: measure over four loops, one gain for all, gentle limiter; target −15 LUFS (ASMR: soft but clear)
const TARGET = -15;
const run = (args) => spawnSync("ffmpeg", args, { encoding: "utf8" });
const HP = "highpass=f=55:poles=2";
const m1 = run(["-hide_banner", "-nostats", "-stream_loop", "3", "-i", "public/vzdonut/donut-raw.wav", "-af", `${HP},ebur128=peak=true`, "-f", "null", "-"]).stderr;
const I = Number(/I:\s+(-?[\d.]+) LUFS/.exec(m1.slice(m1.lastIndexOf("Summary")))?.[1]);
const gainDb = TARGET - I;
run(["-hide_banner", "-y", "-i", "public/vzdonut/donut-raw.wav", "-af", `${HP},volume=${gainDb.toFixed(2)}dB,alimiter=limit=0.84:attack=1:release=40:level=false`, "-c:a", "pcm_s16le", "public/vzdonut/donut.wav"]);
const m2 = run(["-hide_banner", "-nostats", "-stream_loop", "3", "-i", "public/vzdonut/donut.wav", "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr;
const sum = m2.slice(m2.lastIndexOf("Summary"));
console.log(`raw ${I} LUFS → gain ${gainDb.toFixed(1)} dB → public/vzdonut/donut.wav (${D.toFixed(3)} s)`);
console.log(sum.replace(/\s+/g, " ").trim());
