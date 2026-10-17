/* The ribbon: the cards on one strip, joined by half twists that carry the
   next card's name.

   The strip runs down the page. Scroll and the view slides along it; where
   two cards meet the strip twists a half turn about its own vertical axis,
   and for that stretch the view looks at the seam: a paper face, printed
   with the name of the card it leads to. Each row of the picture is drawn
   from the strip at its own angle of twist (narrower as it turns edge-on,
   darker, a faint sheen as it catches the light), which is what makes it
   one surface bending rather than a flip. The seam's paper is a plain
   stand-in: change printSeam() to print your own.

   Options (createRibbon): move and hold, in screens. The seam text comes from
   the cards' `name` and `line`. On a white ground the strip casts a soft
   shadow.
   After Simon Rogers' ribbon (loadmo.re). */

import { makeFaces, grainTile, tracked } from "./placeholders.js";
import { plan, placeOf, fadeOf, clamp, smoother, dprOf } from "./scroll.js";

const { PI, cos, sin, abs, min, exp, round, floor } = Math;

const PAPER = "#f7f6f2";
const INK = "#2a3fd1";
const GAP = 0.6; // a seam, in screens
const PERIOD = 1 + GAP;
const SPREAD = 0.15; // how far a twist reaches into the cards either side
const TWIST = GAP + 2 * SPREAD;
const T0 = 1 - SPREAD; // where the first twist begins, in screens down the strip

/* How many half turns the strip has made by `u` screens down it. */
function twistAt(u, seams) {
  const q = (u - T0) / PERIOD;
  if (q < 0) return 0;
  const i = floor(q);
  if (i >= seams) return seams;
  return i + smoother(min(1, ((q - i) * PERIOD) / TWIST));
}

/* One seam's paper, with its label at the heights in `lobes` (where the twist
   shows the face at a gentle angle). */
function printSeam(g, PW, SH, PH, lobes, label, pattern) {
  g.clearRect(0, 0, PW, SH);
  g.fillStyle = PAPER;
  g.fillRect(0, 0, PW, SH);
  g.fillStyle = pattern;
  g.fillRect(0, 0, PW, SH);
  const big = 0.09 * PH;
  const small = 0.02 * PH;
  g.fillStyle = INK;
  for (const v of lobes) {
    tracked(g, label[0], PW / 2, v + 0.012 * PH, big, 0.08, "center", PW * 0.8);
    g.globalAlpha = 0.78;
    tracked(g, label[1], PW / 2, v + 0.074 * PH, small, 0.3, "center", PW * 0.8);
    g.globalAlpha = 1;
  }
}

export function createRibbon(env, { move = 1.5, hold = 0.45 } = {}) {
  const faces = makeFaces(env.cards);
  const count = faces.canvases.length;
  const seams = count - 1;
  const pl = plan(count, move, hold, !env.reduced);
  const cv = env.canvas("2d");
  const ctx = cv.ctx;
  // each seam is drawn on both of its faces; which one shows depends on the twist
  const seamF = faces.seams.slice(1).map(() => document.createElement("canvas"));
  const seamB = faces.seams.slice(1).map(() => document.createElement("canvas"));
  const tile = grainTile();
  const at = { k: 0, f: 0, p: 0 };
  let built = "";

  function build() {
    const PW = cv.canvas.width;
    const PH = cv.canvas.height;
    const key = `${PW}x${PH}`;
    if (key === built) return;
    built = key;
    faces.build(PW, PH);
    const SH = round(GAP * PH);
    // Two lobes where the twist shows a face at a gentle angle: the upper just
    // under the card above it, the lower just over the card below.
    const vTop = 0.08 * PH;
    const vBot = SH - 0.105 * PH;
    const pattern = ctx.createPattern(tile, "repeat");
    for (let i = 0; i < seams; i++) {
      seamF[i].width = seamB[i].width = PW;
      seamF[i].height = seamB[i].height = SH;
      // Seam i starts on the front when i is even: its upper lobe is then the
      // front face and its lower lobe the back (each reads correctly).
      const front = i % 2 === 0 ? [vTop] : [vBot];
      const back = i % 2 === 0 ? [vBot] : [vTop];
      printSeam(seamF[i].getContext("2d"), PW, SH, PH, front, faces.seams[i + 1], pattern);
      printSeam(seamB[i].getContext("2d"), PW, SH, PH, back, faces.seams[i + 1], pattern);
    }
  }
  build();

  return {
    mode: "scroll",
    screens: pl.screens,
    rests: pl.rests,
    start: pl.start,
    labels: faces.names,
    resize(w, h) {
      // the runtime sizes env.canvas() before the stage's own height has settled
      // on a window resize, so take the size from the view it hands us
      const d = dprOf();
      const cw = round(w * d);
      const ch = round(h * d);
      if (cv.canvas.width !== cw || cv.canvas.height !== ch) {
        cv.canvas.width = cw;
        cv.canvas.height = ch;
      }
      cv.dpr = d;
      build();
    },
    render(s) {
      build();
      const PW = cv.canvas.width;
      const PH = cv.canvas.height;
      placeOf(pl, s, at);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, PW, PH);
      if (env.reduced) {
        // no twist: the next card fades in over the last
        ctx.drawImage(faces.canvases[at.k], 0, 0);
        if (at.f > 0) {
          ctx.globalAlpha = fadeOf(at.k + 1, at.p);
          ctx.drawImage(faces.canvases[at.k + 1], 0, 0);
          ctx.globalAlpha = 1;
        }
        return;
      }
      const off = at.p * PERIOD; // screens down the strip at the view's top
      const near = round(off / PERIOD);
      if (abs(off - near * PERIOD) < 0.0006) {
        ctx.drawImage(faces.canvases[near], 0, 0);
        return;
      }
      const rowH = PH > 1000 ? 3 : PH > 600 ? 2 : 1;
      const bow = 0.035 * sin(PI * at.f);
      const offPx = off * PH;
      const cx = PW / 2;
      for (let y = 0; y < PH; y += rowH) {
        const yc = y + rowH / 2;
        const u = (offPx + yc) / PH;
        const kk = floor(u / PERIOD);
        if (kk > seams) break;
        const r = u - kk * PERIOD;
        const th = PI * twistAt(u, seams);
        const c = cos(th);
        let src;
        let vy;
        if (r < 1) {
          src = faces.canvases[kk];
          vy = r * PH;
        } else {
          if (kk > seams - 1) continue;
          src = c >= 0 ? seamF[kk] : seamB[kk];
          vy = (r - 1) * PH;
        }
        vy = clamp(floor(vy), 0, src.height - rowH);
        const a = abs(c);
        const yn = (yc / PH) * 2 - 1;
        let dw = PW * a * (1 - bow * yn * yn);
        if (dw < 1.5) dw = 1.5;
        const dx = cx - dw / 2;
        ctx.globalAlpha = 1;
        ctx.drawImage(src, 0, vy, PW, rowH, dx, y, dw, rowH);
        // edge-on rows go dark; a faint sheen where the face catches the light
        const dark = (1 - a) ** 1.15 * 0.55;
        if (dark > 0.01) {
          ctx.globalAlpha = dark;
          ctx.fillStyle = "#070b3a";
          ctx.fillRect(dx, y, dw, rowH);
        }
        const m = ((th % PI) + PI) % PI;
        const ang = abs(m - PI / 2) * (180 / PI);
        const sheen = exp(-(((ang - 50) / 11) ** 2)) * 0.2;
        if (sheen > 0.01) {
          ctx.globalAlpha = sheen;
          ctx.fillStyle = "#fff";
          ctx.fillRect(dx, y, dw, rowH);
        }
      }
      ctx.globalAlpha = 1;
      if (env.settings.ground === "white") {
        // on the white page the strip casts a soft shadow (invisible on ink)
        ctx.save();
        ctx.globalCompositeOperation = "destination-over";
        ctx.shadowColor = "rgba(14,18,52,.34)";
        ctx.shadowBlur = 26 * cv.dpr;
        ctx.shadowOffsetY = 9 * cv.dpr;
        ctx.drawImage(cv.canvas, 0, 0);
        ctx.restore();
      }
    },
  };
}

export const sketches = {
  ribbon: (env) => createRibbon(env),
};
