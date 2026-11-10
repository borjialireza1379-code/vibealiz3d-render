// Synthesises the whole soundtrack of vz01 from songs.ts: one voice per song (bell, chip, marimba, pluck, piano,
// sax, synth), a small room, and quiet SFX (landing taps, transition whooshes, subscribe click+ding, final bell).
// SFX stay well under the melody. Writes public/vz01/mix.wav; normalise with ffmpeg loudnorm → mix-norm.wav.
// Usage (project root): node --no-warnings src/vz01/make-audio.mjs
import fs from "node:fs";
import { CTA_HIT, DURATION, FINAL_HIT, HITS, INTRO, SONGS, SPANS, TEMPO } from "./songs.ts";

const SR = 44100;
const N = Math.ceil((DURATION + 0.5) * SR);
const dry = new Float32Array(N); // melody
const sfx = new Float32Array(N);
const TAU = Math.PI * 2;
const hz = (m) => 440 * 2 ** ((m - 69) / 12);

// deterministic noise
let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

const add = (buf, t0, len, fn, gain) => {
  const i0 = Math.round(t0 * SR);
  for (let i = 0; i < len * SR && i0 + i < N; i++) buf[i0 + i] += gain * fn(i / SR);
};
const gate = (s, dur, rel = 0.05) => (s < dur ? 1 : Math.max(0, 1 - (s - dur) / rel));
const atk = (s, a) => Math.min(1, s / a);

const VOICES = {
  bell: (f) => [1.6, (s) => atk(s, 0.002) * (Math.sin(TAU * f * s) * Math.exp(-s / 0.9) + 0.45 * Math.sin(TAU * f * 2.76 * s) * Math.exp(-s / 0.3) + 0.2 * Math.sin(TAU * f * 5.4 * s) * Math.exp(-s / 0.1)), 0.55],
  chip: (f, dur) => [dur + 0.06, (s) => {
    let v = 0;
    for (const n of [1, 3, 5, 7, 9]) v += Math.sin(TAU * f * n * s) / n;
    return atk(s, 0.003) * gate(s, dur * 0.85, 0.04) * (0.55 + 0.45 * Math.exp(-s / 0.18)) * v;
  }, 0.3],
  marimba: (f) => [1.4, (s) => atk(s, 0.003) * (Math.sin(TAU * f * s) * Math.exp(-s / 0.45) + 0.35 * Math.sin(TAU * f * 3.93 * s) * Math.exp(-s / 0.06) + 0.12 * Math.sin(TAU * f * 0.5 * s) * Math.exp(-s / 0.3)), 0.75],
  piano: (f) => [2.2, (s) => {
    let v = 0;
    for (let n = 1; n <= 8; n++) v += (Math.sin(TAU * f * n * (1 + 0.0004 * n * n) * s) / n ** 1.4) * Math.exp(-s / (1.1 / n ** 0.7));
    return atk(s, 0.002) * v;
  }, 0.55],
  sax: (f, dur) => [dur + 0.1, (s) => {
    const vib = 1 + 0.004 * Math.sin(TAU * 5.5 * s) * Math.min(1, Math.max(0, (s - 0.15) / 0.2));
    let v = 0;
    for (let n = 1; n <= 10; n++) v += Math.sin(TAU * f * n * vib * s) / n ** 1.35;
    return atk(s, 0.025) * gate(s, dur * 0.92, 0.07) * v;
  }, 0.32],
  synth: (f, dur) => [dur + 0.15, (s) => {
    let v = 0;
    for (const d of [0.996, 1.004]) for (let n = 1; n <= 8; n++) v += Math.sin(TAU * f * d * n * s) / n;
    v += 0.6 * Math.sign(Math.sin(TAU * f * 0.5 * s)) * 0.5;
    return atk(s, 0.005) * gate(s, dur * 0.9, 0.12) * (0.5 + 0.5 * Math.exp(-s / 0.25)) * v;
  }, 0.17],
};

// Karplus-Strong pluck, rendered straight into the buffer
const pluck = (t0, f, gain) => {
  const p = Math.max(2, Math.round(SR / f));
  const ring = Float32Array.from({ length: p }, () => rnd());
  const i0 = Math.round(t0 * SR);
  let k = 0;
  for (let i = 0; i < 1.6 * SR && i0 + i < N; i++) {
    const a = ring[k], b = ring[(k + 1) % p];
    const out = a;
    ring[k] = 0.4985 * (a + b);
    k = (k + 1) % p;
    dry[i0 + i] += gain * out * Math.min(1, i / 40);
  }
};

// ─── melody
for (let h = 0; h < HITS.length; h++) {
  const hit = HITS[h];
  if (hit.kind !== "note") continue;
  const song = SONGS[hit.song];
  const next = HITS[h + 1];
  const dur = next && next.song === hit.song ? next.t - hit.t : 0.9;
  const f = hz(hit.midi + 12 * (song.octave ?? 0));
  if (song.timbre === "pluck") pluck(hit.t, f, 0.9);
  else {
    const [len, fn, gain] = VOICES[song.timbre](f, dur);
    add(dry, hit.t, len, fn, gain);
  }
}

// ─── sfx (all quiet)
const tap = (s) => rnd() * Math.exp(-s / 0.008);
for (const hit of HITS) add(sfx, hit.t, 0.05, tap, 0.05);
const whoosh = (len) => {
  let lp = 0;
  return (s) => {
    const u = s / len;
    lp += (rnd() - lp) * (0.02 + 0.25 * Math.sin(Math.PI * u) ** 2);
    return lp * Math.sin(Math.PI * u) ** 2;
  };
};
SPANS.forEach((sp, i) => {
  if (i < SPANS.length - 1) add(sfx, sp.end + 0.15, 0.9, whoosh(0.9), 0.35);
});
add(sfx, 0.2, INTRO - 0.2, whoosh(INTRO - 0.2), 0.3); // intro swell
// subscribe: a click, then a two-note ding
add(sfx, CTA_HIT.t, 0.03, (s) => rnd() * Math.exp(-s / 0.004), 0.25);
for (const [m, d] of [[84, 0.06], [88, 0.2]]) add(sfx, CTA_HIT.t + d, 1.6, VOICES.bell(hz(m))[1], 0.16);
// final bell on the platform
for (const m of [72, 76, 79]) add(sfx, FINAL_HIT.t, 2.5, VOICES.bell(hz(m))[1], 0.12);
// reveal pop
for (const sp of SPANS) add(sfx, sp.reveal, 0.12, (s) => Math.sin(TAU * (900 + 1400 * s) * s) * Math.exp(-s / 0.03), 0.06);

// ─── room: four feedback combs + one allpass on a send
const wet = new Float32Array(N);
for (const [d, g] of [[0.0297, 0.72], [0.0371, 0.7], [0.0411, 0.68], [0.0437, 0.66]]) {
  const k = Math.round(d * SR), c = new Float32Array(N);
  for (let i = 0; i < N; i++) c[i] = (dry[i] + 0.5 * sfx[i]) * 0.25 + (i >= k ? c[i - k] * g : 0);
  for (let i = 0; i < N; i++) wet[i] += c[i];
}
const out = new Float32Array(N);
for (let i = 0; i < N; i++) out[i] = dry[i] + sfx[i] + 0.12 * wet[i];
const fade = Math.round(1.5 * SR);
for (let i = 0; i < fade; i++) out[N - 1 - i] *= i / fade;
const peak = out.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
const g = 0.89 / peak;

const buf = Buffer.alloc(44 + N * 2);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + N * 2, 4); buf.write("WAVEfmt ", 8);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
buf.write("data", 36); buf.writeUInt32LE(N * 2, 40);
for (let i = 0; i < N; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, out[i] * g)) * 32767), 44 + i * 2);
fs.mkdirSync("public/vz01", { recursive: true });
fs.writeFileSync("public/vz01/mix.wav", buf);
// level check: melody vs sfx peaks (sfx must stay quieter)
const pk = (b) => 20 * Math.log10(b.reduce((m, x) => Math.max(m, Math.abs(x)), 0) * g);
console.log(`wrote public/vz01/mix.wav ${(N / SR).toFixed(1)}s (tempo ${TEMPO}) · melody peak ${pk(dry).toFixed(1)} dB · sfx peak ${pk(sfx).toFixed(1)} dB`);
