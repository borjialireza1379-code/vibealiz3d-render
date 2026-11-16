// Soundtrack of the musical marble machine, synthesised from motion.ts (no samples, nothing to license):
// every note-light plays one note of a C–Am–F–G arpeggio (bell + marimba body), plus quiet mechanics: spring creak
// and boing, tray knocks and roll, the drop into the glass, glass roll, base roll, the landing on the plate, and soft
// "tinks" as the lights go off. Effects stay ≥ 8 dB under the notes. Seamless: every tail ends before the loop.
// Usage (project root): node --no-warnings src/vzmachine/make-audio.mjs   → public/vzmachine/machine.wav
import fs from "node:fs";
import { DURATION, EVENTS, T_RELEASE, T_REST, ballAt } from "./motion.ts";

const SR = 44100, N = Math.round(DURATION * SR), TAU = Math.PI * 2;
const notes = new Float32Array(N), fx = new Float32Array(N);
let seed = 3;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
const add = (buf, t0, len, fn, g) => {
  const i0 = Math.round(t0 * SR);
  for (let i = 0; i < len * SR && i0 + i < N; i++) if (i0 + i >= 0) buf[i0 + i] += g * fn(i / SR);
};

// ─── the melody: one note per light
const CH = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]]; // C Am F G
const MEL = [];
for (const [r, t, f] of CH) MEL.push(r + 12, t + 12, f + 12, r + 24, t + 24, f + 12, t + 12);
MEL.push(76, 72); // ends on E6 → C6
const bell = (f) => (s) =>
  Math.min(1, s / 0.002) *
  (Math.sin(TAU * f * s) * Math.exp(-s / 0.9) + 0.32 * Math.sin(TAU * f * 2.76 * s) * Math.exp(-s / 0.22) + 0.12 * Math.sin(TAU * f * 5.4 * s) * Math.exp(-s / 0.07) + 0.25 * Math.sin(TAU * f * 0.5 * s) * Math.exp(-s / 0.35));
EVENTS.lightsOn.forEach((t, i) => add(notes, t, 1.6, bell(hz(MEL[i % MEL.length])), 0.5));

// ─── mechanics (quiet)
const knock = (f, d) => (s) => (Math.sin(TAU * f * s) * 0.7 + rnd() * 0.3) * Math.exp(-s / d);
// spring: creak while compressing, boing on release
add(fx, T_REST, T_RELEASE - T_REST, (s) => {
  const u = s / (T_RELEASE - T_REST);
  return rnd() * 0.25 * u * (0.5 + 0.5 * Math.sin(TAU * 31 * s));
}, 0.05);
add(fx, T_RELEASE, 0.6, (s) => {
  const f = 120 + 90 * Math.exp(-s / 0.08);
  return Math.sin(TAU * f * s + 3 * Math.sin(TAU * 26 * s) * Math.exp(-s / 0.15)) * Math.exp(-s / 0.18);
}, 0.22);
add(fx, T_RELEASE, 0.03, knock(1400, 0.006), 0.18);
// tray: landing knock + bounces, then a rolling hiss that fades as the ball slows
add(fx, EVENTS.trayLand, 0.12, knock(900, 0.025), 0.2);
EVENTS.trayBounces.forEach((t, k) => add(fx, t, 0.1, knock(950, 0.02), 0.12 / (k + 1.5)));
const roll = ([a, b], level, bright) => {
  let lp = 0;
  const step = 1 / SR;
  add(fx, a, b - a, (s) => {
    const t = a + s;
    const p0 = ballAt(t).p, p1 = ballAt(t + 0.01).p;
    const v = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]) / 0.01;
    lp += (rnd() - lp) * bright;
    const env = Math.min(1, s / 0.08, (b - a - s) / 0.08);
    return lp * Math.min(1, v / 4) * env * (1 + 0.3 * Math.sin(TAU * v * 3 * s * step * SR));
  }, level);
};
roll(EVENTS.trayRoll, 0.12, 0.08);
// the drop into the glass, then rolling inside the glass helix, then across the base
add(fx, EVENTS.helixIn, 0.25, (s) => Math.sin(TAU * 2350 * s) * Math.exp(-s / 0.05) + 0.4 * Math.sin(TAU * 3720 * s) * Math.exp(-s / 0.03), 0.07);
roll(EVENTS.helixRoll, 0.1, 0.14);
roll(EVENTS.baseRoll, 0.1, 0.06);
// home: a soft thunk on the plate, two small bounces, a tiny spring wobble
add(fx, EVENTS.plateLand, 0.15, knock(520, 0.03), 0.22);
EVENTS.plateBounces.forEach((t, k) => add(fx, t, 0.1, knock(560, 0.02), 0.1 / (k + 1.5)));
add(fx, EVENTS.plateLand, 0.4, (s) => Math.sin(TAU * (140 + 40 * Math.exp(-s / 0.05)) * s) * Math.exp(-s / 0.1), 0.06);
// lights off bottom-up: soft rising tinks
[...EVENTS.lightsOff].map((t, i) => [t, i]).sort((x, y) => x[0] - y[0]).forEach(([t], k) => add(fx, t, 0.25, (s) => Math.sin(TAU * hz(84 + (k % 12)) * s) * Math.exp(-s / 0.05), 0.018));

// ─── mix: a small room on the notes, effects under, peak −1.5 dBFS
const wet = new Float32Array(N);
for (const [d, g] of [[0.031, 0.6], [0.047, 0.55], [0.061, 0.5]]) {
  const k = Math.round(d * SR), c = new Float32Array(N);
  for (let i = 0; i < N; i++) c[i] = notes[i] * 0.3 + (i >= k ? c[i - k] * g : 0);
  for (let i = 0; i < N; i++) wet[i] += c[i];
}
const out = new Float32Array(N);
for (let i = 0; i < N; i++) out[i] = notes[i] + 0.15 * wet[i] + fx[i];
const peak = out.reduce((m, x) => Math.max(m, Math.abs(x)), 0), g = 0.84 / peak;
const db = (b) => (20 * Math.log10(b.reduce((m, x) => Math.max(m, Math.abs(x)), 0) * g)).toFixed(1);
// stereo file, same signal on both channels
const buf = Buffer.alloc(44 + N * 4);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write("WAVEfmt ", 8);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write("data", 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  const x = Math.max(-1, Math.min(1, out[i] * g));
  const s = Math.round(x * 32767);
  buf.writeInt16LE(s, 44 + i * 4);
  buf.writeInt16LE(s, 46 + i * 4);
}
fs.mkdirSync("public/vzmachine", { recursive: true });
fs.writeFileSync("public/vzmachine/machine.wav", buf);
console.log(`wrote public/vzmachine/machine.wav ${(N / SR).toFixed(2)} s · notes peak ${db(notes)} dB · effects peak ${db(fx)} dB`);
