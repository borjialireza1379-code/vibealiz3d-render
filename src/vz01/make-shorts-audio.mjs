// Cuts the Shorts soundtrack out of public/vz01/mix-norm.wav with the same segments as Shorts.tsx (songs.ts SHORTS),
// short fades at every cut, the three shorts back to back → public/vz01/shorts-mix.wav (−14 LUFS).
// Usage (project root, ffmpeg on PATH): node --no-warnings src/vz01/make-shorts-audio.mjs
import { execFileSync } from "node:child_process";
import { SHORTS } from "./songs.ts";

const parts = [];
for (const sh of SHORTS) {
  sh.segs.forEach((g, i) => {
    const last = i === sh.segs.length - 1;
    const len = last ? sh.len - g.at : g.to - g.from;
    parts.push({ from: g.from, len, fadeIn: i === 0 ? 0.02 : 0.08, fadeOut: last ? 0.6 : 0.06 });
  });
}
const f = parts
  .map((p, i) => `[0:a]atrim=start=${p.from.toFixed(4)}:duration=${p.len.toFixed(4)},asetpts=PTS-STARTPTS,afade=t=in:d=${p.fadeIn},afade=t=out:st=${(p.len - p.fadeOut).toFixed(4)}:d=${p.fadeOut}[a${i}]`)
  .join(";");
const cat = parts.map((_, i) => `[a${i}]`).join("") + `concat=n=${parts.length}:v=0:a=1,loudnorm=I=-14:TP=-1.5:LRA=11[out]`;
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", "public/vz01/mix-norm.wav", "-filter_complex", `${f};${cat}`, "-map", "[out]", "-ar", "44100", "public/vz01/shorts-mix.wav"], { stdio: "inherit" });
console.log(`wrote public/vz01/shorts-mix.wav (${parts.length} segments, ${SHORTS.reduce((a, s) => a + s.len, 0).toFixed(2)} s)`);
