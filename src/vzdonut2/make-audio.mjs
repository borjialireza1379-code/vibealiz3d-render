// ASMR soundtrack of the donut wave loop, synthesised from motion.ts (no samples, no music) — same warm recipe as
// src/vzdonut (v2): contact low-pass noise → dense damped wood modes + the air of the hollow box, loudness ∝ speed and
// contact force, everything rolled off above ~2.8 kHz. Silence in the air (the suspense), a soft touch when the ball
// lands on the left tip, a low swish when it threads the donut, and a faint air whoosh of the donut itself as it
// swings through the bottom. Stereo follows the ball. Seamless (three loops rendered, the middle one kept).
// Usage (project root): node --no-warnings src/vzdonut2/make-audio.mjs → public/vzdonut2/wave.wav
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { BALL_R, EVENTS, FLAT, FPS, FRAMES, G, LAP, LOOP_LAPS, RS, T_SCALE, ballAt, donutAt } from "./motion.ts";

const SR = 48000, D = FRAMES / FPS, N = Math.round(D * SR), N3 = 3 * N, TAU = Math.PI * 2;
let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const tOf = (i) => (i / SR - D) * T_SCALE; // motion time (ballAt wraps by itself)

// ─── per-sample ball state: speed, contact force (N/mg), pan
const rho = RS - BALL_R;
const VMAX = Math.sqrt((10 / 7) * G * 2.6);
const state = (t) => {
  const b = ballAt(t), [x, y] = b.p, v = Math.hypot(b.v[0], b.v[1]);
  let force = 0;
  if (b.phase === "track") {
    if (Math.abs(x) <= FLAT) force = 1;
    else force = Math.max(0, (v * v) / (rho * G) - (y - RS) / rho); // N/mg = v²/(ρg) − sin θ on the curls
  }
  return { v, force, pan: Math.max(-1, Math.min(1, x / 1.3)) * 0.7 };
};

// ─── the plate: dense, heavily damped wood modes + the box air
const bank = (f0, cavity) => {
  const modes = [[cavity, 0.05, 1.3]];
  let f = f0;
  for (let k = 0; k < 22; k++) {
    modes.push([f, Math.min(0.08, 1 / (Math.PI * f * 0.045)), 1 / (1 + (f / 380) ** 1.3)]);
    f *= 1.15 + 0.05 * Math.abs(rnd());
  }
  return modes.map(([fr, tau, w]) => {
    const r = Math.exp(-1 / (tau * SR)), c = 2 * r * Math.cos((TAU * fr) / SR);
    return { r2: r * r, c, w: w * (1 - r * r) * 0.5, y1: 0, y2: 0 };
  });
};
const BANK = bank(140, 185);
const ring = (x, x2) => {
  let out = 0;
  for (const m of BANK) {
    const y = m.w * (x - x2) + m.c * m.y1 - m.r2 * m.y2;
    m.y2 = m.y1;
    m.y1 = y;
    out += y;
  }
  return out;
};

const exc = new Float32Array(N3), air = new Float32Array(N3), airPan = new Float32Array(N3);
const at = (t) => Math.round((t / T_SCALE + D) * SR);
const each = (t0, fn) => { for (let k = -LOOP_LAPS; k < 2 * LOOP_LAPS; k++) fn(at(t0 + k * LAP)); };
// landing on the left tip: a soft raised-cosine touch into the wood
each(EVENTS.land, (i0) => {
  const L = Math.round(0.005 * SR);
  for (let j = 0; j < L; j++) if (i0 + j >= 0 && i0 + j < N3) exc[i0 + j] += 0.7 * 0.5 * (1 - Math.cos((TAU * j) / L));
});
// threading the donut: low airy swish (900 → 350 Hz)
each(EVENTS.pass, (i0) => {
  let lp = 0, bp = 0;
  const L = Math.round(0.26 * SR), start = i0 - Math.round(0.11 * SR);
  for (let j = 0; j < L; j++) {
    const u = j / L, a = Math.min(1, (TAU * (900 - 550 * u)) / SR);
    lp += a * (rnd() - lp);
    bp += a * (lp - bp);
    if (start + j >= 0 && start + j < N3) air[start + j] += (lp - bp) * Math.sin(Math.PI * u) ** 2.5;
  }
});
// the donut's own whoosh: very faint, follows its speed, panned with it
{
  let lp = 0, prev = donutAt(tOf(0));
  for (let i = 0; i < N3; i += 1) {
    const d = donutAt(tOf(i)), sp = Math.hypot(d.x - prev.x, d.y - prev.y) * SR;
    prev = d;
    lp += 0.03 * (rnd() - lp);
    air[i] += lp * Math.min(1, sp / 1.2) ** 2 * 0.5;
    airPan[i] = Math.max(-1, Math.min(1, d.x / 1.3)) * 0.6;
  }
}

// ─── render three loops
const Lc = new Float32Array(N3), Rc = new Float32Array(N3);
let g1 = 0, g2 = 0, bump = 0, amp = 0, panS = 0, x1 = 0, x2 = 0, lpA = 0, lpB = 0;
const top = Math.min(1, (TAU * 2800) / SR);
for (let i = 0; i < N3; i++) {
  const s = state(tOf(i));
  const target = s.force > 0 ? Math.min(1, s.v / VMAX) ** 0.9 * Math.sqrt(Math.min(2.5, s.force)) : 0;
  amp += (target - amp) * (target > amp ? 0.006 : 0.003);
  panS += (s.pan - panS) * 0.0008;
  const cut = Math.min(0.5, (TAU * (90 + 220 * s.v)) / SR);
  if ((rnd() + 1) / 2 < (s.v * 30) / SR) bump = 0.25 * (0.5 + Math.abs(rnd())) * (rnd() < 0 ? -1 : 1); // zero-mean
  bump *= 0.995;
  g1 += cut * (rnd() + bump - g1);
  g2 += cut * (g1 - g2);
  const inp = g2 * amp * 6 + exc[i];
  const wood = ring(inp, x2) + g2 * amp * 0.6;
  x2 = x1; x1 = inp;
  lpA += top * (wood - lpA);
  lpB += top * (lpA - lpB);
  const a = (panS + 1) * (Math.PI / 4), b = (airPan[i] + 1) * (Math.PI / 4);
  Lc[i] = lpB * Math.cos(a) * 1.41 + air[i] * 0.05 * Math.cos(b) * 1.41;
  Rc[i] = lpB * Math.sin(a) * 1.41 + air[i] * 0.05 * Math.sin(b) * 1.41;
}

// ─── small wooden room, dark and short
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
const wl = room(Lc, 0), wr = room(Rc, 0.0023);
// high-pass 80 Hz (RBJ biquad) over the whole three-loop render, so the filter is warmed up at the loop point
const highpass = (x, f) => {
  const w = (TAU * f) / SR, al = Math.sin(w) / (2 * 0.707), cw = Math.cos(w), a0 = 1 + al;
  const b0 = (1 + cw) / 2 / a0, b1 = -(1 + cw) / a0, b2 = b0, a1 = (-2 * cw) / a0, a2 = (1 - al) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const y = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y;
    x[i] = y;
  }
  return x;
};
const fullL = highpass(Lc.map((v, j) => v + 0.1 * wl[j]), 80), fullR = highpass(Rc.map((v, j) => v + 0.1 * wr[j]), 80);
let pink = 0;
const outL = new Float32Array(N), outR = new Float32Array(N);
const mixL = (j) => fullL[j], mixR = (j) => fullR[j];
// the loop point falls while the ball rolls: the last 40 ms fade (equal power) into the samples that lead into the
// loop's first sample in the continuous render, so the wrap is click-free
const X = Math.round(0.04 * SR);
for (let i = 0; i < N; i++) {
  pink += 0.01 * (rnd() - pink);
  const j = N + i;
  let l = mixL(j), r = mixR(j);
  if (i >= N - X) {
    const u = (i - (N - X)) / X, a = Math.cos((u * Math.PI) / 2), b = Math.sin((u * Math.PI) / 2), k = j - N;
    l = l * a + mixL(k) * b;
    r = r * a + mixR(k) * b;
  }
  outL[i] = l + pink * 0.003;
  outR[i] = r + pink * 0.003;
}
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(outL[i]), Math.abs(outR[i]));
const g = 0.5 / peak;
const buf = Buffer.alloc(44 + N * 4);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write("WAVEfmt ", 8);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write("data", 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, outL[i] * g)) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, outR[i] * g)) * 32767), 46 + i * 4);
}
fs.mkdirSync("public/vzdonut2", { recursive: true });
fs.writeFileSync("public/vzdonut2/wave-raw.wav", buf);

// ─── loudness: −16 LUFS over four loops, one gain, gentle limiter
const run = (args) => spawnSync("ffmpeg", args, { encoding: "utf8" });
const HP = "anull"; // the high-pass is done above (warm at the loop point)
const m1 = run(["-hide_banner", "-nostats", "-stream_loop", "3", "-i", "public/vzdonut2/wave-raw.wav", "-af", `${HP},ebur128=peak=true`, "-f", "null", "-"]).stderr;
const I = Number(/I:\s+(-?[\d.]+) LUFS/.exec(m1.slice(m1.lastIndexOf("Summary")))?.[1]);
// plain gain, no limiter (ffmpeg's alimiter delays the signal by its attack and would break the loop point); keep
// the true peak under −1 dBTP
const tp = Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(m1.slice(m1.lastIndexOf("Summary")))?.[1]);
const gainDb = Math.min(-16 - I, -1 - tp);
run(["-hide_banner", "-y", "-i", "public/vzdonut2/wave-raw.wav", "-af", `volume=${gainDb.toFixed(2)}dB`, "-c:a", "pcm_s16le", "public/vzdonut2/wave.wav"]);
const m2 = run(["-hide_banner", "-nostats", "-stream_loop", "3", "-i", "public/vzdonut2/wave.wav", "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr;
console.log(`raw ${I} LUFS → gain ${gainDb.toFixed(1)} dB → public/vzdonut2/wave.wav (${D.toFixed(3)} s)`);
console.log(m2.slice(m2.lastIndexOf("Summary")).replace(/\s+/g, " ").trim().slice(0, 240));
