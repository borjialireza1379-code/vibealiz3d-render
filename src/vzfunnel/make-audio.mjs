// Soundtrack of the vortex-funnel machine, synthesised from track.ts (no samples, nothing to license), same voice as
// the first machine (src/vzmachine/make-audio.mjs): bell + soft marimba body for the notes, quiet mechanics under them.
// - the run down the rails: one note per light, a quick rising C-major sweep that lands on the throw
// - the throw: a soft airy lift; the landing: a gentle knock + two small bounces
// - the spiral: a rolling hiss that brightens and speeds up as the ball winds in (the dish "sings" a slow whirr)
// - the hole: a hollow "tunk"; lights going out: soft high tinks
// Seamless loop: everything is added modulo the loop length, so tails from the end ring on into the start.
// Usage (project root): node --no-warnings src/vzfunnel/make-audio.mjs   → public/vzfunnel/funnel.wav
import fs from "node:fs";
import { DURATION, EVENTS, T_DISH, ballAt, dishAngle } from "./track.ts";

const SR = 44100, N = Math.round(DURATION * SR), TAU = Math.PI * 2;
const notes = new Float32Array(N), fx = new Float32Array(N);
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
const add = (buf, t0, len, fn, g) => {
  const i0 = Math.round(t0 * SR);
  for (let i = 0; i < len * SR; i++) buf[(((i0 + i) % N) + N) % N] += g * fn(i / SR);
};

// ─── notes: a rising sweep, C major over two octaves, the last light an octave above the root
const SCALE = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96];
const bell = (f) => (s) =>
  Math.min(1, s / 0.002) *
  (Math.sin(TAU * f * s) * Math.exp(-s / 0.9) + 0.32 * Math.sin(TAU * f * 2.76 * s) * Math.exp(-s / 0.22) + 0.12 * Math.sin(TAU * f * 5.4 * s) * Math.exp(-s / 0.07) + 0.25 * Math.sin(TAU * f * 0.5 * s) * Math.exp(-s / 0.35));
EVENTS.lightsOn.forEach((t, i) => add(notes, t, 1.8, bell(hz(SCALE[i % SCALE.length])), 0.32 + 0.012 * i));
// the spiral sings: a soft note every half lap (the ball passes the front and the back of the dish), quickening as
// the ball winds in, climbing towards the sweep
{
  const HALF = [];
  const a0 = dishAngle(0);
  for (let t = 0.3, k = 1; t < T_DISH; t += 1 / 240) {
    if (dishAngle(t) >= a0 + k * Math.PI) {
      HALF.push(t);
      k++;
    }
  }
  const PAD = [48, 55, 52, 55, 57, 55, 59, 62, 64, 67, 71, 72];
  HALF.forEach((t, i) => add(notes, t, 1.4, bell(hz(PAD[Math.min(i, PAD.length - 1)] + 12)), 0.13 + 0.012 * i));
  console.log(`dish notes: ${HALF.length}`);
}
// the landing rings a soft low chord (C + G) under the knock: the loop's downbeat
add(notes, EVENTS.land, 2.2, bell(hz(48)), 0.28);
add(notes, EVENTS.land, 2.2, bell(hz(55)), 0.18);

// ─── mechanics (quiet)
const knock = (f, d) => (s) => (Math.sin(TAU * f * s) * 0.7 + rnd() * 0.3) * Math.exp(-s / d);
add(fx, EVENTS.land, 0.14, knock(820, 0.028), 0.2);
EVENTS.dishBounces.forEach((t, k) => add(fx, t, 0.1, knock(880, 0.02), 0.11 / (k + 1.5)));
const speedAt = (t) => {
  const a = ballAt(t).p, b = ballAt(t + 0.01).p;
  return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 0.01;
};
// rolling: filtered noise, louder and brighter with speed, with a soft whirr at the lap rate
const roll = ([a, b], level, bright0, bright1) => {
  let lp = 0;
  add(fx, a, b - a, (s) => {
    const t = a + s, v = speedAt(t), u = s / (b - a);
    lp += (rnd() - lp) * (bright0 + (bright1 - bright0) * u);
    const env = Math.min(1, s / 0.15, (b - a - s) / 0.04);
    return lp * Math.min(1.3, v / 4) * env * (1 + 0.25 * Math.sin(TAU * (1.5 + 6 * u * u) * s));
  }, level);
};
roll(EVENTS.dishRoll, 0.16, 0.05, 0.16);
// the drop through the hole: hollow "tunk", then the rails' metallic run
add(fx, EVENTS.hole + 0.05, 0.3, (s) => Math.sin(TAU * (210 + 120 * Math.exp(-s / 0.04)) * s) * Math.exp(-s / 0.09), 0.18);
add(fx, EVENTS.rails, 0.06, knock(2600, 0.008), 0.05);
roll(EVENTS.trackRoll, 0.12, 0.2, 0.3);
// the throw: a soft airy lift (band-passed noise swelling and fading)
{
  let lp = 0, lp2 = 0;
  add(fx, EVENTS.launch, 0.6, (s) => {
    lp += (rnd() - lp) * 0.25;
    lp2 += (lp - lp2) * 0.08;
    return (lp - lp2) * Math.sin(Math.PI * Math.min(1, s / 0.6)) ** 2;
  }, 0.22);
}
// lights out, from the ramp back to the bend: soft high tinks, descending
[...EVENTS.lightsOff].map((t, i) => [t, i]).sort((x, y) => x[0] - y[0]).forEach(([t], k) => add(fx, t, 0.25, (s) => Math.sin(TAU * hz(96 - k) * s) * Math.exp(-s / 0.05), 0.016));

// ─── mix: a small room on the notes, effects under, peak −1.5 dBFS
const wet = new Float32Array(N);
for (const [d, g] of [[0.031, 0.6], [0.047, 0.55], [0.061, 0.5]]) {
  const k = Math.round(d * SR), c = new Float32Array(N);
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < N; i++) c[i] = notes[i] * 0.3 + c[(i - k + N) % N] * g; // circular, so the loop stays seamless
  for (let i = 0; i < N; i++) wet[i] += c[i];
}
const out = new Float32Array(N);
const FX_GAIN = 3.2; // effects sit ~15 dB under the notes (the first machine's preset: 14–17 dB)
for (let i = 0; i < N; i++) out[i] = notes[i] + 0.15 * wet[i] + FX_GAIN * fx[i];
const peak = out.reduce((m, x) => Math.max(m, Math.abs(x)), 0), g = 0.84 / peak;
const db = (b) => (20 * Math.log10(b.reduce((m, x) => Math.max(m, Math.abs(x)), 0) * g)).toFixed(1);
const buf = Buffer.alloc(44 + N * 4);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write("WAVEfmt ", 8);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write("data", 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  const s = Math.round(Math.max(-1, Math.min(1, out[i] * g)) * 32767);
  buf.writeInt16LE(s, 44 + i * 4);
  buf.writeInt16LE(s, 46 + i * 4);
}
fs.mkdirSync("public/vzfunnel", { recursive: true });
fs.writeFileSync("public/vzfunnel/funnel-raw.wav", buf);
console.log(`wrote public/vzfunnel/funnel-raw.wav ${(N / SR).toFixed(2)} s (dish ${T_DISH.toFixed(2)} s) · notes peak ${db(notes)} dB · effects peak ${db(fx.map((x) => x * FX_GAIN))} dB`);
