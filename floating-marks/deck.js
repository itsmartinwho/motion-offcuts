/* Deck: three plates, each a picture with its mark at its centre, rise
   through the hero at three depths. The far one is out of focus and passes
   behind the figure; the near two are in front, sharp, and cast a shadow.
   Each leans a few degrees one way as it climbs and the other as it goes.

   How it works: Canvas 2D. A plate is drawn once per size into a sprite with
   its blur and its shadow already in it, so a frame is three drawImage calls.

   After the stacked records of Unveil.

   PLATE below sets each plate: which picture and mark (`pic`, `mark`, indexes
   into plates() and MARKS), its height (share of the stage), column, when it
   starts and how long it takes (shares of the loop), lean at the start and
   the end (degrees), sway, blur (px), alpha, shadow and scrim strength. The
   order is far, mid, near. */

import { hero, drawName, MARKS, markImage, plates } from "./placeholders.js";

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (x) => {
  x = clamp(x);
  return x * x * (3 - 2 * x);
};
const mod1 = (x) => x - Math.floor(x);
const inOut = (x) => {
  x = clamp(x);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

const PLATE = [
  { pic: 2, mark: 2, hh: 0.26, x: 0.69, start: 0.8, len: 0.97, r0: 4, r1: -2.5, sway: 0.02, cyc: 0.9, ph: 0.2, blur: 2.6, alpha: 0.7, shadow: 0, scrim: 0 },
  { pic: 1, mark: 1, hh: 0.31, x: 0.44, start: 0.076, len: 0.72, r0: -3.5, r1: 2.5, sway: 0.012, cyc: 1.0, ph: 0.55, blur: 0.7, alpha: 1, shadow: 0.42, scrim: 0.3 },
  { pic: 0, mark: 0, hh: 0.38, x: 0.17, start: 0.96, len: 0.6, r0: 3.2, r1: -2.2, sway: 0.01, cyc: 1.1, ph: 0.9, blur: 0, alpha: 1, shadow: 0.5, scrim: 0.04 },
];

function mkCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/* A box blur of a canvas, with the room around it to spread into already made. */
function blurred(src, px) {
  if (px <= 0.05) return src;
  const out = mkCanvas(src.width, src.height);
  const g = out.getContext("2d");
  if ("filter" in g) {
    g.filter = `blur(${px}px)`;
    g.drawImage(src, 0, 0);
    g.filter = "none";
  } else {
    // Safari: no canvas filter, so shrink and scale back up
    const f = Math.max(2, Math.round(px * 1.4));
    const t = mkCanvas(src.width / f, src.height / f);
    t.getContext("2d").drawImage(src, 0, 0, t.width, t.height);
    g.imageSmoothingQuality = "high";
    g.drawImage(t, 0, 0, out.width, out.height);
  }
  return out;
}

/* A plate, drawn once with its blur and shadow: the picture covered into
   4:5, rounded, the mark small at its centre, a hairline cold-white rim. */
function plateSprite(img, markImg, mark, wCss, dpr, o) {
  const ph = wCss * 1.25;
  const pad = Math.ceil(o.blur * 3 + (o.shadow ? wCss * 0.3 : 4));
  const cw = Math.round((wCss + 2 * pad) * dpr);
  const ch = Math.round((ph + 2 * pad) * dpr);
  const c = mkCanvas(cw, ch);
  const g = c.getContext("2d");
  const x = pad * dpr;
  const y = pad * dpr;
  const w = wCss * dpr;
  const h = ph * dpr;
  const r = 0.03 * w;
  if (o.shadow) {
    g.save();
    g.shadowColor = `rgba(1,4,28,${o.shadow})`;
    g.shadowBlur = 0.16 * w;
    g.shadowOffsetX = 0.025 * w;
    g.shadowOffsetY = 0.07 * w;
    g.fillStyle = "#000";
    roundRect(g, x, y, w, h, r);
    g.fill();
    g.restore();
  }
  g.save();
  roundRect(g, x, y, w, h, r);
  g.clip();
  const k = Math.max(w / img.width, h / img.height);
  g.drawImage(img, x + (w - img.width * k) / 2, y + (h - img.height * k) / 2, img.width * k, img.height * k);
  if (o.scrim) {
    g.fillStyle = `rgba(2,6,23,${o.scrim})`;
    g.fillRect(x, y, w, h);
  }
  let mw;
  let mh;
  if (mark.wide) {
    mw = 0.5 * w;
    mh = mw / mark.ar;
  } else {
    mh = 0.22 * w;
    mw = mh * mark.ar;
  }
  g.shadowColor = "rgba(0,0,0,0.3)";
  g.shadowBlur = 4 * dpr;
  g.shadowOffsetY = dpr;
  g.drawImage(markImg, x + (w - mw) / 2, y + (h - mh) / 2, mw, mh);
  g.restore();
  g.strokeStyle = "rgba(223,232,255,0.16)";
  g.lineWidth = Math.max(1, dpr);
  roundRect(g, x + 0.5 * dpr, y + 0.5 * dpr, w - dpr, h - dpr, r);
  g.stroke();
  return { c: blurred(c, o.blur * dpr), w: cw / dpr, h: ch / dpr };
}

export const sketches = {
  deck: async (env) => {
    const view = env.canvas("2d");
    const pics = plates();
    const marks = MARKS.map((m) => markImage(m, 256, "#fff"));
    let key = "";
    let scene = null;
    let sprites = null;

    function draw(ctx, p, sp, u, w, h) {
      const v = mod1(u - p.start) / p.len;
      if (v >= 1) return;
      const ph = p.hh * h;
      const e = lerp(v, inOut(v), 0.3);
      const y = lerp(h + ph * 0.62, -ph * 0.62, e);
      const x = p.x * w + p.sway * w * Math.sin(TAU * (v * p.cyc + p.ph));
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(lerp(p.r0, p.r1, smooth(v)) * DEG);
      ctx.globalAlpha = p.alpha;
      ctx.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h);
      ctx.restore();
    }

    function render(u) {
      const { ctx, w, h, dpr } = view;
      if (key !== `${w}x${h}@${dpr}`) {
        key = `${w}x${h}@${dpr}`;
        scene = hero(w, h, dpr);
        sprites = PLATE.map((p) => plateSprite(pics[p.pic], marks[p.mark], MARKS[p.mark], p.hh * h * 0.8, dpr, p));
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(scene.backdrop, 0, 0, w, h);
      draw(ctx, PLATE[0], sprites[0], u, w, h); // behind the figure
      ctx.drawImage(scene.figure, 0, 0, w, h);
      drawName(ctx, w, h);
      draw(ctx, PLATE[1], sprites[1], u, w, h);
      draw(ctx, PLATE[2], sprites[2], u, w, h);
    }

    return { mode: "loop", duration: 11, still: 0.35, render };
  },
};
