/* Coins: the marks minted as thin medallions that rise through the picture,
   turning on edge. Each is a brushed-nickel disc with a milled rim and its
   mark engraved a little deeper than the field; it casts a soft shadow down
   and to the right, and darkens and glints as it turns.

   How it works: Canvas 2D, nothing 3D. A face is painted once per size.
   Every frame the rim is a ring of narrow quads (a reed each, shaded by its
   normal against the light) and the face is the painted disc drawn through
   the coin's turn as a sheared ellipse. Only the face the viewer sees is
   drawn, so a coin on edge is all rim.

   After the engraved corner coin on jjmartin.co, and every medal minted for
   a mark since.

   A coin is { d, x, start, turns, mid, tilt, sway, phase } in COIN below:
   its diameter (share of the height), its column (share of the width), when
   it starts rising (share of the loop), the turns it makes on the way, the
   angle it passes the middle at, its lean, and a slow sway. Marks, backdrop
   and figure come from placeholders.js. */

import { hero, drawName, MARKS, markImage } from "./placeholders.js";

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const mod1 = (x) => x - Math.floor(x);
const inOut = (x) => {
  x = clamp(x);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

const COIN = [
  { d: 0.17, x: 0.15, start: 0.0, turns: 0.75, mid: 0.3, tilt: 13 * DEG, sway: 0.012, phase: 0.1 },
  { d: 0.15, x: 0.4, start: 0.34, turns: -0.62, mid: -0.35, tilt: -11 * DEG, sway: 0.014, phase: 0.55 },
  { d: 0.2, x: 0.28, start: 0.67, turns: 1.0, mid: 0.2, tilt: 15 * DEG, sway: 0.01, phase: 0.8 },
];
const COIN_LEN = 0.82; // how much of the loop a coin takes to cross
const RIM_N = 140; // reeds round the rim
const LIGHT = (() => {
  const v = [-0.45, -0.6, 0.66];
  const m = Math.hypot(...v);
  return v.map((x) => x / m);
})();

function seeded(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

function mkCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/* A canvas tinted one colour through its own alpha. */
function tinted(src, color) {
  const c = mkCanvas(src.width, src.height);
  const g = c.getContext("2d");
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

/* A face, pre-rendered once: brushed nickel with a raised rim, and the mark
   engraved (a little darker than the field, a dark lip top-left, a light one
   bottom-right) with the backdrop's blue in the metal. */
function coinFace(markImg, mark, D, dpr, idx) {
  const Dp = Math.round(D * dpr);
  const pad = 4;
  const ts = Dp + pad * 2;
  const c = ts / 2;
  const R = Dp / 2;
  const cvs = mkCanvas(ts, ts);
  const g = cvs.getContext("2d");
  const lw = Math.max(1, dpr);
  g.save();
  g.beginPath();
  g.arc(c, c, R, 0, TAU);
  g.clip();

  // the field: light centre-left to a darker edge
  const fld = g.createRadialGradient(c - 0.34 * R, c - 0.38 * R, 0, c - 0.12 * R, c - 0.14 * R, 1.5 * R);
  fld.addColorStop(0, "#e8ecf2");
  fld.addColorStop(0.5, "#b3bac6");
  fld.addColorStop(1, "#8c95a4");
  g.fillStyle = fld;
  g.fillRect(0, 0, ts, ts);

  // concentric brushing, and the sheen it gives (two bright lobes, two dark)
  const rnd = seeded(11 + idx * 7);
  for (let r = 0.05 * R; r < 0.93 * R; r += 0.85) {
    const a = 0.016 + rnd() * 0.04;
    g.strokeStyle = rnd() < 0.55 ? `rgba(255,255,255,${a})` : `rgba(28,38,60,${a})`;
    g.lineWidth = 0.6 + rnd() * 0.5;
    g.beginPath();
    g.arc(c, c, r, 0, TAU);
    g.stroke();
  }
  const cg = g.createConicGradient(-0.7, c, c);
  cg.addColorStop(0, "rgba(255,255,255,0)");
  cg.addColorStop(0.1, "rgba(255,255,255,0.46)");
  cg.addColorStop(0.24, "rgba(255,255,255,0)");
  cg.addColorStop(0.37, "rgba(16,26,52,0.34)");
  cg.addColorStop(0.5, "rgba(255,255,255,0)");
  cg.addColorStop(0.6, "rgba(255,255,255,0.4)");
  cg.addColorStop(0.74, "rgba(255,255,255,0)");
  cg.addColorStop(0.87, "rgba(16,26,52,0.34)");
  cg.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = cg;
  g.fillRect(0, 0, ts, ts);

  // a hairline groove inside the rim
  const groove = g.createLinearGradient(c - R, c - R, c + R, c + R);
  groove.addColorStop(0, "rgba(20,30,52,0.42)");
  groove.addColorStop(0.5, "rgba(20,30,52,0.1)");
  groove.addColorStop(1, "rgba(255,255,255,0.7)");
  g.strokeStyle = groove;
  g.lineWidth = lw;
  g.beginPath();
  g.arc(c, c, 0.855 * R, 0, TAU);
  g.stroke();

  // the raised rim: light top-left edge, dark bottom-right edge
  const ri = 0.915 * R;
  const rg = g.createLinearGradient(c - R, c - R, c + R, c + R);
  rg.addColorStop(0, "#f2f5f9");
  rg.addColorStop(0.45, "#bcc4cf");
  rg.addColorStop(1, "#7b8596");
  g.fillStyle = rg;
  g.beginPath();
  g.arc(c, c, R, 0, TAU);
  g.arc(c, c, ri, 0, TAU, true);
  g.fill("evenodd");
  const eo = g.createLinearGradient(c - R, c - R, c + R, c + R);
  eo.addColorStop(0, "rgba(255,255,255,0.95)");
  eo.addColorStop(0.42, "rgba(255,255,255,0)");
  eo.addColorStop(0.58, "rgba(18,26,46,0)");
  eo.addColorStop(1, "rgba(18,26,46,0.6)");
  g.strokeStyle = eo;
  g.lineWidth = lw * 1.2;
  g.beginPath();
  g.arc(c, c, R - lw * 0.6, 0, TAU);
  g.stroke();
  const ei = g.createLinearGradient(c - R, c - R, c + R, c + R);
  ei.addColorStop(0, "rgba(18,26,46,0.62)");
  ei.addColorStop(0.5, "rgba(18,26,46,0)");
  ei.addColorStop(1, "rgba(255,255,255,0.85)");
  g.strokeStyle = ei;
  g.lineWidth = lw;
  g.beginPath();
  g.arc(c, c, ri + lw * 0.4, 0, TAU);
  g.stroke();

  // the mark, engraved
  let mw;
  let mh;
  if (mark.wide) {
    mw = 0.7 * Dp;
    mh = mw / mark.ar;
  } else {
    mh = 0.55 * Dp;
    mw = mh * mark.ar;
  }
  const m = mkCanvas(ts, ts);
  m.getContext("2d").drawImage(markImg, c - mw / 2, c - mh / 2, mw, mh);
  g.globalAlpha = 0.34;
  g.drawImage(tinted(m, "#1c2a48"), 0, 0);
  g.globalAlpha = 1;
  const e = 1.2 * dpr;
  const dark = tinted(m, "#0a1124");
  const dg = dark.getContext("2d");
  dg.globalCompositeOperation = "destination-out";
  dg.drawImage(m, e, e);
  g.globalAlpha = 0.85;
  g.drawImage(dark, 0, 0);
  const lit = tinted(m, "#ffffff");
  const lg = lit.getContext("2d");
  lg.globalCompositeOperation = "destination-out";
  lg.drawImage(m, -e, -e);
  g.globalAlpha = 0.8;
  g.drawImage(lit, 0, 0);
  g.globalAlpha = 1;

  // the backdrop's blue in the metal
  g.globalCompositeOperation = "multiply";
  g.globalAlpha = 0.14;
  g.fillStyle = "#3a55ff";
  g.fillRect(0, 0, ts, ts);
  g.restore();
  return { tex: cvs, half: ts / 2 / dpr };
}

/* The milled rim's shades, 0 → 1, as colours ready to set. */
const RIM = Array.from({ length: 64 }, (_, i) => {
  const k = 0.26 + 0.78 * (i / 63);
  return `rgb(${Math.round(clamp(166 * k * 0.93, 0, 255))},${Math.round(clamp(175 * k * 0.95, 0, 255))},${Math.round(clamp(192 * k, 0, 255))})`;
});
const RIM_COS = Array.from({ length: RIM_N }, (_, k) => Math.cos(((k + 0.5) / RIM_N) * TAU));
const RIM_SIN = Array.from({ length: RIM_N }, (_, k) => Math.sin(((k + 0.5) / RIM_N) * TAU));
const EDGE_COS = Array.from({ length: RIM_N + 1 }, (_, k) => Math.cos((k / RIM_N) * TAU));
const EDGE_SIN = Array.from({ length: RIM_N + 1 }, (_, k) => Math.sin((k / RIM_N) * TAU));

/* What a coin casts: a soft dark pool, drawn once and stretched. */
function shadowSprite() {
  const c = mkCanvas(128, 128);
  const g = c.getContext("2d");
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(1,4,24,0.62)");
  r.addColorStop(0.5, "rgba(1,4,24,0.3)");
  r.addColorStop(1, "rgba(1,4,24,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  return c;
}

/* One coin at (cx, cy), turned `th` about its vertical axis and leaning `ph`. */
function drawCoin(ctx, dpr, K, cx, cy, th, ph, idx, shadow) {
  const { R, T } = K;
  const D = 2 * R;
  const cT = Math.cos(th);
  const sT = Math.sin(th);
  const cP = Math.cos(ph);
  const sP = Math.sin(ph);
  const spread = Math.abs(cT);

  // what it casts: soft, small, down and to the right
  const sw = D * 1.2 * (0.2 + 0.8 * spread) + T * 2.2;
  const sh = D * 1.25;
  ctx.globalAlpha = 0.9;
  ctx.drawImage(shadow, cx + 0.2 * D - sw / 2, cy + 0.26 * D - sh / 2, sw, sh);
  ctx.globalAlpha = 1;

  // the milled rim: a ring of reeds, each a quad between the two faces
  const hz = T / 2;
  for (let k = 0; k < RIM_N; k++) {
    const ca = RIM_COS[k];
    const sa = RIM_SIN[k];
    const nz = sa * sP - ca * sT * cP;
    if (nz <= 0.015) continue;
    const nx = ca * cT;
    const ny = sa * cP + ca * sT * sP;
    let lam = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
    lam = lam * 0.5 + 0.5;
    if (k & 1) lam *= 0.86;
    else lam = lam * 1.04 + 0.03;
    ctx.fillStyle = RIM[Math.round(clamp(lam) * 63)];
    const c0 = EDGE_COS[k];
    const s0 = EDGE_SIN[k];
    const c1 = EDGE_COS[k + 1];
    const s1 = EDGE_SIN[k + 1];
    const x0 = cx + R * c0 * cT;
    const y0 = cy + R * s0 * cP + R * c0 * sT * sP;
    const x1 = cx + R * c1 * cT;
    const y1 = cy + R * s1 * cP + R * c1 * sT * sP;
    const ox = hz * sT;
    const oy = -hz * cT * sP;
    ctx.beginPath();
    ctx.moveTo(x0 + ox, y0 + oy);
    ctx.lineTo(x1 + ox, y1 + oy);
    ctx.lineTo(x1 - ox, y1 - oy);
    ctx.lineTo(x0 - ox, y0 - oy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }

  // the face that looks at us, flat in its own plane, sheared by the tilt
  if (spread > 0.012) {
    const ox = hz * sT;
    const oy = -hz * cT * sP;
    ctx.save();
    if (cT > 0) ctx.setTransform(dpr * cT, dpr * sT * sP, 0, dpr * cP, dpr * (cx + ox), dpr * (cy + oy));
    else ctx.setTransform(dpr * -cT, dpr * -sT * sP, 0, dpr * cP, dpr * (cx - ox), dpr * (cy - oy));
    ctx.drawImage(K.face.tex, -K.face.half, -K.face.half, 2 * K.face.half, 2 * K.face.half);
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.clip();
    // darker as it turns from us
    const away = Math.pow(1 - spread, 1.4);
    ctx.fillStyle = `rgba(6,14,46,${(0.5 * away).toFixed(3)})`;
    ctx.fillRect(-R, -R, D, D);
    // a soft specular band sweeping across as it turns
    const bx = lerp(-1.6 * R, 1.6 * R, mod1(th / Math.PI + 0.21 * idx + 0.08));
    const band = ctx.createLinearGradient(bx - 0.46 * R, -0.3 * R, bx + 0.46 * R, 0.3 * R);
    band.addColorStop(0, "rgba(255,255,255,0)");
    band.addColorStop(0.5, "rgba(236,242,255,1)");
    band.addColorStop(1, "rgba(255,255,255,0)");
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.3 * Math.pow(spread, 0.8);
    ctx.fillStyle = band;
    ctx.fillRect(-R, -R, D, D);
    ctx.restore();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }
}

export const sketches = {
  coins: async (env) => {
    const view = env.canvas("2d");
    const marks = MARKS.map((m) => markImage(m, 512, "#000"));
    const shadow = shadowSprite();
    let key = "";
    let scene = null;
    let K = null;

    /* The faces depend on the stage's size, so they are made when it changes. */
    function build() {
      const { w, h, dpr } = view;
      key = `${w}x${h}@${dpr}`;
      scene = hero(w, h, dpr);
      K = COIN.map((c, i) => {
        const D = c.d * h;
        return { R: D / 2, T: 0.07 * D, D, face: coinFace(marks[i], MARKS[i], D, dpr, i) };
      });
    }

    function render(u) {
      const { ctx, w, h, dpr } = view;
      if (key !== `${w}x${h}@${dpr}`) build();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(scene.backdrop, 0, 0, w, h);
      ctx.drawImage(scene.figure, 0, 0, w, h);
      drawName(ctx, w, h);
      for (let i = 0; i < COIN.length; i++) {
        const c = COIN[i];
        const p = mod1(u - c.start) / COIN_LEN;
        if (p >= 1) continue;
        const e = lerp(p, inOut(p), 0.35);
        const y = lerp(h + K[i].D * 0.75, -K[i].D * 0.75, e);
        const x = c.x * w + c.sway * w * Math.sin(TAU * (p * 1.1 + c.phase));
        const th = c.mid + c.turns * TAU * (p - 0.5);
        drawCoin(ctx, dpr, K[i], x, y, th, c.tilt, i, shadow);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    return { mode: "loop", duration: 10, still: 0.58, render };
  },
};
