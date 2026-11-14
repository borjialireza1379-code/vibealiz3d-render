// v43 cast outfits + extra flat drawings (horse, cobweb, tumbleweed, socks, the rule sign, the parcel banner mark).
import { Pen, Outfit, INK, SKINS, bag2D } from "./toon";

type P2 = [number, number];
const rad = (d: number) => (d * Math.PI) / 180;
const rr = (x0: number, y0: number, x1: number, y1: number, r: number, n = 8): P2[] => {
  const pts: P2[] = [];
  for (const [cx, cy, a] of [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]])
    for (let i = 0; i <= n; i++) pts.push([cx + r * Math.cos(rad(a + (90 * i) / n)), cy + r * Math.sin(rad(a + (90 * i) / n))]);
  return pts;
};

export const BANKER: Outfit = { jacket: "#3b4466", pants: "#2c3044", boots: INK, hat: "tophat", moustache: "#3a2a20", buttons: "#e8c45a" };
export const FREIGHT: Outfit = { jacket: "#a5562f", pants: "#4a3b2f", boots: "#3a2a1c", hat: "cap", cap: "#6b4a2f", moustache: "#2a201a", build: "stout", skin: SKINS[1], buttons: "#e9d9b0" };
export const CLERK: Outfit = { jacket: "#f1ece0", pants: "#3b3f52", boots: INK, hat: "cap", cap: "#2f8a4f", buttons: "#3b3f52", skin: SKINS[2] };
export const POSTMASTER: Outfit = { jacket: "#27365e", pants: "#222c4c", boots: INK, hat: "cap", cap: "#1f2b4d", moustache: "#d9d4c8", build: "stout", buttons: "#e8c45a", sash: "#e8c45a" };
export const mailman = (v = 0): Outfit => ({ jacket: "#3f6fb5", pants: "#34507f", boots: INK, hat: "cap", cap: "#2c4a86", buttons: "#e8c45a", belt: "#8a5a34", skin: SKINS[v % 4], ...(v % 3 === 1 ? { moustache: "#4a3426" } : {}) });

/** money sack alone on a 300 x 300 canvas */
export const fxBag = (p: Pen) => bag2D(p, 150, 160, 105);

/** draught horse, side-on facing right, on a 900 x 700 canvas (hooves at y 660); phase 0..1 = walk cycle */
export const fxHorse = (p: Pen, phase: number) => {
  const coat = "#9a6a44", dark = "#5a3b28", two = Math.PI * 2;
  const leg = (hx: number, ph: number, far: boolean) => {
    const s = Math.sin(two * (phase + ph)), lift = Math.max(0, Math.cos(two * (phase + ph))) * 36;
    const k: P2 = [hx + 26 * s, 520 - lift * 0.4], f: P2 = [hx + 62 * s, 650 - lift];
    p.stroke([[hx, 400], k, f], 34, INK); p.stroke([[hx, 400], k, f], 22, far ? dark : coat);
    p.poly(rr(f[0] - 22, f[1] - 4, f[0] + 26, f[1] + 16, 6), "#2a201a", 0);
  };
  leg(250, 0.5, true); leg(590, 0.0, true);
  p.stroke([[190, 300], [120, 380], [110, 480]], 30, INK); p.stroke([[190, 300], [120, 380], [110, 480]], 18, dark); // tail
  p.poly([[560, 300], [640, 150], [735, 120], [770, 190], [690, 330]], coat, 12);                                         // neck
  p.ell(420, 350, 250, 118, coat, 12);                                                                                    // body
  p.poly([[700, 110], [790, 86], [876, 176], [862, 226], [790, 232], [706, 190]], coat, 12);                              // head
  p.poly([[716, 112], [728, 50], [760, 98]], coat, 10);                                                                   // ear
  p.stroke([[650, 130], [600, 220], [570, 300]], 30, dark);                                                               // mane
  p.dot(800, 150, 9); p.dot(862, 196, 5);
  p.stroke([[786, 222], [826, 216]], 5);
  p.band([[610, 250], [600, 440]], "#3a2a1c", 20, 4);                                                                     // collar
  p.band([[600, 380], [190, 400]], "#3a2a1c", 12, 3);                                                                     // trace
  leg(270, 0.0, false); leg(610, 0.5, false);
};

/** dusty cobweb in a corner, 300 x 300 canvas (anchor = top-left corner) */
export const fxCobweb = (p: Pen) => {
  const col = "#f2f0ea";
  for (const a of [4, 26, 48, 70, 88]) { const e: P2 = [280 * Math.cos(rad(a)), 280 * Math.sin(rad(a))]; p.stroke([[4, 4], e], 9, INK); p.stroke([[4, 4], e], 4.5, col); }
  for (const r of [80, 150, 220]) {
    const pts: P2[] = [];
    for (let a = 4; a <= 88; a += 6) { const k = r * (1 - 0.07 * Math.abs(Math.sin(rad((a - 4) * 4.1)))); pts.push([k * Math.cos(rad(a)), k * Math.sin(rad(a))]); }
    p.stroke(pts, 8, INK); p.stroke(pts, 4, col);
  }
};

/** tumbleweed on a 300 x 300 canvas */
export const fxTumble = (p: Pen) => {
  p.ell(150, 150, 118, 112, "#c9a36a", 10);
  for (let i = 0; i < 9; i++) {
    const a = i * 0.7, r = 40 + (i % 3) * 26;
    p.arc(150 + 18 * Math.cos(a * 2.3), 150 + 18 * Math.sin(a * 1.7), r, r * 0.8, i * 47, i * 47 + 210, 6, "#7a5a34");
  }
};

/** a heap of socks spilling over a crate top: 520 x 300 canvas, base line y = 290 */
export const fxSocks = (p: Pen) => {
  const cols = ["#e2453c", "#3f6fb5", "#f3d35a", "#2f8a4f", "#8c5ac9", "#f08a2c", "#f7f1e1"];
  const sock = (x: number, y: number, a: number, c: string, stripe: string) => {
    p.rot = [rad(a), x, y];
    p.poly([[x - 26, y - 130], [x + 26, y - 130], [x + 26, y - 4], [x + 74, y], [x + 86, y + 22], [x + 70, y + 40], [x - 26, y + 40]] as P2[], c, 9);
    p.poly(rr(x - 30, y - 138, x + 30, y - 104, 8), stripe, 8);
    p.rot = null;
  };
  const spots: [number, number, number][] = [[80, 190, -34], [150, 150, -12], [230, 120, 6], [310, 150, 22], [390, 190, 40], [190, 210, -58], [330, 220, 64], [260, 200, 4]];
  spots.forEach(([x, y, a], i) => sock(x, y, a, cols[i % 7], cols[(i + 3) % 7]));
};

/** text-free rule sign on a 700 x 520 canvas: a brick wall being mailed (wall + postage stamp), crossed out in red */
export const fxRuleSign = (p: Pen) => {
  p.poly(rr(14, 14, 686, 506, 40), "#f6ecd2", 0);
  p.poly(rr(14, 14, 686, 506, 40), null, 14);
  for (let row = 0; row < 5; row++) for (let i = 0; i < 5; i++) {
    const x = 120 + i * 92 + (row % 2) * 46 - 23, y = 150 + row * 52;
    if (x < 96 || x + 86 > 606) continue;
    p.poly(rr(x, y, x + 86, y + 46, 6), "#c4573a", 7);
  }
  p.poly(rr(470, 60, 610, 190, 8), "#f7f1e1", 9);          // a postage stamp on the wall
  p.ell(540, 125, 34, 40, "#3f6fb5", 7);
  for (const [a, b] of [[[96, 70], [604, 452]], [[604, 70], [96, 452]]] as [P2, P2][]) { p.stroke([a, b], 58, "#ffffff"); p.stroke([a, b], 42, "#d42f2f"); }
};
