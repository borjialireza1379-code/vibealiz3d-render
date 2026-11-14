// v43 sets and moving props: Vernal (desert street + the bank in every state), the city (post office, freight
// office, brickyard), the post office interior (counter, scale, balance), the mountains, rail and wagon road.
// Everything is built from boxes / quads with painted canvas textures and two-tone materials (build.ts lam()).
// Sets face +z (lenses sit on the +z side). Props.pose(id, f) puts every moving piece where frame f wants it.
import * as THREE from "three";
import { Batch, boxGeo, quad, tri, V, lam, house } from "./build";
import { ctex, rep, rng, brick, stoneHD, cobbleHD, beamHD, planksHD, facadeHD } from "./paint";
import { Pen } from "./toon";
import { fxRuleSign } from "./toon2";
import { VER, CITY, FRE, KILN, INT, RAIL, WAG, BANK, SIGN_P, ROUTE, FGUY, W, V3, ramp, smooth, wobble, clamp01, doorOpen, trainX, wagonX } from "./story";

const M4 = (x: number, y: number, z: number, ry = 0, s = 1) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), ry), V(s, s, s));
const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const facet = (g: THREE.BufferGeometry) => { const n = g.index ? g.toNonIndexed() : g; n.computeVertexNormals(); return n; };
/** horizontal quad facing up at height y covering x0..x1, z0..z1, texture tiled every `tile` metres */
const floorQ = (x0: number, x1: number, z0: number, z1: number, y: number, tile: number) =>
  quad(V(x0, y, z1), V(x1, y, z1), V(x1, y, z0), V(x0, y, z0), (x1 - x0) / tile, (z1 - z0) / tile);
/** box given by centre x/z, base y and sizes */
const bx = (cx: number, y0: number, cz: number, w: number, h: number, d: number, tile = 0) => boxGeo(V(cx - w / 2, y0, cz - d / 2), V(cx + w / 2, y0 + h, cz + d / 2), tile, true);

// ---------------- painted textures ----------------
const sandTex = () => ctex("sand43", 1024, 1024, (g, r) => {
  g.fillStyle = "#e6c48c"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 260; i++) { // soft wind ripples and darker patches
    const x = r() * 1024, y = r() * 1024, w = 60 + r() * 180;
    g.strokeStyle = r() < 0.5 ? "rgba(190,140,90,0.16)" : "rgba(255,236,196,0.22)"; g.lineWidth = 3 + r() * 5; g.lineCap = "round";
    for (const ox of [-1024, 0, 1024]) { g.beginPath(); g.moveTo(x + ox, y); g.quadraticCurveTo(x + ox + w / 2, y - 10 - r() * 8, x + ox + w, y); g.stroke(); }
  }
  for (let i = 0; i < 500; i++) { g.fillStyle = r() < 0.5 ? "rgba(150,105,70,0.28)" : "rgba(255,240,205,0.3)"; g.fillRect(r() * 1024, r() * 1024, 3 + r() * 4, 2 + r() * 3); }
});
const dirtTex = () => ctex("dirt43", 512, 512, (g, r) => {
  g.fillStyle = "#c99f6e"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 40; i++) { const y = r() * 512; g.strokeStyle = "rgba(120,80,50,0.22)"; g.lineWidth = 4 + r() * 6; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(170, y + 14 - r() * 28, 340, y - 14 + r() * 28, 512, y); g.stroke(); }
  for (let i = 0; i < 160; i++) { g.fillStyle = "rgba(110,75,50,0.25)"; g.fillRect(r() * 512, r() * 512, 4 + r() * 5, 2 + r() * 3); }
});
/** pale clapboard siding (tinted by the material colour): boards 0.25 m at a 2 m tile */
const sidingTex = () => ctex("siding43", 512, 512, (g, r) => {
  g.fillStyle = "#f4efe4"; g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 64) {
    g.fillStyle = "rgba(60,40,30,0.5)"; g.fillRect(0, y, 512, 5);
    g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(0, y + 5, 512, 5);
    for (let i = 0; i < 5; i++) { g.fillStyle = "rgba(90,60,40,0.10)"; g.fillRect(r() * 512, y + 14 + r() * 40, 60 + r() * 120, 3); }
    g.fillStyle = "rgba(60,40,30,0.4)"; g.fillRect((y * 3.1) % 512, y, 4, 64);
  }
});
const crateTex = () => ctex("crate43", 256, 256, (g) => {
  g.fillStyle = "#cf9a5c"; g.fillRect(0, 0, 256, 256);
  g.fillStyle = "rgba(110,70,35,0.55)"; for (const y of [82, 170]) g.fillRect(0, y, 256, 7);
  g.fillStyle = "rgba(140,95,50,0.25)"; for (let y = 10; y < 256; y += 22) g.fillRect(0, y, 256, 3);
  g.fillStyle = "#a87442"; g.fillRect(0, 0, 256, 26); g.fillRect(0, 230, 256, 26); g.fillRect(0, 0, 26, 256); g.fillRect(230, 0, 26, 256);
  g.fillStyle = "rgba(60,35,20,0.6)"; for (const [x, y] of [[13, 13], [243, 13], [13, 243], [243, 243]]) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
});
const parcelTex = () => ctex("parcel43", 128, 128, (g) => {
  g.fillStyle = "#c9a070"; g.fillRect(0, 0, 128, 128);
  g.fillStyle = "rgba(255,240,210,0.25)"; g.fillRect(0, 0, 128, 18);
  g.fillStyle = "#5a3b28"; g.fillRect(58, 0, 12, 128); g.fillRect(0, 58, 128, 12);
});
/** the bank as a parcel: brown paper, twine, stamps, an address label */
const paperTex = () => ctex("paper43", 1024, 1160, (g, r) => {
  g.fillStyle = "#c9a070"; g.fillRect(0, 0, 1024, 1160);
  for (let i = 0; i < 60; i++) { // creases
    const x = r() * 1024, y = r() * 1160, a = r() * 6.3, l = 80 + r() * 260;
    g.strokeStyle = r() < 0.5 ? "rgba(120,80,45,0.28)" : "rgba(255,236,200,0.3)"; g.lineWidth = 3 + r() * 3;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  g.fillStyle = "rgba(90,55,30,0.18)"; g.fillRect(0, 0, 1024, 40); g.fillRect(0, 1120, 1024, 40); g.fillRect(0, 0, 36, 1160); g.fillRect(988, 0, 36, 1160);
  // twine cross with a knot
  for (const [x, y, w, h] of [[486, 0, 52, 1160], [0, 610, 1024, 52]]) { g.fillStyle = "#3a2618"; g.fillRect(x, y, w, h); g.fillStyle = "#8a6238"; g.fillRect(x + 9, y + 9, w - 18, h - 18); }
  g.fillStyle = "#8a6238"; g.strokeStyle = "#3a2618"; g.lineWidth = 12;
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(512 + s * 78, 590, 74, 40, s * 0.5, 0, 7); g.fill(); g.stroke(); }
  g.beginPath(); g.arc(512, 636, 40, 0, 7); g.fill(); g.stroke();
  // address label
  g.fillStyle = "#f7f1e1"; g.strokeStyle = "#3a2618"; g.lineWidth = 10; g.beginPath(); g.rect(120, 760, 330, 220); g.fill(); g.stroke();
  g.lineCap = "round"; g.strokeStyle = "#3a3d47"; g.lineWidth = 12;
  for (const [y, w] of [[820, 230], [870, 190], [920, 250]]) { g.beginPath(); g.moveTo(160, y); g.lineTo(160 + w, y); g.stroke(); }
  // a row of postage stamps (top right)
  ["#c8323a", "#3f6fb5", "#2f8a4f", "#c8323a"].forEach((c, i) => {
    const x = 600 + (i % 2) * 190, y = 90 + Math.floor(i / 2) * 230;
    g.fillStyle = "#f7f1e1"; g.strokeStyle = "#3a2618"; g.lineWidth = 9; g.beginPath(); g.rect(x, y, 160, 200); g.fill(); g.stroke();
    g.fillStyle = c; g.fillRect(x + 18, y + 18, 124, 164);
    g.fillStyle = "#f7f1e1"; g.beginPath(); g.ellipse(x + 80, y + 100, 38, 52, 0, 0, 7); g.fill();
  });
});
/** round postmark with wavy cancel lines (cut-out) */
const markTex = () => ctex("mark43", 512, 512, (g) => {
  g.strokeStyle = "#b3202a"; g.lineCap = "round";
  g.lineWidth = 26; g.beginPath(); g.arc(200, 256, 150, 0, 7); g.stroke();
  g.lineWidth = 12; g.beginPath(); g.arc(200, 256, 108, 0, 7); g.stroke();
  g.fillStyle = "#b3202a"; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * Math.PI * 2) / 5; g.beginPath(); g.arc(200 + 60 * Math.cos(a), 256 + 60 * Math.sin(a), 15, 0, 7); g.fill(); }
  g.beginPath(); g.arc(200, 256, 22, 0, 7); g.fill();
  g.lineWidth = 20; for (const y of [176, 230, 284, 338]) { g.beginPath(); g.moveTo(330, y); g.bezierCurveTo(380, y - 34, 430, y + 34, 496, y); g.stroke(); }
});
const signTex = (key: string, text: string, bg: string, fg: string, w = 1024, h = 160) => ctex("sign43" + key, w, h, (g) => {
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(14, 14, w - 28, h - 28);
  g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = `bold ${Math.round(h * 0.56)}px Georgia, "Times New Roman", serif`;
  g.fillText(text, w / 2, h / 2 + h * 0.03, w - 80);
});
const dialTex = () => ctex("dial43", 512, 512, (g) => {
  g.fillStyle = "#f7f1e1"; g.beginPath(); g.arc(256, 256, 250, 0, 7); g.fill();
  const pt = (v: number, R: number): [number, number] => { const a = 2.1 - (4.2 * v) / 50; return [256 - R * Math.sin(a), 256 - R * Math.cos(a)]; };
  g.strokeStyle = "#d42f2f"; g.lineWidth = 34; g.beginPath(); // red zone above the limit
  for (let v = 46; v <= 50.01; v += 0.5) { const [x, y] = pt(v, 196); if (v === 46) g.moveTo(x, y); else g.lineTo(x, y); }
  g.stroke();
  g.strokeStyle = "#241726"; g.lineCap = "round";
  for (let v = 0; v <= 50; v += 2) { const big = v % 10 === 0, [x0, y0] = pt(v, big ? 172 : 186), [x1, y1] = pt(v, 212); g.lineWidth = big ? 12 : 6; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
  g.fillStyle = "#241726"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = "bold 46px Georgia, serif";
  for (let v = 0; v <= 50; v += 10) { const [x, y] = pt(v, 132); g.fillText(String(v), x, y); }
  g.font = "bold 34px Georgia, serif"; g.fillText("LBS", 256, 372);
  g.lineWidth = 16; g.beginPath(); g.arc(256, 256, 242, 0, 7); g.stroke();
});
const flagTex = () => ctex("flag43", 380, 220, (g) => {
  for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? "#f4f0e6" : "#c8323a"; g.fillRect(0, (i * 220) / 13, 380, 220 / 13 + 1); }
  g.fillStyle = "#2c4a86"; g.fillRect(0, 0, 160, 119);
  g.fillStyle = "#f4f0e6"; for (let r = 0; r < 6; r++) for (let c = 0; c < 8; c++) { g.beginPath(); g.arc(12 + c * 19.5, 12 + r * 19, 4.5, 0, 7); g.fill(); }
});
/** the parcel-service banner: a tied parcel with a stamp, stars, red border */
const bannerTex = () => ctex("banner43", 520, 640, (g) => {
  g.fillStyle = "#f7f1e1"; g.fillRect(0, 0, 520, 640);
  g.strokeStyle = "#c8323a"; g.lineWidth = 26; g.strokeRect(13, 13, 494, 614);
  g.strokeStyle = "#2c4a86"; g.lineWidth = 8; g.strokeRect(40, 40, 440, 560);
  g.fillStyle = "#2c4a86"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = "bold 62px Georgia, serif";
  g.fillText("PARCEL", 260, 110); g.fillText("POST", 260, 180);
  g.lineJoin = "round"; g.strokeStyle = "#241726"; g.lineWidth = 14;
  g.fillStyle = "#c9a070"; g.beginPath(); g.rect(130, 260, 260, 210); g.fill(); g.stroke();
  g.fillStyle = "#5a3b28"; g.fillRect(246, 260, 28, 210); g.fillRect(130, 350, 260, 28);
  g.fillStyle = "#f7f1e1"; g.beginPath(); g.rect(318, 278, 54, 60); g.fill(); g.lineWidth = 7; g.stroke();
  g.fillStyle = "#c8323a"; g.fillRect(328, 288, 34, 40);
  g.fillStyle = "#c8323a";
  for (const x of [130, 260, 390]) { g.beginPath(); for (let k = 0; k < 10; k++) { const R = k % 2 ? 13 : 32, a = (k * Math.PI) / 5 - Math.PI / 2; g.lineTo(x + R * Math.cos(a), 545 + R * Math.sin(a)); } g.closePath(); g.fill(); }
});
/** post office back wall: plaster, wainscot, a pigeonhole cabinet, a clock */
const poWallTex = () => ctex("poWall43", 2048, 1280, (g, r) => {
  const M = 2048 / 18, Y = (m: number) => 1280 - m * M, X = (m: number) => 1024 + m * M; // metres -> px (wall 18 x 11.25 m)
  g.fillStyle = "#a9c4b4"; g.fillRect(0, 0, 2048, 1280);                               // sage plaster
  for (let x = 0; x < 2048; x += 2 * M) { g.fillStyle = "rgba(255,255,255,0.10)"; g.fillRect(x, 0, M, 1280); } // soft stripes
  g.fillStyle = "#8a5f3c"; g.fillRect(0, Y(1.25), 2048, 1.25 * M);                     // wainscot
  g.fillStyle = "#6e4a2e"; g.fillRect(0, Y(1.33), 2048, 0.1 * M);
  for (let x = 0; x < 2048; x += 0.5 * M) { g.fillStyle = "rgba(50,30,20,0.3)"; g.fillRect(x, Y(1.23), 5, 1.23 * M); }
  // pigeonhole cabinet: 6.6 m wide, from 1.45 m to 3.95 m, cubbies 0.44 x 0.4 m
  g.fillStyle = "#6e4a2e"; g.fillRect(X(-3.4), Y(4.05), 6.8 * M, 2.7 * M);
  for (let row = 0; row < 6; row++) for (let c = 0; c < 15; c++) {
    const x = X(-3.3 + c * 0.44), y = Y(3.95 - row * 0.41), w = 0.38 * M, h = 0.34 * M;
    g.fillStyle = "#33241e"; g.fillRect(x, y, w, h);
    if (r() < 0.72) { g.fillStyle = r() < 0.5 ? "#f7f1e1" : "#e9d9a8"; const ly = y + h * (0.35 + 0.25 * r()); g.fillRect(x + 5, ly, w - 10, h - (ly - y)); g.fillStyle = "rgba(60,40,30,0.45)"; g.fillRect(x + 5, ly + 7, w - 10, 3); }
  }
  // wall clock (right) and a framed notice (left)
  g.fillStyle = "#f7f1e1"; g.strokeStyle = "#3a2a22"; g.lineWidth = 16; g.beginPath(); g.arc(X(4.6), Y(3.2), 0.55 * M, 0, 7); g.fill(); g.stroke();
  g.lineCap = "round"; g.lineWidth = 12; g.beginPath(); g.moveTo(X(4.6), Y(3.2)); g.lineTo(X(4.6), Y(3.58)); g.moveTo(X(4.6), Y(3.2)); g.lineTo(X(4.88), Y(3.06)); g.stroke();
  g.fillStyle = "#f4ead2"; g.lineWidth = 14; g.beginPath(); g.rect(X(-5.4), Y(3.7), 1.1 * M, 1.5 * M); g.fill(); g.stroke();
  g.lineWidth = 8; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(X(-5.25), Y(3.5 - i * 0.2)); g.lineTo(X(-4.45 - 0.2 * (i % 2)), Y(3.5 - i * 0.2)); g.stroke(); }
});

// ---------------- materials ----------------
const sand = () => lam("sand43", () => ({ map: sandTex() }));
const dirt = () => lam("dirt43", () => ({ map: dirtTex() }));
const wood = (col: string) => lam("wd43" + col, () => ({ map: sidingTex(), color: col }));
const flat = (col: string) => lam("fl43" + col, () => ({ color: col }));
const flat2 = (col: string) => lam("fd43" + col, () => ({ color: col, side: THREE.DoubleSide }));
const stoneM = () => lam("stone43", () => ({ map: stoneHD("copeHD", ["#e6dccd", "#ddd3c3", "#ece4d6", "#d6cbba"], "#aea293") }));
const brickM = () => lam("brick43", () => ({ map: brick() }));
const beamM = () => lam("beam43", () => ({ map: beamHD() }));
const crateM = () => lam("crate43", () => ({ map: crateTex() }));
const glass = () => flat("#2b3554");

// ---------------- static sets ----------------
const storefront = (b: Batch, x: number, w: number, h: number, col: string, trim: string) => {
  const wm = wood(col), tm = flat(trim), d = 8;
  b.add(boxGeo(V(x - w / 2, 0, -d - 0.3), V(x + w / 2, h, -0.3), 2), wm);
  b.add(boxGeo(V(x - w / 2 - 0.15, h - 0.3, -0.5), V(x + w / 2 + 0.15, h + 1.5, -0.24), 2), wm);          // false front
  b.add(bx(x, h + 1.5, -0.32, w + 0.6, 0.22, 0.5), tm);                                                    // cap
  b.add(bx(x, h + 0.45, -0.2, w * 0.62, 0.72, 0.08), tm);                                                  // blank sign plank
  b.add(boxGeo(V(x - w / 2, 0, -0.3), V(x + w / 2, 0.22, 2.0), 2), beamM());                               // boardwalk
  b.add(boxGeo(V(x - w / 2 - 0.1, 2.95, -0.3), V(x + w / 2 + 0.1, 3.1, 2.1), 2), wood("#8f6f52"));         // porch roof
  for (const px of [-w / 2 + 0.2, 0, w / 2 - 0.2]) b.add(bx(x + px, 0.22, 1.85, 0.14, 2.73, 0.14), tm);
  b.add(bx(x, 0.22, -0.27, 1.1, 2.2, 0.08), flat("#5a3b28"));                                              // door
  b.add(bx(x, 2.42, -0.25, 1.4, 0.12, 0.14), tm);
  for (const s of [-1, 1]) {
    b.add(bx(x + s * w * 0.3, 1.1, -0.27, 1.25, 1.3, 0.06), glass());
    b.add(bx(x + s * w * 0.3, 1.0, -0.24, 1.5, 0.1, 0.16), tm); b.add(bx(x + s * w * 0.3, 2.4, -0.24, 1.5, 0.1, 0.12), tm);
    b.add(bx(x + s * w * 0.3, 1.1, -0.24, 0.07, 1.3, 0.08), tm);
  }
};
/** flat-topped red rock mesa with a talus skirt */
const mesa = (b: Batch, x: number, z: number, r: number, h: number, i: number) => {
  const cols = ["#c96f4a", "#d07f55", "#bf6444"];
  b.add(facet(new THREE.CylinderGeometry(r * 0.82, r, h, 9, 1)), flat(cols[i % 3]), M4(x, h / 2, z, i * 0.7));
  b.add(facet(new THREE.CylinderGeometry(r * 1.02, r * 1.75, h * 0.42, 11, 1)), flat("#dba070"), M4(x, h * 0.21, z, i));
  b.add(facet(new THREE.CylinderGeometry(r * 0.84, r * 0.84, h * 0.07, 9, 1)), flat("#e2a373"), M4(x, h * 0.72, z, i * 0.7));
};
const cactus = (b: Batch, x: number, z: number, h: number, i: number) => {
  const m = flat("#6aa15c"), r = 0.11 * h;
  b.add(new THREE.CapsuleGeometry(r, h - 2 * r, 4, 9), m, M4(x, h / 2, z));
  for (const s of i % 3 === 0 ? [1] : [-1, 1]) {
    const ay = h * (0.42 + 0.14 * hh(i, s + 3)), al = h * 0.3;
    const g1 = new THREE.CapsuleGeometry(r * 0.7, r * 2.2, 4, 8); g1.rotateZ(Math.PI / 2);
    b.add(g1, m, M4(x + s * r * 2.0, ay, z));
    b.add(new THREE.CapsuleGeometry(r * 0.7, al, 4, 8), m, M4(x + s * r * 3.3, ay + al / 2, z));
  }
};
const peak = (b: Batch, x: number, z: number, r: number, h: number, i: number) => {
  const cols = ["#b0846c", "#a2776a", "#bd927a"];
  b.add(facet(new THREE.ConeGeometry(r, h, 7, 1)), flat(cols[i % 3]), M4(x, h / 2, z, i * 1.3));
  if (h > 46) { const k = 0.34; b.add(facet(new THREE.ConeGeometry(r * k * 1.06, h * k * 1.02, 7, 1)), flat("#f6f2ea"), M4(x, h * (1 - k) + (h * k) / 2 + 0.2, z, i * 1.3)); }
};
const dSeg = (px: number, pz: number, a: [number, number], c: [number, number]) => {
  const dx = c[0] - a[0], dz = c[1] - a[1], l2 = dx * dx + dz * dz, t = clamp01(((px - a[0]) * dx + (pz - a[1]) * dz) / l2);
  return Math.hypot(px - a[0] - t * dx, pz - a[1] - t * dz);
};
/** freight wagon: bed, side boards, four wheels, tongue; optional canvas cover. Faces +x, wheels on y = 0. */
const wagonGroup = (cover: boolean) => {
  const g = new THREE.Group(), b = new Batch(), wd = wood("#b98a5e"), dk = flat("#5a3b28");
  b.add(bx(0, 0.72, 0, 2.6, 0.14, 1.2), wd);
  for (const s of [-1, 1]) b.add(bx(0, 0.86, s * 0.57, 2.6, 0.42, 0.06), wd);
  for (const s of [-1, 1]) b.add(bx(s * 1.27, 0.86, 0, 0.06, 0.42, 1.2), wd);
  for (const [wx, r] of [[-0.85, 0.58], [0.9, 0.46]]) for (const s of [-1, 1]) {
    const w = new THREE.CylinderGeometry(r, r, 0.09, 16); w.rotateX(Math.PI / 2);
    b.add(w, dk, M4(wx, r, s * 0.72));
    const hub = new THREE.CylinderGeometry(r * 0.3, r * 0.3, 0.14, 10); hub.rotateX(Math.PI / 2);
    b.add(hub, flat("#c9955a"), M4(wx, r, s * 0.72));
  }
  b.add(bx(2.2, 0.55, 0, 2.0, 0.07, 0.07), dk);
  if (cover) { const c = new THREE.CylinderGeometry(0.72, 0.72, 2.5, 12, 1, false, 0, Math.PI); c.rotateZ(Math.PI / 2); c.rotateX(-Math.PI / 2); b.add(c, flat2("#f1ead8"), M4(0, 1.28, 0)); }
  b.build(g);
  return g;
};

export const CR: V3 = [0.62, 0.42, 0.46];
const BR: V3 = [0.3, 0.11, 0.15];
/** instanced boxes filled afresh every frame */
class Inst {
  mesh: THREE.InstancedMesh; n = 0;
  private q = new THREE.Quaternion(); private e = new THREE.Euler(); private m = new THREE.Matrix4(); private p = new THREE.Vector3(); private s = new THREE.Vector3();
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, cap: number) {
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true; this.mesh.frustumCulled = false; this.mesh.count = 0;
    parent.add(this.mesh);
  }
  /** base-centre position, yaw, uniform scale (or [sx, sy, sz]), roll about z */
  put(x: number, y: number, z: number, ry = 0, s: number | V3 = 1, rz = 0) {
    if (this.n >= this.mesh.instanceMatrix.count) return;
    this.e.set(0, ry, rz); this.q.setFromEuler(this.e);
    if (typeof s === "number") this.s.set(s, s, s); else this.s.set(...s);
    this.mesh.setMatrixAt(this.n++, this.m.compose(this.p.set(x, y, z), this.q, this.s));
  }
  done() { this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; this.n = 0; }
}

const routeDashes = (() => {
  const out: { x: number; z: number; a: number; u: number }[] = [];
  let total = 0;
  const segs = ROUTE.slice(1).map((p, i) => { const a = ROUTE[i], l = Math.hypot(p[0] - a[0], p[1] - a[1]); total += l; return { a, p, l }; });
  let acc = 0;
  for (const s of segs) {
    for (let d = 4; d < s.l - 2; d += 8) out.push({ x: s.a[0] + ((s.p[0] - s.a[0]) * d) / s.l, z: s.a[1] + ((s.p[1] - s.a[1]) * d) / s.l, a: Math.atan2(-(s.p[1] - s.a[1]), s.p[0] - s.a[0]), u: (acc + d) / total });
    acc += s.l;
  }
  return out;
})();
/** point on the route at u in 0..1: [x, z, yaw] */
export const routeAt = (u: number): [number, number, number] => {
  const ls = ROUTE.slice(1).map((p, i) => Math.hypot(p[0] - ROUTE[i][0], p[1] - ROUTE[i][1])), tot = ls.reduce((a, c) => a + c, 0);
  let d = clamp01(u) * tot;
  for (let i = 0; i < ls.length; i++) {
    if (d <= ls[i] || i === ls.length - 1) { const a = ROUTE[i], p = ROUTE[i + 1], k = Math.min(1, d / ls[i]); return [a[0] + (p[0] - a[0]) * k, a[1] + (p[1] - a[1]) * k, Math.atan2(-(p[1] - a[1]), p[0] - a[0])]; }
    d -= ls[i];
  }
  return [ROUTE[0][0], ROUTE[0][1], 0];
};

export class Props {
  private bankLot = new THREE.Group(); private bankF1 = new THREE.Group(); private bankF2 = new THREE.Group(); private scaffold = new THREE.Group();
  private shell = new THREE.Group(); private panels: { pivot: THREE.Group; mesh: THREE.Mesh }[] = []; private shellTop: THREE.Mesh; private mark: THREE.Mesh;
  private crates: Inst; private bricks: Inst; private parcels: Inst; private coins: Inst; private dashes: Inst;
  private scale = new THREE.Group(); private needle: THREE.Mesh;
  private balance = new THREE.Group(); private beam: THREE.Mesh; private pans: THREE.Group[] = [];
  private stamp = new THREE.Group(); private stampMark: THREE.Mesh;
  private doors: THREE.Mesh[] = []; private banner: THREE.Mesh; private ruleSign = new THREE.Group();
  private train = new THREE.Group(); private wagon: THREE.Group; private minis: THREE.Group[] = []; private routeG = new THREE.Group();
  private oldWagon: THREE.Group;

  constructor(R: THREE.Object3D) {
    const b = new Batch(), r = rng(43);
    // ---- ground ----
    b.add(floorQ(-1100, 500, -700, 500, 0, 8), sand());
    b.add(floorQ(-70, 70, 1.6, 13.5, 0.012, 4), dirt());
    b.add(floorQ(CITY[0] - 85, CITY[0] + 70, -34, 42, 0.012, 4), lam("cobble43", () => ({ map: cobbleHD() })));
    b.add(floorQ(WAG[0] - 40, WAG[0] + 40, WAG[2] - 1.6, WAG[2] + 1.6, 0.012, 4), dirt());
    // ---- Vernal: storefronts either side of the bank lot, water tower, desert ----
    const cols = ["#d9b98a", "#b9cdd0", "#e6cfa6", "#cf9a78", "#b4c096", "#ecdfc2", "#c8a98c", "#d7c08e"], trims = ["#f4ead2", "#7a4a34", "#f4ead2", "#f7f1e1"];
    [-9.6, -18.6, -27.8, -36.6, 9.6, 18.6, 27.8, 36.6].forEach((x, i) => storefront(b, x, 8, [4.4, 5.0, 4.0, 4.6][i % 4], cols[i], trims[i % 4]));
    for (const lx of [-1, 1]) for (const lz of [-1, 1]) b.add(bx(29 + lx * 1.5, 0, -15 + lz * 1.5, 0.22, 6.5, 0.22), flat("#7a5a40"));
    b.add(new THREE.CylinderGeometry(2.4, 2.2, 3.4, 14), wood("#b08660"), M4(29, 8.2, -15));
    b.add(new THREE.ConeGeometry(2.8, 1.5, 14), flat("#8a5f4a"), M4(29, 10.65, -15));
    for (const s of [-1, 1]) for (const x0 of [-22, 22]) { // hitching rails across the street
      for (const px of [-1.4, 1.4]) b.add(bx(x0 * s + px, 0, 14.6, 0.14, 1.05, 0.14), flat("#7a5a40"));
      b.add(bx(x0 * s, 0.95, 14.6, 3.2, 0.12, 0.12), flat("#7a5a40"));
    }
    ([[-150, -230, 70, 46], [60, -300, 95, 62], [230, -210, 60, 40], [-320, -330, 110, 70], [330, -360, 90, 58], [150, -130, 34, 26], [-70, -160, 28, 22],
      [420, -120, 70, 44], [300, 120, 60, 38], [180, 260, 80, 50], [-20, 330, 90, 56]] as const).forEach(([x, z, rr, h], i) => mesa(b, x, z, rr, h, i));
    for (let i = 0; i < 260; i++) { // sagebrush + rocks
      const x = (r() - 0.5) * 520, z = (r() - 0.5) * 520;
      if (Math.abs(x) < 46 && z > -12 && z < 16) continue;
      if (Math.abs(x) < 9 && z > 0 && z < 60) continue;
      const s = 0.5 + r() * 0.8;
      if (i % 4) b.add(new THREE.SphereGeometry(1, 7, 5), flat(i % 3 ? "#9aa87e" : "#87996f"), new THREE.Matrix4().compose(V(x, 0.25 * s, z), new THREE.Quaternion(), V(s, 0.62 * s, s)));
      else b.add(facet(new THREE.DodecahedronGeometry(0.7 * s, 0)), flat("#b98a6a"), M4(x, 0.3 * s, z, i));
    }
    for (let i = 0; i < 46; i++) {
      const x = (r() - 0.5) * 420, z = (r() - 0.5) * 420;
      if (Math.abs(x) < 50 && z > -14 && z < 30) continue;
      if (Math.abs(x) < 14 && z > 0) continue;
      cactus(b, x, z, 2.4 + r() * 2.2, i);
    }
    // ---- mountains between the town and the city (clear of the route, the rail and the wagon road) ----
    for (let i = 0, n = 0; i < 400 && n < 64; i++) {
      const x = -445 + r() * 300, z = -175 + r() * 350, rad = 20 + r() * 30, h = 34 + r() * 62;
      if (z > 66 && z < 130) continue;
      if (ROUTE.slice(1).some((p, k) => dSeg(x, z, ROUTE[k], p) < rad + 7)) continue;
      peak(b, x, z, rad, h, n++);
    }
    for (let i = 0; i < 22; i++) peak(b, -820 + i * 62 + r() * 30, -330 - r() * 190, 90 + r() * 70, 110 + r() * 110, i + 70);
    for (let i = 0; i < 15; i++) peak(b, -450 + i * 16 + r() * 8, 34 - r() * 34, 22 + r() * 14, 24 + r() * 26, i + 100); // ridge behind the rail + road
    // ---- rail ----
    b.add(floorQ(RAIL[0] - 70, RAIL[0] + 70, RAIL[2] - 1.9, RAIL[2] + 1.9, 0.02, 4), flat("#b59a80"));
    for (const s of [-1, 1]) b.add(bx(RAIL[0], 0.14, RAIL[2] + s * 0.72, 140, 0.12, 0.09), flat("#4a4d58"));
    for (let x = -70; x < 70; x += 0.8) b.add(bx(RAIL[0] + x, 0.03, RAIL[2], 0.22, 0.11, 2.3), flat("#6e4a2e"));
    for (let x = -60; x <= 60; x += 15) { b.add(bx(RAIL[0] + x, 0, RAIL[2] - 3.4, 0.2, 6.2, 0.2), flat("#7a5a40")); b.add(bx(RAIL[0] + x, 5.4, RAIL[2] - 3.4, 1.7, 0.14, 0.14), flat("#7a5a40")); }
    // ---- city: post office ----
    const st = stoneM(), cx = CITY[0];
    b.add(boxGeo(V(cx - 6.5, 0, -9), V(cx + 6.5, 7, -0.2), 4), st);
    b.add(boxGeo(V(cx - 5.4, 0, -0.2), V(cx + 5.4, 0.5, 1.7), 4), st);
    b.add(boxGeo(V(cx - 5.7, 0, 1.7), V(cx + 5.7, 0.33, 2.1), 4), st);
    b.add(boxGeo(V(cx - 6.0, 0, 2.1), V(cx + 6.0, 0.17, 2.5), 4), st);
    for (const x of [-4.6, -1.75, 1.75, 4.6]) {
      b.add(new THREE.CylinderGeometry(0.34, 0.4, 5.2, 14), flat("#efe6d6"), M4(cx + x, 3.1, 1.05));
      b.add(bx(cx + x, 0.5, 1.05, 1.0, 0.24, 1.0), st); b.add(bx(cx + x, 5.56, 1.05, 0.98, 0.16, 0.98), st);
    }
    b.add(boxGeo(V(cx - 5.6, 5.7, -0.2), V(cx + 5.6, 6.7, 1.6), 4), st);
    b.add(quad(V(cx - 4.6, 5.86, 1.61), V(cx + 4.6, 5.86, 1.61), V(cx + 4.6, 6.56, 1.61), V(cx - 4.6, 6.56, 1.61)), lam("poSign43", () => ({ map: signTex("po", "POST OFFICE", "#efe6d6", "#27365e", 1024, 78) })));
    b.add(tri(V(cx - 5.9, 6.7, 1.62), V(cx + 5.9, 6.7, 1.62), V(cx, 8.7, 1.62)), flat2("#e3d9c6"));
    b.add(quad(V(cx - 5.9, 6.7, 1.75), V(cx, 8.7, 1.75), V(cx, 8.7, -9), V(cx - 5.9, 6.7, -9)), flat2("#8f97a8"));
    b.add(quad(V(cx, 8.7, 1.75), V(cx + 5.9, 6.7, 1.75), V(cx + 5.9, 6.7, -9), V(cx, 8.7, -9)), flat2("#8f97a8"));
    b.add(bx(cx, 0.5, -0.17, 2.3, 3.2, 0.06), flat("#1f1a24"));                 // doorway (dark inside)
    b.add(bx(cx, 3.7, -0.12, 2.9, 0.26, 0.3), st);
    for (const s of [-1, 1]) { b.add(bx(cx + s * 3.18, 1.7, -0.17, 1.25, 2.0, 0.06), glass()); b.add(bx(cx + s * 3.18, 1.52, -0.12, 1.6, 0.14, 0.26), st); b.add(bx(cx + s * 3.18, 3.72, -0.12, 1.6, 0.14, 0.2), st); }
    b.add(bx(cx, 8.7, 0.9, 0.09, 3.0, 0.09), flat("#7a5a40"));
    b.add(quad(V(cx + 0.06, 10.5, 0.9), V(cx + 1.96, 10.5, 0.9), V(cx + 1.96, 11.6, 0.9), V(cx + 0.06, 11.6, 0.9)), lam("flag43", () => ({ map: flagTex(), side: THREE.DoubleSide })));
    // ---- city: freight office + its idle wagon ----
    const fx0 = FRE[0], fw = wood("#c39a6c");
    b.add(boxGeo(V(fx0 - 6, 0, -8), V(fx0 + 6, 5, -0.3), 2), fw);
    b.add(boxGeo(V(fx0 - 6.15, 4.7, -0.5), V(fx0 + 6.15, 6.6, -0.24), 2), fw);
    b.add(bx(fx0, 6.6, -0.32, 12.9, 0.24, 0.5), flat("#7a4a34"));
    b.add(quad(V(fx0 - 4.4, 5.05, -0.22), V(fx0 + 4.4, 5.05, -0.22), V(fx0 + 4.4, 6.3, -0.22), V(fx0 - 4.4, 6.3, -0.22)), lam("frSign43", () => ({ map: signTex("fr", "FREIGHT CO.", "#7a2f26", "#f4e2b0", 1024, 146) })));
    b.add(boxGeo(V(fx0 - 6, 0, -0.3), V(fx0 + 6, 0.25, 1.7), 2), beamM());
    b.add(bx(fx0 + 4.0, 0.25, -0.27, 3.0, 3.3, 0.08), flat("#4a3226"));
    b.add(bx(fx0 + 4.0, 3.55, -0.24, 3.5, 0.16, 0.16), flat("#7a4a34"));
    for (const wx of [-4.2, -1.9]) { b.add(bx(fx0 + wx, 1.9, -0.27, 1.2, 1.4, 0.06), glass()); b.add(bx(fx0 + wx, 1.78, -0.24, 1.5, 0.12, 0.16), flat("#7a4a34")); b.add(bx(fx0 + wx, 3.3, -0.24, 1.5, 0.12, 0.12), flat("#7a4a34")); }
    for (const [x, z] of [[-3.3, 2.6], [-3.9, 3.3]]) b.add(new THREE.CylinderGeometry(0.34, 0.3, 0.9, 12), wood("#a8724a"), M4(fx0 + x, 0.45, z));
    this.oldWagon = wagonGroup(false); this.oldWagon.position.set(fx0 + 2.5, 0, 4.0); this.oldWagon.rotation.y = 0.12; R.add(this.oldWagon);
    // ---- city: brickyard ----
    const bm = brickM(), kx = KILN[0], kz = KILN[2];
    const dome = new THREE.SphereGeometry(4.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.attributes.uv.array.forEach((_, i, a) => { (a as Float32Array)[i] *= i % 2 ? 3 : 10; });
    b.add(dome, bm, M4(kx, 1.2, kz));
    b.add(new THREE.CylinderGeometry(4.3, 4.4, 1.2, 16), st, M4(kx, 0.6, kz));
    b.add(bx(kx, 0.2, kz + 4.1, 1.5, 1.7, 0.5), flat("#2a1f22"));
    b.add(bx(kx, 1.9, kz + 4.15, 1.9, 0.22, 0.6), st);
    b.add(boxGeo(V(kx + 5.2, 0, kz - 2.2), V(kx + 7.0, 13, kz - 0.4), 2), bm);
    b.add(bx(kx + 6.1, 13, kz - 1.3, 2.2, 0.5, 2.2), flat("#4a3442"));
    const stackM = lam("stack43", () => ({ map: rep(brick(), 1, 1) }));
    ([[-7.2, 6.0, 1.4], [-5.0, 7.2, 1.0], [-2.6, 6.4, 1.6], [0.2, 7.4, 1.2], [2.8, 6.2, 0.8], [-6.0, 9.4, 0.9], [-3.4, 9.8, 1.3], [1.4, 10.0, 1.0], [4.6, 8.6, 1.5]] as const)
      .forEach(([x, z, h]) => b.add(boxGeo(V(kx + x - 0.9, 0, kz + z - 0.5), V(kx + x + 0.9, h, kz + z + 0.5), 2, true), stackM));
    // ---- city: row houses behind, tall blocks and chimneys for the skyline ----
    for (let x = cx - 74, i = 0; x < cx + 60; x += 9.4, i++) house(b, x, -22 - (i % 2) * 1.5, 0, 9, 8, [9.8, 12.4, 8.4][i % 3], (i * 3) % 8, 0);
    const blockM = lam("block43", () => ({ map: facadeHD("block43", 16, 22, { wall: "#b5543c", shutter: "#3b3f52", brick: true }) }));
    const blockM2 = lam("block43b", () => ({ map: facadeHD("block43b", 16, 22, { wall: "#d8b98a", shutter: "#3b3f52" }) }));
    ([[-70, -46, 26], [-44, -52, 20], [-18, -48, 30], [10, -50, 22], [36, -46, 27], [58, -54, 19], [-96, -40, 18]] as const).forEach(([x, z, h], i) => {
      const m = i % 2 ? blockM2 : blockM, x0 = cx + x - 8, x1 = cx + x + 8, z0 = z - 7, z1 = z + 7;
      b.add(quad(V(x0, 0, z1), V(x1, 0, z1), V(x1, h, z1), V(x0, h, z1)), m); b.add(quad(V(x1, 0, z0), V(x0, 0, z0), V(x0, h, z0), V(x1, h, z0)), m);
      b.add(quad(V(x0, 0, z0), V(x0, 0, z1), V(x0, h, z1), V(x0, h, z0)), m); b.add(quad(V(x1, 0, z1), V(x1, 0, z0), V(x1, h, z0), V(x1, h, z1)), m);
      b.add(bx(cx + x, h, z, 16.6, 0.8, 14.6), flat("#6e6470"));
    });
    for (const [x, z, h] of [[-58, -34, 30], [24, -36, 26], [70, -30, 22]] as const) {
      b.add(new THREE.CylinderGeometry(1.0, 1.5, h, 12), bm, M4(cx + x, h / 2, z));
      b.add(new THREE.CylinderGeometry(1.25, 1.2, 1.2, 12), flat("#4a3442"), M4(cx + x, h + 0.3, z));
    }
    // ---- post office interior ----
    const ix = INT[0], iz = INT[2];
    b.add(floorQ(ix - 9, ix + 9, iz - 4, iz + 14, 0, 4), lam("floor43", () => ({ map: planksHD() })));
    const wallM = lam("poWall43", () => ({ map: poWallTex() }));
    b.add(quad(V(ix - 9, 0, iz - 4), V(ix + 9, 0, iz - 4), V(ix + 9, 11.25, iz - 4), V(ix - 9, 11.25, iz - 4), 1, 1), wallM);
    for (const s of [-1, 1]) b.add(s < 0 ? quad(V(ix - 9, 0, iz + 14), V(ix - 9, 0, iz - 4), V(ix - 9, 11.25, iz - 4), V(ix - 9, 11.25, iz + 14), 1, 1)
      : quad(V(ix + 9, 0, iz - 4), V(ix + 9, 0, iz + 14), V(ix + 9, 11.25, iz + 14), V(ix + 9, 11.25, iz - 4), 1, 1), flat("#a9c4b4"));
    b.add(boxGeo(V(ix - 4.5, 0, iz), V(ix + 4.5, 1.0, iz + 1), 2), wood("#a8744a"));
    b.add(boxGeo(V(ix - 4.6, 1.0, iz - 0.06), V(ix + 4.6, 1.05, iz + 1.08), 2), flat("#d9b58a"));
    b.build(R);

    // ---- the bank (own groups so each state can be shown alone) ----
    const { w, d, fl } = BANK, hw = w / 2, bk = new Batch();
    const fr = lam("bankF43", () => ({ map: facadeHD("bankF43", w, 2 * fl, { wall: "#b5543c", shutter: "#27365e", door: true, brick: true }) }));
    const sd = lam("bankS43", () => ({ map: facadeHD("bankS43", d, 2 * fl, { wall: "#b5543c", shutter: "#27365e", brick: true }) }));
    const floor = (y0: number, y1: number, v0: number, v1: number) => {
      bk.add(quad(V(-hw, y0, 0), V(hw, y0, 0), V(hw, y1, 0), V(-hw, y1, 0), 1, v1, 0, v0), fr);
      bk.add(quad(V(hw, y0, -d), V(-hw, y0, -d), V(-hw, y1, -d), V(hw, y1, -d), 1, v1, 0, v0), sd);
      bk.add(quad(V(-hw, y0, -d), V(-hw, y0, 0), V(-hw, y1, 0), V(-hw, y1, -d), 1, v1, 0, v0), sd);
      bk.add(quad(V(hw, y0, 0), V(hw, y0, -d), V(hw, y1, -d), V(hw, y1, 0), 1, v1, 0, v0), sd);
    };
    floor(0, fl, 0, 0.5);
    bk.add(boxGeo(V(-hw - 0.1, 0, -d - 0.1), V(hw + 0.1, 0.5, 0.1), 3), st);
    bk.add(boxGeo(V(-hw - 0.12, fl - 0.14, -d - 0.12), V(hw + 0.12, fl + 0.14, 0.12), 3), st);
    bk.add(bx(0, 0, 0.5, 1.9, 0.2, 0.9), st); bk.add(bx(0, 2.5, 0.2, 1.9, 0.16, 0.36), st);
    for (const s of [-1, 1]) bk.add(bx(s * (hw - 0.2), 0.5, 0.06, 0.5, fl - 0.64, 0.16), st);
    bk.add(floorQ(-hw, hw, -d, 0, fl - 0.02, 4), flat("#6e5a50"));
    bk.build(this.bankF1);
    floor(fl, 2 * fl, 0.5, 1);
    for (const s of [-1, 1]) bk.add(bx(s * (hw - 0.2), fl + 0.14, 0.06, 0.5, fl - 0.14, 0.16), st);
    bk.add(boxGeo(V(-hw - 0.3, 2 * fl, -d - 0.3), V(hw + 0.3, 2 * fl + 0.36, 0.3), 3), st);
    bk.add(boxGeo(V(-hw - 0.05, 2 * fl + 0.36, -d - 0.05), V(hw + 0.05, BANK.h, 0.05), 3), bm);
    bk.add(boxGeo(V(-hw - 0.14, BANK.h, -d - 0.14), V(hw + 0.14, BANK.h + 0.14, 0.14), 3), st);
    bk.add(quad(V(-1.7, 2 * fl + 0.43, 0.07), V(1.7, 2 * fl + 0.43, 0.07), V(1.7, BANK.h - 0.07, 0.07), V(-1.7, BANK.h - 0.07, 0.07)), lam("bankSign43", () => ({ map: signTex("bank", "BANK", "#27365e", "#f0c85a", 640, 120) })));
    bk.build(this.bankF2);
    // the empty lot: low foundation walls, corner stakes and string
    bk.add(floorQ(-hw, hw, -d, 0, 0.02, 4), dirt());
    for (const [x0, x1, z0, z1] of [[-hw, hw, -0.3, 0], [-hw, hw, -d, -d + 0.3], [-hw, -hw + 0.3, -d, 0], [hw - 0.3, hw, -d, 0]]) bk.add(boxGeo(V(x0, 0, z0), V(x1, 0.34, z1), 3), st);
    for (const sx of [-1, 1]) for (const sz of [0.25, -d - 0.25]) bk.add(bx(sx * (hw + 0.25), 0, sz, 0.09, 1.15, 0.09), flat("#7a5a40"));
    for (const sz of [0.25, -d - 0.25]) bk.add(bx(0, 0.95, sz, w + 0.5, 0.035, 0.035), flat("#f7f1e1"));
    for (const sx of [-1, 1]) bk.add(bx(sx * (hw + 0.25), 0.95, -d / 2, 0.035, 0.035, d + 0.5), flat("#f7f1e1"));
    bk.build(this.bankLot);
    // building site: scaffold, a ladder, the first courses of the upper floor
    const pole = flat("#b98a5e");
    for (const x of [-3.2, -1.1, 1.1, 3.2]) bk.add(bx(x, 0, 1.0, 0.11, 5.4, 0.11), pole);
    for (const y of [1.9, 3.7]) { bk.add(bx(0, y, 1.0, 6.9, 0.09, 0.09), pole); bk.add(bx(0, y + 0.06, 0.6, 6.6, 0.06, 0.8), wood("#d9b98a")); }
    for (const [x0, x1, z0, z1, h] of [[-hw, hw, -0.3, 0, 0.7], [-hw, -hw + 0.3, -d, 0, 1.2], [hw - 0.3, hw, -d, 0, 0.45], [-hw, hw, -d, -d + 0.3, 1.0]]) bk.add(boxGeo(V(x0, fl + 0.14, z0), V(x1, fl + 0.14 + h, z1), 1.2), stackM);
    bk.build(this.scaffold);
    // the wrapping: four hinged walls + a lid, the postmark on the front
    const paper = lam("paper43", () => ({ map: paperTex(), side: THREE.DoubleSide })), sw = w + 1.0, sh = BANK.h + 0.5;
    const wallG = new THREE.PlaneGeometry(sw, sh).translate(0, sh / 2, 0);
    ([[0, 0.5, 0], [-sw / 2, -d / 2, -Math.PI / 2], [sw / 2, -d / 2, Math.PI / 2], [0, -d - 0.5, Math.PI]] as const).forEach(([x, z, ry]) => {
      const pivot = new THREE.Group(), mesh = new THREE.Mesh(wallG, paper);
      mesh.castShadow = true; mesh.receiveShadow = true;
      pivot.position.set(x, 0, z); pivot.rotation.y = ry; pivot.add(mesh); this.shell.add(pivot); this.panels.push({ pivot, mesh });
    });
    this.shellTop = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw).rotateX(-Math.PI / 2), paper);
    this.shellTop.castShadow = true; this.shell.add(this.shellTop);
    this.mark = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ map: markTex(), alphaTest: 0.5, color: 0xdddddd }));
    this.mark.position.set(-1.35, 6.2, 0.03); this.panels[0].mesh.add(this.mark);
    for (const g of [this.bankLot, this.bankF1, this.bankF2, this.scaffold, this.shell]) { g.position.set(...VER); R.add(g); }

    // ---- instanced props ----
    this.crates = new Inst(R, new THREE.BoxGeometry(...CR).translate(0, CR[1] / 2, 0), crateM(), 1500);
    this.bricks = new Inst(R, new THREE.BoxGeometry(...BR).translate(0, BR[1] / 2, 0), flat("#c4573a"), 260);
    this.parcels = new Inst(R, new THREE.BoxGeometry(0.33, 0.13, 0.18).translate(0, 0.065, 0), lam("parcel43", () => ({ map: parcelTex() })), 40);
    this.coins = new Inst(R, new THREE.CylinderGeometry(0.105, 0.105, 0.045, 18).translate(0, 0.0225, 0), flat("#f2c33c"), 80);
    this.dashes = new Inst(this.routeG, new THREE.BoxGeometry(5.4, 0.3, 2.7).translate(0, 0.45, 0), flat("#fff6d2"), routeDashes.length);
    this.dashes.mesh.castShadow = false;
    for (let i = 0; i < 4; i++) { const g = wagonGroup(true); g.scale.setScalar(5.5); this.minis.push(g); this.routeG.add(g); }
    R.add(this.routeG);

    // ---- counter machines ----
    const iron = flat("#3d414c"), brass = flat("#d9a441"), sb = new Batch();
    sb.add(bx(0, 1.05, 0.5, 0.86, 0.12, 0.8), iron); sb.add(bx(0, 1.17, 0.5, 0.78, 0.035, 0.72), brass);
    sb.add(bx(0, 1.17, 0.13, 0.12, 0.62, 0.12), iron);
    const ring = new THREE.CylinderGeometry(0.38, 0.38, 0.12, 24); ring.rotateX(Math.PI / 2);
    sb.add(ring, iron, M4(0, 2.1, 0.13));
    sb.build(this.scale);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.345, 32), new THREE.MeshBasicMaterial({ map: dialTex(), color: 0xe2e2e2 }));
    face.position.set(0, 2.1, 0.195); this.scale.add(face);
    this.needle = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.29, 0.012).translate(0, 0.115, 0), new THREE.MeshBasicMaterial({ color: "#c8323a" }));
    this.needle.position.set(0, 2.1, 0.205); this.scale.add(this.needle);
    const hubM = new THREE.Mesh(new THREE.CircleGeometry(0.035, 14), new THREE.MeshBasicMaterial({ color: "#241726" })); hubM.position.set(0, 2.1, 0.212); this.scale.add(hubM);
    this.scale.position.set(...INT); R.add(this.scale);
    sb.add(bx(0, 1.05, 0.5, 0.5, 0.07, 0.34), brass); sb.add(bx(0, 1.12, 0.5, 0.09, 1.2, 0.09), brass);
    sb.build(this.balance);
    this.beam = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.06, 0.06), brass); this.beam.castShadow = true;
    this.beam.position.set(0, 2.32, 0.5); this.balance.add(this.beam);
    for (let i = 0; i < 2; i++) {
      const g = new THREE.Group(), pb = new Batch();
      pb.add(new THREE.CylinderGeometry(0.4, 0.34, 0.035, 20), brass, M4(0, -0.62, 0));
      for (const s of [-1, 1]) { const rod = new THREE.BoxGeometry(0.016, 0.7, 0.016); rod.rotateZ(s * 0.5); pb.add(rod, iron, M4(s * 0.17, -0.3, 0)); }
      pb.build(g); this.pans.push(g); this.balance.add(g);
    }
    this.balance.position.set(...INT); R.add(this.balance);
    const tb = new Batch();
    tb.add(new THREE.CylinderGeometry(0.045, 0.055, 0.26, 10), wood("#8a5a34"), M4(0, 0.2, 0));
    tb.add(new THREE.SphereGeometry(0.075, 10, 8), flat("#5a3b28"), M4(0, 0.36, 0));
    tb.add(bx(0, 0, 0, 0.26, 0.08, 0.2), flat("#3d414c"));
    tb.build(this.stamp); R.add(this.stamp);
    this.stampMark = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({ map: markTex(), alphaTest: 0.5, color: 0xdddddd }));
    R.add(this.stampMark);

    // ---- post office doors, banner, rule sign ----
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.12, 3.15, 0.08).translate(-s * 0.56, 1.575, 0), flat("#2f6a43"));
      m.position.set(cx + s * 1.12, 0.5, -0.1); m.castShadow = true; this.doors.push(m); R.add(m);
    }
    this.banner = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 3.3).translate(0, -1.65, 0), lam("banner43", () => ({ map: bannerTex(), side: THREE.DoubleSide })));
    this.banner.position.set(cx, 5.66, 1.66); this.banner.castShadow = true; R.add(this.banner);
    const sx0 = SIGN_P[0] + 1.1, sz0 = SIGN_P[2] - 0.65;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.04), new THREE.MeshBasicMaterial({ map: ctex("rule43", 700, 520, (g) => fxRuleSign(new Pen(g))), alphaTest: 0.5, color: 0xe6e6e6 }));
    board.position.set(sx0, 1.62, sz0 + 0.04);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.46, 1.1, 0.06), beamM()); back.position.set(sx0, 1.62, sz0);
    this.ruleSign.add(board, back);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.15, 0.12), beamM()); p.position.set(sx0 + s * 0.52, 1.07, sz0 - 0.07); this.ruleSign.add(p); }
    this.ruleSign.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
    R.add(this.ruleSign);

    // ---- train: engine, tender, three flatcars loaded with crates (faces +x) ----
    const t = new Batch(), blk = flat("#2e3140"), red = flat("#b5352f");
    const boiler = new THREE.CylinderGeometry(0.95, 0.95, 4.2, 16); boiler.rotateZ(Math.PI / 2);
    t.add(boiler, blk, M4(1.0, 2.05, 0)); t.add(bx(0.6, 0.75, 0, 5.6, 0.4, 1.8), blk);
    t.add(bx(-2.1, 1.1, 0, 2.0, 2.5, 2.3), red); t.add(bx(-2.1, 3.6, 0, 2.4, 0.16, 2.6), blk);
    t.add(bx(-2.1, 2.3, 1.16, 1.2, 0.8, 0.04), flat("#f4e2b0"));
    t.add(new THREE.CylinderGeometry(0.42, 0.26, 1.2, 12), blk, M4(2.5, 3.5, 0)); t.add(new THREE.SphereGeometry(0.4, 12, 8), flat("#d9a441"), M4(1.1, 3.0, 0));
    t.add(new THREE.ConeGeometry(0.9, 1.2, 4), red, new THREE.Matrix4().compose(V(3.7, 0.55, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 4, -Math.PI / 2)), V(1, 1, 1.2)));
    const wheel = (x: number, rad: number, m: THREE.Material) => { for (const s of [-1, 1]) { const g = new THREE.CylinderGeometry(rad, rad, 0.12, 18); g.rotateX(Math.PI / 2); t.add(g, m, M4(x, rad + 0.2, s * 0.95)); } };
    for (const x of [-0.6, 0.9, 2.3]) wheel(x, 0.72, red);
    t.add(bx(-4.9, 0.75, 0, 2.8, 1.9, 2.1), blk); for (const x of [-5.6, -4.2]) wheel(x, 0.45, red);
    for (let c = 0; c < 3; c++) {
      const x0 = -9.6 - c * 6.1;
      t.add(bx(x0, 0.95, 0, 5.4, 0.22, 2.3), wood("#a8744a")); for (const x of [-1.8, 1.8]) wheel(x0 + x, 0.42, blk);
      for (let k = 0; k < 4; k++) for (let i = 0; i < 6 - k; i++) for (let j = 0; j < 2; j++)
        t.add(bx(x0 - 2.0 + i * 0.8 + k * 0.4, 1.17 + k * 0.52, -0.5 + j * 1.0, 0.76, 0.5, 0.92), crateM());
    }
    t.build(this.train); R.add(this.train);
    this.wagon = wagonGroup(true); R.add(this.wagon);
  }

  /** a neat pile: layers shrink by one crate each way; `shown` crates (bottom-up) are in place, the next ones drop in */
  private heap(x: number, z: number, nx: number, nz: number, layers: number, s: number, shown: number, seed = 0) {
    let n = 0;
    for (let k = 0; k < layers; k++) for (let i = 0; i < nx - k; i++) for (let j = 0; j < Math.max(1, nz - k); j++, n++) {
      if (n > shown + 40) return;
      const fall = Math.max(0, n - shown) * 0.22;
      this.crates.put(x + (i - (nx - k - 1) / 2) * CR[0] * s * 1.02 + (hh(n, seed) - 0.5) * 0.06 * s, k * CR[1] * s + fall * fall * 3, z + (j - (Math.max(1, nz - k) - 1) / 2) * CR[2] * s * 1.03,
        (hh(n, seed + 1) - 0.5) * 0.14, s);
    }
  }

  pose(id: number, f: number) {
    const C = this.crates, B = this.bricks, P = this.parcels, K = this.coins;
    // ---- the bank ----
    const built = id === 1 || id >= 31, site = id === 29;
    this.bankF1.visible = built || site; this.bankF2.visible = built; this.scaffold.visible = site;
    this.bankLot.visible = id === 2 || id === 3 || id === 5;
    this.shell.visible = id === 1;
    if (id === 1) {
      const u = ramp(f, 119, 139), a = (Math.PI / 2) * 0.985 * Math.min(1, u ** 1.7 * 1.25);
      this.panels.forEach((p, i) => { p.mesh.rotation.x = a * (i === 0 ? 1 : 0.96 + 0.03 * i); });
      this.shellTop.position.set(1.5 * u, BANK.h + 0.5 + 16 * u * u, -BANK.d / 2 - 4 * u); this.shellTop.rotation.set(-1.1 * u, 0, 0.5 * u);
      this.shellTop.visible = u < 0.96;
      const k = f < 26 ? 0 : 1 + 1.7 * (1 - smooth(ramp(f, 26, 30)));
      this.mark.visible = f >= 26; this.mark.scale.setScalar(Math.max(0.001, k)); this.mark.rotation.z = -0.3 + 0.5 * (k - 1);
    }
    // ---- city ----
    const dOpen = id === 10 ? doorOpen(f) : 0;
    this.doors[0].rotation.y = 1.75 * dOpen; this.doors[1].rotation.y = -1.75 * dOpen; // swing inward
    const bk = id < 22 ? 0 : id > 22 ? 1 : f < 1289 ? 0 : f < 1296 ? ramp(f, 1289, 1296) : 1 + 0.07 * wobble(f, 1296, 2.6, 5);
    this.banner.visible = bk > 0.01; this.banner.scale.y = Math.max(0.02, bk);
    this.ruleSign.visible = id >= 30;
    this.oldWagon.visible = id === 21;
    // ---- counter machines ----
    this.scale.visible = id === 13 || id === 23;
    this.balance.visible = id === 26;
    let stampY = -1, markOn = false, sx = 0;
    const cX = INT[0], cY = 1.05, cZ = INT[2] + 0.5;
    if (id === 7) { // one small pile of bricks... and what the freight company wants for carrying it
      C.put(FRE[0] + 0.12, 0, 3.2, 0.1, 1.1);
      for (let k = 0; k < 4; k++) for (let i = 0; i < 2; i++) B.put(FRE[0] + 0.12 + (i - 0.5) * 0.32 + (k % 2) * 0.03, 0.462 + k * BR[1], 3.2, k % 2 ? 0.05 : -0.04, 1);
      C.put(FRE[0] + 0.98, 0, 3.25, -0.06, [1.5, 1.05, 1.2]);
    }
    if (id === 8) { C.put(FRE[0] + 0.12, 0, 3.2, 0.1, 1.1); for (let k = 0; k < 4; k++) for (let i = 0; i < 2; i++) B.put(FRE[0] + 0.12 + (i - 0.5) * 0.32 + (k % 2) * 0.03, 0.462 + k * BR[1], 3.2, k % 2 ? 0.05 : -0.04, 1); }
    if (id === 21) C.put(FGUY[0], 0, FGUY[2] - 0.12, 0.08, 1.12);
    if (id === 11) { // six bricks in a row, wrapped one by one
      for (let i = 0; i < 5; i++) {
        const f0 = W.wrapped - 2 + i * 9, u = (f - f0) / 7, hop = u > 0 && u < 1 ? 0.16 * Math.sin(u * Math.PI) : 0, x = cX - 0.54 + i * 0.27;
        if (f < f0 + 3) B.put(x, cY + hop, cZ, 0.06 * (i % 2 ? 1 : -1), 0.72, 0); else P.put(x, cY + hop, cZ, 0.06 * (i % 2 ? 1 : -1), 0.7, u < 1 ? 0.25 * Math.sin(u * 9) * (1 - u) : 0);
      }
    }
    if (id === 12) { // ten parcels hop into the crate
      C.put(cX + 0.3, cY, cZ, 0.05, 1.15);
      for (let i = 0; i < 10; i++) {
        const f0 = W.packed - 2 + (9 - i) * 2.4, u = (f - f0) / 6, sx0 = cX - 1.02 + (i % 5) * 0.21, sy0 = cY + Math.floor(i / 5) * 0.132;
        if (u <= 0) P.put(sx0, sy0, cZ, Math.PI / 2, 1);
        else if (u < 1) P.put(sx0 + (cX + 0.3 - sx0) * u, sy0 + (cY + 0.5 - sy0) * u + 0.34 * Math.sin(u * Math.PI), cZ, Math.PI / 2, 1 - 0.3 * u, u * 5);
      }
    }
    if (id === 13 || id === 23) {
      const land = id === 13 ? 778 : 1393, drop = Math.max(0, land - f) / 6;
      if (f > land - 7) C.put(cX, cY + 0.155 + 0.9 * drop * drop, cZ, 0.04, 1.02);
      const k = f < land ? 0 : 1 - wobble(f, land, 1.7, 3.6);
      this.needle.rotation.z = 2.1 - 4.2 * (0.975 * k + (f > land + 30 ? 0.01 * Math.sin(f * 0.9) : 0));
    }
    if (id === 14 || id === 25) {
      sx = id === 14 ? 0.12 : -0.05;
      const hit = id === 14 ? W.one : W.inside;
      C.put(cX + sx, cY, cZ, id === 14 ? -0.05 : 0.06, 1.1);
      const top = cY + CR[1] * 1.1;
      stampY = f < hit - 7 ? top + 0.75 + 0.02 * Math.sin(f * 0.35) : f < hit ? top + 0.75 * (1 - ((f - hit + 7) / 7) ** 2) : f < hit + 5 ? top : top + 0.75 * smooth(ramp(f, hit + 5, hit + 14));
      markOn = f >= hit;
    }
    if (id === 15) { // a wall of a hundred
      for (let i = 0; i < 100; i++) {
        const row = Math.floor(i / 6), land = 906 + row * 0.6, drop = Math.max(0, land - f) / 5;
        if (f > land - 5) C.put(cX - 1.56 + (i % 6) * 0.625 + (hh(i) - 0.5) * 0.03, row * CR[1] + 1.6 * drop * drop, INT[2] + 1.6, (hh(i, 2) - 0.5) * 0.08, 1);
      }
    }
    if (id === 16) this.heap(CITY[0] + 5.5, 7, 19, 13, 13, 1.5, Math.round(1400 * clamp01((f - 931) / 31) ** 0.8), 3);
    if (id === 22 || id === 28 || id === 30) this.heap(CITY[0] - 9.5, 4.5, 7, 3, 4, 1.2, 999, 5);
    if (id === 26) { // bricks on one pan, socks on the other: dead level
      const th = 0.15 * (f < 1503 ? 1 + 0.06 * Math.sin(f * 0.25) : wobble(f, 1503, 1.15, 2.4));
      this.beam.rotation.z = th;
      [-1, 1].forEach((s, i) => {
        const px = s * 0.82 * Math.cos(th), py = 2.32 + s * 0.82 * Math.sin(th);
        this.pans[i].position.set(px, py, 0.5);
        C.put(cX + px, py - 0.602, cZ, 0, 0.92);
        if (s < 0) for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) B.put(cX + px + (j - 0.5) * 0.31, py - 0.602 + CR[1] * 0.92 + k * BR[1], cZ, k ? 0.06 : -0.04, 1);
      });
      for (const s of [-1, 1]) { const n = Math.round(6 * ramp(f, W.cost - 4, W.cost + 8)); for (let k = 0; k < n; k++) K.put(cX + s * 0.82 + (hh(k, s + 2) - 0.5) * 0.02, cY + k * 0.045, cZ + 0.36, 0, 1); }
    }
    if (id === 27) {
      const nL = Math.round(8 * ramp(f, 1594, 1603)), nR = Math.round(20 * ramp(f, 1596, 1611));
      for (let k = 0; k < nL; k++) K.put(cX - 0.2 + (hh(k, 7) - 0.5) * 0.02, cY + k * 0.045, cZ + 0.05, 0, 1.25);
      for (let k = 0; k < nR; k++) K.put(cX + 0.2 + (hh(k, 8) - 0.5) * 0.02, cY + k * 0.045, cZ + 0.05, 0, 1.25);
    }
    if (id === 29) { // thirty-seven tons in Vernal
      this.heap(6.4, 4.2, 9, 5, 6, 1.25, 999, 9);
      this.heap(-6.3, 3.4, 4, 3, 3, 1.2, 999, 11);
      for (let i = 0; i < 7; i++) C.put(-2.6 + i * 0.95 + hh(i, 4) * 0.3, 0, 2.2 + hh(i, 5) * 1.6, hh(i, 6) * 2, 1.15);
      for (let k = 0; k < 5; k++) for (let i = 0; i < 6; i++) B.put(1.9 + i * 0.32, k * BR[1], 1.4 + (k % 2) * 0.03, 0, 1.05);
    }
    if (id === 32 && f >= 1940) C.put(1.95, 0, 10.4, 0.3, 1.1);
    this.stamp.visible = stampY > 0; this.stampMark.visible = markOn;
    if (stampY > 0) this.stamp.position.set(cX + sx + 0.02, stampY, cZ);
    if (markOn) { this.stampMark.position.set(cX + sx + 0.02, cY + 0.235, cZ + CR[2] * 0.55 + 0.012); this.stampMark.rotation.z = 0.15; }
    // ---- train, wagon, route ----
    this.train.visible = id === 18; if (id === 18) this.train.position.set(trainX(f), 0.02, RAIL[2]);
    this.wagon.visible = id === 19; if (id === 19) this.wagon.position.set(wagonX(f), 0.02 + 0.015 * Math.sin(f * 1.3), WAG[2]);
    const air = id === 20 || id === 24;
    this.routeG.visible = air;
    if (air) {
      const k = id === 24 ? 1 : ramp(f, 1062, 1118);
      for (const d of routeDashes) if (d.u <= k) this.dashes.put(d.x, 0, d.z, d.a, 1);
      this.minis.forEach((g, i) => {
        const u = ((id === 24 ? 0.5 : 0) + k * 0.9 - i * 0.2 + (f - 1061) * 0.0006);
        g.visible = u > 0.01 && u < 0.99;
        const [x, z, a] = routeAt(u); g.position.set(x, 0.6, z); g.rotation.y = a;
      });
    }
    C.done(); B.done(); P.done(); K.done(); this.dashes.done();
  }
}
