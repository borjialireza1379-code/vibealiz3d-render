// Timeline of v43 "The bank that came by mail" (Bank of Vernal, Utah, 1916): shots timed to the narration words
// (src/v43/vo.json, frames at 30 fps), story beats, and the camera grammar of the cartoon-3d-short skill: continuous
// slow push-ins, symmetric glides of 18-40 f, big reframes are cuts, impacts are 7-frame kicks that flip sign every
// frame. World convention: every set faces +z, lenses sit on the +z side looking toward -z, so +x = screen right.
export const FPS = 30;
export const TOTAL = 2028;
export const D0 = 0; // ground height (m)
export type V3 = [number, number, number];

// ---------------- places (world origins) ----------------
export const VER: V3 = [0, 0, 0];        // Vernal: the bank lot, front on z = 0, body toward -z
export const CITY: V3 = [-600, 0, 0];    // the big city: post office front on z = 0
export const FRE: V3 = [-622, 0, 0];     // freight office (city, left of the post office)
export const KILN: V3 = [-572, 0, -6];   // brickyard kiln (city, right of the post office)
export const INT: V3 = [0, 0, -600];     // post office interior: counter x -4..4, z 0..1 (local), top 1.05
export const RAIL: V3 = [-300, 0, 90];   // straight track along x
export const WAG: V3 = [-400, 0, 92];    // mountain road along x
export const BANK = { w: 7, d: 7, fl: 3.6, h: 8.1 }; // bank footprint + floor height + total height with parapet
export const SIGN_P: V3 = [CITY[0] + 3.0, 0, 3.6];   // postmaster at the rule sign; the sign stands 1.1 m to his right
export const ROUTE: [number, number][] = [[-566, 6], [-500, 44], [-462, -34], [-410, 58], [-356, -48], [-300, 34], [-246, -58], [-188, 24], [-120, -22], [-44, 4]];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
/** 0 before a, 1 after b */
export const ramp = (f: number, a: number, b: number) => clamp01((f - a) / (b - a));
/** scale pop on frame a: 0 -> 1.25 -> 1 over n frames */
export const pop = (f: number, a: number, n = 7) => { const u = (f - a) / n; return u <= 0 ? 0 : u >= 1 ? 1 : 1 + 0.32 * Math.sin(u * Math.PI) - (1 - u) ** 3; };
/** damped swing that settles on 0: amplitude 1 at f = a */
export const wobble = (f: number, a: number, hz = 2.2, decay = 3.2) => { const t = (f - a) / FPS; return t < 0 ? 1 : Math.exp(-decay * t) * Math.cos(2 * Math.PI * hz * t); };

// ---------------- word cues (frames) ----------------
export const W = {
  stamp: 29, notMoney: 94, bagToss: 103, actual: 122, building: 136,
  town: 170, banker: 235, tough: 256, bricks: 276, city: 301, problem: 318, mountains: 369,
  freight: 391, four: 419, times: 431, worth: 473, laughed: 508, goodLuck: 526, smiled: 603, walked: 622, office: 645,
  wrapped: 678, paper: 719, packed: 737, crate: 758, fifty: 784, heaviest: 808, take: 846,
  one: 888, hundred: 916, fifteen: 945, hundred2: 962,
  mailmen: 991, train: 1038, wagon: 1051, crazy: 1068, four2: 1096, long: 1125,
  guy: 1157, still: 1167, waiting: 1190, crawling: 1221,
  launched: 1296, parcel: 1328, price: 1367, weight: 1395, distance: 1413, inside: 1452,
  bricks2: 1505, cost: 1520, same: 1533, socks: 1576, half: 1607, price2: 1626,
  figured: 1678, happening: 1702, delivered: 1730, tons: 1751, bricks3: 1779,
  changed: 1809, rules: 1821, country: 1843, tooLate: 1867, standing: 1911, built: 1945, mailman: 1976,
};
/** hammer blows on the rule sign (frames) */
export const HITS = [W.changed, W.rules, W.country];

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type ShotDef = { id: number; a: number; b: number; light: Light; place: "ver" | "city" | "int" | "air" | "rail" | "wag"; fog?: [number, number]; sunAz?: number; sunEl?: number };
const cuts: [number, ShotDef["place"], Light?, [number, number]?][] = [
  [0, "ver", "day", [50, 520]], // 1 hook: the bank as a giant parcel, "Not money", the wrapping bursts off
  [160, "ver", "day", [90, 950]], // 2 the tiny desert town and its empty lot
  [229, "ver"],      // 3 the banker with one fired brick
  [285, "city"],     // 4 the city brickyard
  [312, "ver"],      // 5 "Problem?"
  [337, "air", "day", [120, 900]], // 6 the mountains between
  [385, "city"],     // 7 the freight company: four times the price
  [486, "city"],     // 8 the freight guy laughs
  [578, "city"],     // 9 the banker just smiles
  [618, "city"],     // 10 ...and walks into the post office
  [660, "int"],      // 11 wrapping every brick
  [732, "int"],      // 12 ten to a crate
  [770, "int"],      // 13 exactly fifty pounds
  [860, "int"],      // 14 one crate
  [905, "int"],      // 15 a hundred
  [930, "city", "day", [50, 520]], // 16 fifteen hundred
  [985, "city"],     // 17 mailmen hauling
  [1034, "rail"],    // 18 by train
  [1049, "wag"],     // 19 by wagon
  [1061, "air", "day", [140, 1100]], // 20 the crazy route
  [1140, "city"],    // 21 the freight guy, still laughing
  [1242, "city"],    // 22 the brand-new parcel service
  [1357, "int"],     // 23 weight
  [1407, "air", "day", [140, 1100]], // 24 distance
  [1432, "int"],     // 25 not what was inside the box
  [1480, "int"],     // 26 bricks = socks
  [1593, "int"],     // 27 less than half the freight price
  [1640, "city"],    // 28 the post office figures it out
  [1711, "ver", "day", [50, 520]], // 29 thirty-seven tons, delivered
  [1798, "city"],    // 30 the new rule
  [1862, "ver", "golden"], // 31 "Too late."
  [1885, "ver", "golden", [60, 520]], // 32 the bank still stands / built by the mailman
];
export const SHOTS: ShotDef[] = cuts.map(([a, place, light, fog], i) => ({ id: i + 1, a, b: i + 1 < cuts.length ? cuts[i + 1][0] : TOTAL, light: light ?? "day", place, fog, sunAz: 128 }));
SHOTS[28].sunAz = 165; SHOTS[30].sunAz = 28; SHOTS[30].sunEl = 9; SHOTS[31].sunAz = 150; SHOTS[31].sunEl = 13; // "Too late": backlit CU; the last wide: warm front light on the bank
/** crossfades (frames) at place/time changes: none (every change is a hard cut; one flash after the hook) */
export const XFADE: Record<number, number> = {};
export const FLASH_AT = 157;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
/** layers to draw at frame f: base shot, plus the next shot fading in during a crossfade */
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
/** camera ease: symmetric smootherstep */
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
/** push-in factor since f0: the subject grows ~rate per frame; `punch` raises it (8 f soft edges) for the first n frames */
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
/** dolly push: camera slides toward the look point by factor k */
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
/** zoom push (camera stays put): tan(fov/2) shrinks by k */
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });
const at = (o: V3, x: number, y: number, z: number): V3 => [o[0] + x, o[1] + y, o[2] + z];

// ---- story motion shared with the cast ----
export const BANKER_HOOK: V3 = [-2.1, 0, 14.2];
export const BANKER_LOT: V3 = [0.2, 0, 3.2];
export const FGUY: V3 = at(FRE, -0.75, 0, 3.4);
export const BANKER_FRE: V3 = at(FRE, 0.8, 0, 4.6);
/** x of the lead mailman in the hauling shot (17): 1.6 m/s toward +x */
export const haulX = (f: number) => CITY[0] - 2.4 + (1.6 * (f - 985)) / FPS;
export const trainX = (f: number) => RAIL[0] - 3 + (15 * (f - 1034)) / FPS;
export const wagonX = (f: number) => WAG[0] - 1.6 + (3.2 * (f - 1049)) / FPS;
/** the banker walking up to the post office door (shot 10): [x, y, z, gone] */
export const walkIn = (f: number): [number, number, number, boolean] => {
  const u = ramp(f, 618, 648);
  return [CITY[0] - 2.3 + 2.3 * u, 0.5 * smooth((u - 0.45) / 0.45), 3.0 - 2.7 * u, f >= 650];
};
export const doorOpen = (f: number) => smooth(ramp(f, 634, 643)) * (1 - smooth(ramp(f, 651, 658)));
export const PM: V3 = at(CITY, 0, 0.5, 1.5); // postmaster on the top step

const CAMS: Record<number, Key[]> = {
  // 1 hook: fast push toward the giant parcel past the banker; CU "Not money"; wide for the unwrapping
  1: [
    { f: 0, s: () => ({ pos: [-3.0, 1.2, 26], look: [0.4, 4.5, 0], fov: 46 }) },
    { f: 1, dur: 40, s: (f) => dolly([-2.75, 1.35, 18.4], [0.4, 4.3, 0], pushK(f, 36, 0.0022), { fov: 44, roll: -0.03 }) },
    { f: W.notMoney - 2, cut: true, s: (f) => dolly([-1.72, 1.72, 17.1], [-2.02, 1.62, 14.2], pushK(f, 92, 0.003), { fov: 34, roll: 0.03 }) },
    { f: 114, cut: true, s: (f) => dolly([3.8, 1.9, 24], [0, 4.2, 0], pushK(f, 114, 0.0035, 0.008, 30), { fov: 46 }) },
  ],
  2: [{ f: 160, s: (f) => zoom([20, 19, 47], [0, 2.4, -2], 44, pushK(f, 160, 0.0022)) }],
  3: [
    { f: 229, s: (f) => dolly([1.0, 1.62, 7.9], [0.25, 1.46, 3.2], pushK(f, 229, 0.0022), { fov: 38 }) },
    { f: 250, dur: 20, s: (f) => dolly([0.75, 1.72, 6.6], [0.42, 1.66, 3.2], pushK(f, 250, 0.002, 0.006, 26), { fov: 36, roll: 0.035 }) },
  ],
  4: [{ f: 285, s: (f) => dolly(at(KILN, -5.5, 2.2, 23), at(KILN, -0.5, 3.4, 0), pushK(f, 285, 0.004), { fov: 44 }) }],
  5: [{ f: 312, s: (f) => dolly([0.6, 1.74, 5.9], [0.22, 1.67, 3.2], pushK(f, 312, 0.0045), { fov: 30, roll: -0.04 }) }],
  6: [
    { f: 337, s: () => ({ pos: [30, 14, 70], look: [-300, 34, 0], fov: 46 }) },
    { f: 338, dur: 46, s: () => ({ pos: [-70, 118, 118], look: [-450, 0, -6], fov: 44 }) },
  ],
  7: [
    { f: 385, s: (f) => dolly(at(FRE, 0.25, 1.5, 11.6), at(FRE, 0.1, 1.32, 3.3), pushK(f, 385, 0.002), { fov: 40 }) },
    { f: 409, dur: 20, s: (f) => dolly(at(FRE, 0.4, 1.5, 11.0), at(FRE, 0.24, 1.36, 3.2), pushK(f, 409, 0.0018, 0.004, 30), { fov: 40, roll: -0.03 }) },
  ],
  8: [
    { f: 486, s: (f) => dolly(at(FGUY, 0.3, 1.72, 2.7), at(FGUY, 0, 1.6, 0), pushK(f, 486, 0.003), { fov: 32, roll: 0.03 }) },
    { f: 522, cut: true, s: (f) => dolly(at(FRE, 0.2, 1.45, 10.4), at(FRE, 0.05, 1.3, 3.8), pushK(f, 522, 0.0025), { fov: 40 }) },
  ],
  9: [{ f: 578, s: (f) => dolly(at(BANKER_FRE, 0.3, 1.74, 2.7), at(BANKER_FRE, 0, 1.65, 0), pushK(f, 578, 0.004), { fov: 30, roll: -0.03 }) }],
  10: [{ f: 618, s: (f) => zoom(at(CITY, 0.8, 1.55, 11.6), at(CITY, 0, 2.7, 0), 46, pushK(f, 618, 0.0022)) }],
  11: [{ f: 660, s: (f) => dolly(at(INT, 0, 2.0, 3.95), at(INT, 0, 1.2, 0.5), pushK(f, 660, 0.0024), { fov: 38 }) }],
  12: [{ f: 732, s: (f) => dolly(at(INT, 0.2, 1.95, 3.8), at(INT, -0.2, 1.27, 0.5), pushK(f, 732, 0.003), { fov: 38, roll: 0.03 }) }],
  13: [
    { f: 770, s: (f) => dolly(at(INT, -0.25, 1.72, 4.4), at(INT, 0.12, 1.62, 0.4), pushK(f, 770, 0.002), { fov: 38 }) },
    { f: 800, dur: 22, s: (f) => dolly(at(INT, 0.2, 1.9, 3.6), at(INT, 0.27, 1.92, 0.2), pushK(f, 800, 0.002), { fov: 34, roll: -0.03 }) },
  ],
  14: [{ f: 860, s: (f) => dolly(at(INT, 0.3, 1.78, 3.6), at(INT, 0.12, 1.36, 0.4), pushK(f, 860, 0.0028, 0.007, 20), { fov: 36 }) }],
  15: [{ f: 905, s: (f) => zoom(at(INT, 0.3, 1.3, 10.2), at(INT, 0, 3.7, 1.6), 50, pushK(f, 905, 0.003)) }],
  16: [
    { f: 930, s: (f) => dolly(at(CITY, -3.5, 1.4, 27), at(CITY, 5.5, 4.4, 7), pushK(f, 930, 0.002), { fov: 46 }) },
    { f: 944, dur: 36, s: () => ({ pos: at(CITY, -6.5, 3.2, 36), look: at(CITY, 5.5, 4.8, 7), fov: 46, roll: 0.02 }) },
  ],
  17: [{ f: 985, s: (f) => { const x = haulX(f) - 1.1; return dolly([x + 0.35, 1.45, 11.6], [x, 1.22, 4.6], pushK(f, 985, 0.0015), { fov: 40 }); } }],
  18: [{ f: 1034, s: (f) => zoom(at(RAIL, 0.5, 1.5, 17), at(RAIL, 0.5, 2.8, 0), 50, pushK(f, 1034, 0.003)) }],
  19: [{ f: 1049, s: (f) => { const x = wagonX(f); return dolly([x + 1.7, 1.25, WAG[2] + 11.5], [x + 2.0, 1.6, WAG[2]], pushK(f, 1049, 0.003), { fov: 44, roll: 0.03 }); } }],
  20: [
    { f: 1061, s: () => ({ pos: [-660, 105, 120], look: [-500, 0, 0], fov: 44 }) },
    { f: 1063, dur: 77, s: () => ({ pos: [-300, 215, 205], look: [-235, 0, -6], fov: 44 }) },
  ],
  21: [
    { f: 1140, s: (f) => dolly(at(FRE, 0.5, 1.3, 9.4), at(FRE, -0.35, 1.1, 3.4), pushK(f, 1140, 0.0025), { fov: 40 }) },
    { f: 1164, cut: true, s: (f) => dolly(at(FGUY, 0.25, 1.45, 2.6), at(FGUY, 0, 1.3, 0), pushK(f, 1164, 0.003), { fov: 32, roll: 0.035 }) },
    { f: 1188, cut: true, s: (f) => dolly(at(FRE, 1.9, 1.25, 11.8), at(FRE, 0.5, 1.25, 3.5), pushK(f, 1188, 0.002), { fov: 42 }) },
  ],
  22: [
    { f: 1242, s: (f) => zoom(at(CITY, 0.7, 1.5, 13.2), at(CITY, 0, 3.4, 0), 46, pushK(f, 1242, 0.0015)) },
    { f: 1286, dur: 24, s: (f) => zoom(at(CITY, 0.35, 1.6, 10.6), at(CITY, 0, 4.2, 0), 40, pushK(f, 1286, 0.0016, 0.005, 30)) },
  ],
  23: [{ f: 1357, s: (f) => dolly(at(INT, 0.3, 1.86, 3.3), at(INT, 0.2, 1.8, 0.3), pushK(f, 1357, 0.003), { fov: 36 }) }],
  24: [{ f: 1407, s: (f) => zoom([-300, 215, 205], [-235, 0, -6], 44, pushK(f, 1407, 0.004)) }],
  25: [{ f: 1432, s: (f) => dolly(at(INT, 0.35, 1.76, 3.2), at(INT, 0.24, 1.45, -0.1), pushK(f, 1432, 0.003), { fov: 36, roll: 0.03 }) }],
  26: [
    { f: 1480, s: (f) => dolly(at(INT, 0, 1.95, 6.3), at(INT, 0, 1.8, 0.5), pushK(f, 1480, 0.0018), { fov: 40 }) },
    { f: 1524, dur: 20, s: (f) => dolly(at(INT, 0.12, 1.92, 5.7), at(INT, 0, 1.8, 0.5), pushK(f, 1524, 0.0016), { fov: 40, roll: -0.03 }) },
  ],
  27: [{ f: 1593, s: (f) => dolly(at(INT, 0, 1.72, 4.3), at(INT, 0, 1.5, 0.3), pushK(f, 1593, 0.003, 0.006, 24), { fov: 38 }) }],
  28: [
    { f: 1640, s: (f) => dolly(at(PM, 0.45, 1.72, 3.0), at(PM, 0, 1.64, 0), pushK(f, 1640, 0.003), { fov: 32 }) },
    { f: W.happening - 5, cut: true, s: (f) => dolly(at(PM, 0.3, 1.7, 2.1), at(PM, 0, 1.66, 0), pushK(f, 1697, 0.004), { fov: 28, roll: -0.04 }) },
  ],
  29: [
    { f: 1711, s: (f) => dolly([-5.2, 1.5, 15.5], [0.6, 2.6, 1], pushK(f, 1711, 0.0025), { fov: 44 }) },
    { f: 1738, dur: 32, s: () => ({ pos: [-8.5, 5.6, 25], look: [0.6, 3.2, 0], fov: 46, roll: 0.02 }) },
  ],
  30: [{ f: 1798, s: (f) => zoom(at(SIGN_P, 2.05, 1.6, 5.05), at(SIGN_P, 0.45, 1.3, -0.35), 42, pushK(f, 1798, 0.0025, 0.004, 24)) }],
  31: [{ f: 1862, s: (f) => dolly([-0.5, 1.74, 11.7], [-0.8, 1.66, 9], pushK(f, 1862, 0.004), { fov: 30, roll: 0.03 }) }],
  32: [
    { f: 1885, s: (f) => dolly([3.4, 1.15, 21.5], [0, 4.2, 0], pushK(f, 1885, 0.0028), { fov: 46 }) },
    { f: 1940, cut: true, s: (f) => dolly([0.75, 1.6, 14.4], [1.2, 1.45, 10.5], pushK(f, 1940, 0.003), { fov: 36 }) },
    { f: 1984, cut: true, s: (f): Shot => { // crane out on a curve to the last wide
      const a: Shot = dolly([0.75, 1.6, 14.4], [1.2, 1.45, 10.5], pushK(1984, 1940, 0.003)), s = glide((f - 1984) / 44), r = 1 - s;
      const C: V3 = [-1, 7, 20], B: V3 = [-5.5, 8.2, 33], L: V3 = [0, 3.9, 0];
      return { pos: [0, 1, 2].map((i) => r * r * a.pos[i] + 2 * s * r * C[i] + s * s * B[i]) as V3,
        look: [0, 1, 2].map((i) => a.look[i] + (L[i] - a.look[i]) * s) as V3, fov: 36 + 8 * s, roll: 0 };
    } },
  ],
};

// impact kicks: the image offset flips sign every frame (~3 px at 720p per unit) and decays to 0 in 7 f
const KICKS: [number, number][] = [[W.stamp, 1.3], [W.actual, 1.6], [W.four, 0.6], [W.times, 0.8], [760, 0.7], [778, 1.0], [W.one, 1.1], [W.hundred, 1.2],
  [W.fifteen, 1.0], [W.hundred2, 1.6], [W.launched, 0.9], [W.weight, 0.6], [W.inside, 1.0], [W.half, 0.7], [W.happening, 1.0], [W.tons, 1.3],
  [W.changed, 0.5], [W.rules, 0.5], [W.country, 0.7]];
export const kickAt = (f: number) => {
  let a = 0;
  for (const [f0, g] of KICKS) { const n = f - f0; if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5; }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(f);
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a; // metres at the look distance for 3 px x a
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};

// ---------------- lens: depth of field ----------------
/** cInf = blur-disc radius in px at 1080x1920 for things at infinity; 0 = all sharp. focus = world point (else the look point). */
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 0 },                                              // hook wide: the parcel must read
  { f: W.notMoney - 2, cInf: 14 },                                // banker CU
  { f: 114, cInf: 0 },                                            // unwrapping, town aerial
  { f: 229, cInf: 11 },                                           // banker + brick
  { f: 285, cInf: 0 },                                            // brickyard
  { f: 312, cInf: 14 },                                           // "Problem?"
  { f: 337, cInf: 0 },                                            // mountains
  { f: 385, cInf: 8 },                                            // freight office
  { f: 486, cInf: 14 }, { f: 522, cInf: 8 }, { f: 578, cInf: 14 }, // laugh CU, two-shot, smile CU
  { f: 618, cInf: 0 },                                            // post office front
  { f: 660, cInf: 9 }, { f: 770, cInf: 8 }, { f: 860, cInf: 9 },  // counter work
  { f: 905, cInf: 0 },                                            // hundred, fifteen hundred
  { f: 985, cInf: 10, focus: (f) => [haulX(f) - 1.1, 1.4, 4.6] }, // mailmen
  { f: 1034, cInf: 0 },                                           // train, wagon, route
  { f: 1140, cInf: 7 }, { f: 1164, cInf: 14 }, { f: 1188, cInf: 6 }, // freight guy
  { f: 1242, cInf: 0 },                                           // parcel service banner
  { f: 1357, cInf: 9 }, { f: 1407, cInf: 0 }, { f: 1432, cInf: 9 }, // weight, distance, the box
  { f: 1480, cInf: 6 }, { f: 1593, cInf: 7 },                     // balance, coins
  { f: 1640, cInf: 13 }, { f: 1711, cInf: 0 },                    // postmaster CU, Vernal heap
  { f: 1798, cInf: 10, focus: () => [SIGN_P[0], 1.6, SIGN_P[2]] }, // the rule sign
  { f: 1862, cInf: 14 }, { f: 1885, cInf: 0 },                    // "Too late", the bank
  { f: 1940, cInf: 9 }, { f: 1984, dur: 30, cInf: 0 },            // the mailman, crane out
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
