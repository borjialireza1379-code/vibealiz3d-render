// Vibealiz3D #01 — "Guess all 12 meme songs". The songs, their hooks (note/beats), the worlds they play in,
// and the whole timeline (every landing: time + position). Pure data, no imports: make-audio.mjs imports it too.
// Notes: "E5/1" = E5 for one beat, "R/0.5" = rest (lengthens the hop before the next landing).

export type Pad = "key" | "neon" | "tetro" | "drum" | "plank" | "pillar" | "coin" | "slab" | "piano" | "gem" | "organ" | "disco";
export type Timbre = "bell" | "chip" | "marimba" | "pluck" | "piano" | "sax" | "synth";
export type Level = "EASY" | "MEDIUM" | "HARD" | "LEGEND";

export type Song = {
  title: string;
  bpm: number;
  notes: string;
  pad: Pad;
  timbre: Timbre;
  level: Level;
  wall: string; // greyish wall tint
  accent: string; // HUD + light colour
  colors: string[]; // pad palette
  caption?: [number, string]; // [seconds after the song starts, line]
  octave?: number; // shift for the synth (not the visuals)
};

export const SONGS: Song[] = [
  {
    title: "NOKIA RINGTONE", bpm: 165, pad: "key", timbre: "bell", level: "EASY", wall: "#c3c8cf", accent: "#38d996", colors: ["#e9edf2", "#d6dce4"],
    notes: "E5/0.5 D5/0.5 F#4/1 G#4/1 C#5/0.5 B4/0.5 D4/1 E4/1 B4/0.5 A4/0.5 C#4/1 E4/1 A4/2 R/1 E5/0.5 D5/0.5 F#4/1 G#4/1 C#5/0.5 B4/0.5 D4/1 E4/1 B4/0.5 A4/0.5 C#4/1 E4/1 A4/2",
    caption: [5.8, "PICK UP THE PHONE..."],
  },
  {
    title: "MEGALOVANIA", bpm: 112, pad: "neon", timbre: "chip", level: "MEDIUM", wall: "#6e727c", accent: "#4fc3ff", colors: ["#25272e", "#4fc3ff", "#7c6cff"],
    notes:
      "D4/0.25 D4/0.25 D5/0.5 A4/0.75 G#4/0.5 G4/0.5 F4/0.5 D4/0.25 F4/0.25 G4/0.25 C4/0.25 C4/0.25 D5/0.5 A4/0.75 G#4/0.5 G4/0.5 F4/0.5 D4/0.25 F4/0.25 G4/0.25 " +
      "B3/0.25 B3/0.25 D5/0.5 A4/0.75 G#4/0.5 G4/0.5 F4/0.5 D4/0.25 F4/0.25 G4/0.25 A#3/0.25 A#3/0.25 D5/0.5 A4/0.75 G#4/0.5 G4/0.5 F4/0.5 D4/0.25 F4/0.25 G4/1",
    caption: [4.5, "IT'S A BEAUTIFUL DAY OUTSIDE..."],
  },
  {
    title: "TETRIS THEME", bpm: 140, pad: "tetro", timbre: "chip", level: "EASY", wall: "#b4b9c3", accent: "#ffcf3a", colors: ["#2ec4f0", "#ffcf3a", "#b05cff", "#3ddc6a", "#ff5a4f", "#ff9f2e", "#3c6cff"],
    notes: "E5/1 B4/0.5 C5/0.5 D5/1 C5/0.5 B4/0.5 A4/1 A4/0.5 C5/0.5 E5/1 D5/0.5 C5/0.5 B4/1.5 C5/0.5 D5/1 E5/1 C5/1 A4/1 A4/2",
  },
  {
    title: "LA CUCARACHA", bpm: 150, pad: "drum", timbre: "marimba", level: "EASY", wall: "#cbc3ba", accent: "#ff5a4f", colors: ["#ff5a4f", "#ffcf3a", "#f4f0e8"],
    notes: "C5/0.5 C5/0.5 C5/0.5 F5/1 A5/2.5 C5/0.5 C5/0.5 C5/0.5 F5/1 A5/2.5 F5/1 F5/0.5 E5/0.5 E5/0.5 D5/0.5 D5/0.5 C5/2",
    caption: [3.0, "BEEP BEEP"],
  },
  {
    title: "HE'S A PIRATE", bpm: 330, pad: "plank", timbre: "pluck", level: "MEDIUM", wall: "#a8a199", accent: "#e0a35a", colors: ["#8a5a35", "#a06a3e", "#6f4529"],
    notes:
      "A4/1 C5/1 D5/2 D5/2 D5/1 E5/1 F5/2 F5/2 F5/1 G5/1 E5/2 E5/2 D5/1 C5/1 C5/1 D5/3 " +
      "A4/1 C5/1 D5/2 D5/2 D5/1 E5/1 F5/2 F5/2 F5/1 G5/1 E5/2 E5/2 D5/1 C5/1 D5/4",
  },
  {
    title: "MOUNTAIN KING", bpm: 150, pad: "pillar", timbre: "piano", level: "MEDIUM", wall: "#878c96", accent: "#b78cff", colors: ["#5b5f68", "#6a6e77", "#b78cff", "#5cf0c0"],
    notes: "A4/0.5 B4/0.5 C5/0.5 D5/0.5 E5/0.5 C5/0.5 E5/1 D#5/0.5 B4/0.5 D#5/1 D5/0.5 A#4/0.5 D5/1 A4/0.5 B4/0.5 C5/0.5 D5/0.5 E5/0.5 C5/0.5 E5/0.5 A5/0.5 G5/0.5 E5/0.5 C5/0.5 E5/0.5 G5/2",
    caption: [2.6, "SOMETHING IS SNEAKING UP..."],
  },
  {
    title: "MARIO THEME", bpm: 190, pad: "coin", timbre: "chip", level: "EASY", wall: "#bfc4ca", accent: "#ffc531", colors: ["#ffc531"],
    notes:
      "E5/0.5 E5/0.5 R/0.5 E5/0.5 R/0.5 C5/0.5 E5/1 G5/2 G4/2 C5/1.5 G4/1.5 E4/1.5 A4/1 B4/1 A#4/0.5 A4/1 " +
      "G4/0.67 E5/0.67 G5/0.66 A5/1 F5/0.5 G5/0.5 R/0.5 E5/1 C5/0.5 D5/0.5 B4/1.5",
    caption: [2.4, "YOUR CHILDHOOD IS CALLING"],
  },
  {
    title: "SEVEN NATION ARMY", bpm: 124, pad: "slab", timbre: "pluck", level: "MEDIUM", wall: "#9a9a9c", accent: "#ff3b3b", colors: ["#e8e4df", "#d42a2a", "#1d1d20"], octave: -1,
    notes: "E5/1.5 E5/0.5 G5/0.75 E5/0.75 D5/0.5 C5/2 B4/2 E5/1.5 E5/0.5 G5/0.75 E5/0.75 D5/0.5 C5/0.75 D5/0.75 C5/0.5 B4/2",
    caption: [3.4, "OH, OH-OH-OH..."],
  },
  {
    title: "CAN-CAN", bpm: 160, pad: "piano", timbre: "piano", level: "HARD", wall: "#cdc8d1", accent: "#ff6fb5", colors: ["#f6f4f1", "#1b1b1f"],
    notes: "C5/1 D5/0.5 F5/0.5 E5/0.5 D5/0.5 G5/1 G5/1 G5/0.5 A5/0.5 E5/0.5 F5/0.5 D5/1 D5/1 D5/0.5 F5/0.5 E5/0.5 D5/0.5 C5/0.5 C6/0.5 B5/0.5 A5/0.5 G5/0.5 F5/0.5 E5/0.5 D5/0.5 C5/1",
  },
  {
    title: "PINK PANTHER", bpm: 118, pad: "gem", timbre: "sax", level: "HARD", wall: "#b6afb8", accent: "#ff5fae", colors: ["#ff5fae", "#ff8fc8"],
    notes: "D#4/0.5 E4/1.5 F#4/0.5 G4/1.5 D#4/0.5 E4/0.75 F#4/0.5 G4/0.75 C5/0.5 B4/0.75 E4/0.5 G4/0.75 B4/0.5 A#4/3 A4/0.5 G4/0.5 E4/0.5 D4/0.5 E4/3",
    caption: [2.2, "TIPTOE MODE: ON"],
  },
  {
    title: "FÜR ELISE", bpm: 170, pad: "organ", timbre: "piano", level: "HARD", wall: "#c4c0b8", accent: "#e8c15a", colors: ["#e8c15a", "#d4a73c"],
    notes: "E5/0.5 D#5/0.5 E5/0.5 D#5/0.5 E5/0.5 B4/0.5 D5/0.5 C5/0.5 A4/1.5 C4/0.5 E4/0.5 A4/0.5 B4/1.5 E4/0.5 G#4/0.5 B4/0.5 C5/1.5 E4/0.5 E5/0.5 D#5/0.5 E5/0.5 D#5/0.5 E5/0.5 B4/0.5 D5/0.5 C5/0.5 A4/1.5 C4/0.5 E4/0.5 A4/0.5 B4/1.5 E4/0.5 C5/0.5 B4/0.5 A4/2",
    caption: [3.0, "YOU'VE BEEN ON HOLD FOR 47 MINUTES"],
  },
  {
    title: "NEVER GONNA GIVE YOU UP", bpm: 113, pad: "disco", timbre: "synth", level: "LEGEND", wall: "#767a85", accent: "#c86bff", colors: ["#ff4fa3", "#4fc3ff", "#ffd23f", "#7cff6b", "#c86bff"],
    notes:
      "C5/0.25 D5/0.25 F5/0.25 D5/0.25 A5/0.75 A5/0.75 G5/1.5 C5/0.25 D5/0.25 F5/0.25 D5/0.25 G5/0.75 G5/0.75 F5/0.75 E5/0.25 D5/0.5 " +
      "C5/0.25 D5/0.25 F5/0.25 D5/0.25 F5/1 G5/0.5 E5/0.75 D5/0.25 C5/1 C5/0.5 G5/1 F5/2",
    caption: [1.6, "WAIT... IS THIS...?"],
  },
];

// ─────────────── timeline
export const FPS = 60;
export const INTRO = 3.4;
export const TEMPO = 0.92; // all songs a touch slower: easier to recognise, softer hops // title card; the ball drops onto the first pad at INTRO
export const TRANSITION = 1.4; // hop from a song's last note to the next song's first
export const CTA_AFTER = 4; // index of the song after which the ball presses the subscribe button
export const CTA_HOP = 0.95; // last note → button
export const CTA_BOUNCES = [0.42, 0.26]; // the ball bounces twice on the pressed button
export const CTA_LEAVE = 0.95; // button → next song
export const OUTRO_HOP = 1.0; // last note → final platform
export const OUTRO = 9.0; // score card time after landing on the platform

const NAMES: Record<string, number> = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
export const midi = (n: string) => {
  const m = n.match(/^([A-G]#?)(\d)$/);
  if (!m) throw new Error("bad note " + n);
  return 12 * (Number(m[2]) + 1) + NAMES[m[1]];
};

export type Hit = {
  t: number; // landing time (s)
  x: number;
  y: number; // top surface of the pad
  song: number; // -1 = special
  i: number; // index inside the song
  midi: number; // -1 = no note
  kind: "note" | "cta" | "bounce" | "final";
};

export type SongSpan = { start: number; end: number; reveal: number };

export const { HITS, SPANS, CTA_HIT, FINAL_HIT, DURATION } = (() => {
  const hits: Hit[] = [];
  const spans: SongSpan[] = [];
  let t = INTRO;
  let x = 0;
  let base = 0; // running height of the track
  let prevT = -1;
  const place = (time: number, y: number, stay = false) => {
    if (prevT >= 0 && !stay) x += 0.72 + 1.25 * Math.min(1.3, time - prevT);
    prevT = time;
    return { t: time, x, y };
  };
  let cta: Hit | null = null;
  SONGS.forEach((s, si) => {
    const beat = 60 / (s.bpm * TEMPO);
    const toks = s.notes.trim().split(/\s+/).map((k) => k.split("/"));
    const notes: { n: string; d: number }[] = [];
    for (const [n, d] of toks) {
      if (n === "R") notes[notes.length - 1].d += Number(d);
      else notes.push({ n, d: Number(d) });
    }
    const mids = notes.map((n) => midi(n.n));
    const mean = mids.reduce((a, b) => a + b, 0) / mids.length;
    const start = t;
    notes.forEach((n, i) => {
      const y = base - i * 0.16 + (mids[i] - mean) * 0.075;
      hits.push({ ...place(t, y), song: si, i, midi: mids[i], kind: "note" });
      t += n.d * beat;
    });
    const last = t - notes[notes.length - 1].d * beat;
    // the last note rings for its own length, the hop to the next thing leaves on the last landing
    t = last;
    spans.push({ start, end: last, reveal: start + (last - start) * 0.58 });
    base = base - notes.length * 0.16 + 1.6; // next world starts higher
    if (si === CTA_AFTER) {
      t += CTA_HOP;
      cta = { ...place(t, base - 0.2), song: -1, i: 0, midi: -1, kind: "cta" };
      hits.push(cta);
      for (const b of CTA_BOUNCES) {
        t += b;
        hits.push({ ...place(t, cta.y, true), song: -1, i: 0, midi: -1, kind: "bounce" });
      }
      t += CTA_LEAVE;
      base += 1.2;
    } else if (si < SONGS.length - 1) {
      t += TRANSITION;
    }
  });
  t += OUTRO_HOP;
  const fin: Hit = { ...place(t, base - 1.4), song: -1, i: 0, midi: -1, kind: "final" };
  hits.push(fin);
  return { HITS: hits, SPANS: spans, CTA_HIT: cta as unknown as Hit, FINAL_HIT: fin, DURATION: Math.ceil((t + OUTRO) * 10) / 10 };
})();

export const FRAMES = Math.round(DURATION * FPS);
