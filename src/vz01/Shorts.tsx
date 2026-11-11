// Vibealiz3D #01 Shorts (1080×1920, 60 fps): three 3-song shorts cut from the main timeline, back to back in one
// composition (cloud renders it once; split with SHORT_STARTS afterwards). Same 3D scene with the vertical camera,
// a HUD laid out for the Shorts UI (nothing in the top ~220 px or the bottom ~420 px that matters).
// Audio: public/vz01/shorts-mix.wav from make-shorts-audio.mjs (the same segments cut from mix-norm.wav).
import { ThreeCanvas } from "@remotion/three";
import React from "react";
import { AbsoluteFill, Html5Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FPS, SHORTS, SHORTS_FRAMES, SHORT_STARTS, SONGS, SPANS } from "./songs";
import { Scene } from "./Video";

export const VZ01SHORTS_FPS = FPS;
export const VZ01SHORTS_FRAMES = SHORTS_FRAMES;

const HEAD = "Anton"; // loaded by Video.tsx
const LABEL = "Chakra Petch";
const clamp01 = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const LEVEL: Record<string, string> = { EASY: "#3ddc6a", MEDIUM: "#ffb02e", HARD: "#ff4f4f", LEGEND: "#c86bff" };

// global time → (which short, time inside it, segment index, main-timeline time)
const locate = (g: number) => {
  let n = 0;
  while (n < SHORTS.length - 1 && g >= SHORT_STARTS[n + 1]) n++;
  const ts = g - SHORT_STARTS[n];
  const segs = SHORTS[n].segs;
  let s = 0;
  while (s < segs.length - 1 && ts >= segs[s + 1].at) s++;
  return { n, ts, s, t: segs[s].from + (ts - segs[s].at) };
};

const Tiles: React.FC<{ title: string; t: number; reveal: number }> = ({ title, t, reveal }) => {
  const w = Math.min(70, Math.floor(960 / title.length));
  return (
    <div style={{ display: "flex", gap: Math.max(3, w * 0.1), justifyContent: "center", marginTop: 18 }}>
      {[...title].map((ch, i) => {
        if (ch === " ") return <span key={i} style={{ width: w * 0.4 }} />;
        const k = interpolate(t, [reveal + i * 0.035, reveal + i * 0.035 + 0.16], [0, 1], clamp01);
        const shown = k > 0.5;
        return (
          <span key={i} style={{ width: w, height: w * 1.38, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#1f1b24", color: shown ? "#fff" : "#7f7788", borderRadius: 7, fontFamily: HEAD, fontSize: w * 0.95, transform: `scaleY(${Math.abs(1 - 2 * k)})`, boxShadow: "0 5px 0 #0004" }}>
            {shown ? ch : "?"}
          </span>
        );
      })}
    </div>
  );
};

const Ring: React.FC<{ t: number; start: number; reveal: number; accent: string }> = ({ t, start, reveal, accent }) => {
  const left = Math.max(0, reveal - t);
  const done = t >= reveal;
  const p = done ? 1 : 1 - left / (reveal - start);
  const R = 52, L = 2 * Math.PI * R;
  const pop = done ? interpolate(t, [reveal, reveal + 0.12, reveal + 0.3], [1, 1.25, 1], clamp01) : 1;
  return (
    <svg width={136} height={136} viewBox="0 0 136 136" style={{ transform: `scale(${pop})` }}>
      <circle cx={68} cy={68} r={R + 9} fill="#1f1b24" />
      <circle cx={68} cy={68} r={R} fill="none" stroke="#ffffff22" strokeWidth={9} />
      <circle cx={68} cy={68} r={R} fill="none" stroke={done ? LEVEL.EASY : accent} strokeWidth={9} strokeLinecap="round" strokeDasharray={`${L * p} ${L}`} transform="rotate(-90 68 68)" />
      {done ? (
        <path d="M45 70 L61 86 L92 52" fill="none" stroke="#fff" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <text x={68} y={84} textAnchor="middle" fontFamily={HEAD} fontSize={50} fill="#fff">
          {Math.ceil(left)}
        </text>
      )}
    </svg>
  );
};

const Pop: React.FC<{ ts: number; at: number; dur: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ ts, at, dur, children, style }) => {
  const k = ts - at;
  if (k < 0 || k > dur) return null;
  const a = interpolate(k, [0, 0.12, dur - 0.2, dur], [0, 1, 1, 0], clamp01);
  const sc = interpolate(k, [0, 0.12, 0.24], [0.6, 1.08, 1], clamp01);
  return <div style={{ position: "absolute", left: 0, right: 0, display: "flex", justifyContent: "center", opacity: a, transform: `scale(${sc})`, ...style }}>{children}</div>;
};

export const VZ01SHORTS: React.FC<{ silent?: boolean }> = ({ silent }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const { n, ts, s, t } = locate(frame / fps);
  const short = SHORTS[n];
  const seg = short.segs[s];
  const song = SONGS[seg.song];
  const span = SPANS[seg.song];
  const endAt = short.len - 2.8;
  const progress = ts / short.len;
  return (
    <AbsoluteFill style={{ background: "#9a9da4" }}>
      <ThreeCanvas width={width} height={height} shadows camera={{ fov: 62, near: 0.1, far: 90 }} gl={{ antialias: false, stencil: false }}>
        <Scene t={t} vertical />
      </ThreeCanvas>
      {/* quick white flash on each cut between worlds */}
      {s > 0 && ts - seg.at < 0.12 && <AbsoluteFill style={{ background: "#fff", opacity: 1 - (ts - seg.at) / 0.12 }} />}
      {ts < endAt && (
        <div style={{ position: "absolute", top: 230, left: 50, right: 50 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 12, fontFamily: LABEL }}>
              <span style={{ background: song.accent, color: "#fff", borderRadius: 10, padding: "6px 18px", fontSize: 40, textShadow: "0 1px 2px #0005" }}>SONG {s + 1}/3</span>
              <span style={{ background: "#1f1b24", color: LEVEL[song.level], borderRadius: 10, padding: "6px 16px", fontSize: 34, letterSpacing: 2, alignSelf: "center" }}>{song.level}</span>
            </div>
            <Ring t={t} start={span.start} reveal={span.reveal} accent={song.accent} />
          </div>
          <Tiles title={song.title} t={t} reveal={span.reveal} />
        </div>
      )}
      {/* hook */}
      <Pop ts={ts} at={0.05} dur={2.0} style={{ top: 760, flexDirection: "column", alignItems: "center" }}>
        <div style={{ fontFamily: HEAD, fontSize: 118, color: "#fff", lineHeight: 1, textShadow: "0 7px 0 #1f1b24, 0 12px 30px #0005" }}>GUESS ALL 3 SONGS</div>
        <div style={{ marginTop: 18, fontFamily: LABEL, fontSize: 44, color: "#fff", background: "#c86bff", padding: "8px 26px", borderRadius: 14 }}>CAN YOU GET 3/3?</div>
      </Pop>
      {/* captions of the main video, re-timed */}
      {song.caption && <Pop ts={ts} at={seg.at + (span.start - seg.from) + song.caption[0]} dur={1.9} style={{ bottom: 470 }}>
        <span style={{ background: "#1f1b24", color: "#fff", fontFamily: LABEL, fontSize: 46, padding: "12px 30px", borderRadius: 16 }}>{song.caption[1]}</span>
      </Pop>}
      {seg.song === SONGS.length - 1 && (
        <Pop ts={ts} at={seg.at + (span.reveal - seg.from) + 0.5} dur={2.0} style={{ bottom: 470 }}>
          <span style={{ background: "#c86bff", color: "#fff", fontFamily: LABEL, fontSize: 46, padding: "12px 30px", borderRadius: 16 }}>YOU JUST GOT RICKROLLED</span>
        </Pop>
      )}
      {/* end card */}
      {ts >= endAt && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 140, opacity: interpolate(ts, [endAt, endAt + 0.25], [0, 1], clamp01) }}>
          <div style={{ background: "#1f1b24ee", borderRadius: 34, padding: "44px 56px", display: "flex", flexDirection: "column", alignItems: "center", transform: `scale(${interpolate(ts, [endAt, endAt + 0.18, endAt + 0.3], [0.6, 1.06, 1], clamp01)})`, boxShadow: "0 20px 60px #0006" }}>
            <div style={{ fontFamily: HEAD, fontSize: 104, color: "#fff", lineHeight: 1.05, textAlign: "center" }}>HOW MANY<br />DID YOU GET?</div>
            <div style={{ fontFamily: LABEL, fontSize: 46, color: "#ffcf3a", marginTop: 18 }}>COMMENT: __ / 3</div>
            <div style={{ fontFamily: LABEL, fontSize: 36, color: "#fff", background: "#ff2b2b", padding: "10px 26px", borderRadius: 12, marginTop: 26 }}>FULL 12-SONG CHALLENGE ON MY CHANNEL</div>
          </div>
        </AbsoluteFill>
      )}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 9, background: "#0000001a" }}>
        <div style={{ width: `${Math.min(1, progress) * 100}%`, height: "100%", background: song.accent }} />
      </div>
      {!silent && <Html5Audio src={staticFile("vz01/shorts-mix.wav")} />}
    </AbsoluteFill>
  );
};
