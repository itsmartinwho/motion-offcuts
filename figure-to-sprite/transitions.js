/* Figure to sprite: a picture turns to type, the type turns to a 1-bit
   sprite, and the sprite plays. One sketch, `transitions`, a loop of 12 s,
   with three ways across and four palettes. The page's toggles are read every
   frame:
     env.settings.transition   erosion | rain | retype
     env.settings.palette      position | cyanotype | bright | role

   Sequence (u, 0 to 1):
     0.00-0.10  the picture and the name; the rain comes on
     0.10-0.28  a sweep slanted with the rain turns the picture to type
     0.28-0.42  it holds as type
     0.42-0.72  the transition
     0.72-1.00  the sprite holds, animating (it gives way to the picture at the seam)

   The transitions
     erosion  the original. Cell by cell from a point on the figure outward,
              with noise, glyphs give way to the sprite's own square pixels.
              Two textures (glyphs and pixels, in two sizes) fight halfway.
     rain     the type falls with the rain, column by column; a beat of rain
              alone; then the sprite condenses out of the falling drops.
     retype   the reference, and the one jjmartin.co kept. One glyph grid:
              a sweep at the rain's slant re-types each cell, like a
              departure board, until the grid holds the sprite.

   The palettes
     position   each cell takes the colour of the picture under it, lifted.
                The original. It is wrong on any other shape: the colours
                land in the wrong places, skin on a sail, a jacket on a hull.
     cyanotype  one blue ramp, from deep blue to ice white, for both.
     bright     white at three strengths and the accent part alone in pale teal.
     role       the picture's own colours, placed by part: the light fill,
                the mid, the outline, the accent.

   Everything is drawn with Canvas 2D: glyphs by drawImage from an atlas tinted
   lazily per quantised colour; the rain at the film's pixel size into small
   cached canvases; the picture through a per-cell alpha mask. Rain falls in
   front of everything, from the first frame to the last.

   The type's ramp is ASCII art's own, set in Aboreto and ordered by the ink each
   glyph carries; the retype is a split-flap departure board. The sprite and
   its rain are made in code in the manner of a 1-bit GIF. */

import { picture, drawName, sprite, accentAt, PALETTE } from "./placeholders.js";

const RAMP = "·.,:-~^=+*<>/|?%#&$@8BMW";
const RN = RAMP.length;
const RAIN_RGB = [214, 232, 255];
const NAVY = [3, 5, 15];
const NAVY_CSS = "rgb(3,5,15)";
const TEAL = [180, 252, 252];
// cyanotype: from deep blue to ice white, as stops of [position, r, g, b]
const CYAN = [
  [0, 43, 63, 214],
  [0.34, 91, 124, 255],
  [0.67, 185, 205, 255],
  [1, 243, 247, 255],
];
const RAIN_A = 0.17;
const SLANT = -0.33;
const BAND = 0.1;
const FPS = 23.976;
const GLOW_A = 0.1; // the accent's light, per cell; the cells' light adds up
const STRIP = 34; // columns of the film's left edge that are rain and nothing else
const DIR_X = -0.309;
const DIR_Y = 0.951;

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const span = (u, a, b) => clamp((u - a) / (b - a));
const ease = (x) => x * x * (3 - 2 * x);
const mix = (a, b, t) => a + (b - a) * t;

function h2(a, b = 0) {
  let x = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x7f4a7c15, 0xc2b2ae35);
  x ^= x >>> 15;
  x = Math.imul(x, 0x2c1b3c6d);
  x ^= x >>> 12;
  x = Math.imul(x, 0x297a2d39);
  x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
}

/* A colour of the picture, brought up until it reads on the dark: luminance
   raised to 0.68, the hue kept, the overflow mixed toward white. In 0..1 → 0..255. */
function lift(r, g, b, out) {
  const l = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const k = Math.max(l, 0.68) / Math.max(l, 0.02);
  let R = r * k;
  let G = g * k;
  let B = b * k;
  const m = Math.max(R, G, B);
  if (m > 1) {
    const t = clamp((m - 1) * 0.3, 0, 0.6);
    R = mix(R / m, 1, t);
    G = mix(G / m, 1, t);
    B = mix(B / m, 1, t);
  }
  out[0] = Math.round(clamp(R) * 255);
  out[1] = Math.round(clamp(G) * 255);
  out[2] = Math.round(clamp(B) * 255);
}

function box(src, cols, rows, rx, ry) {
  const out = new Float32Array(src.length);
  for (let y = 0; y < rows; y++) {
    const j0 = Math.max(0, y - ry);
    const j1 = Math.min(rows - 1, y + ry);
    for (let x = 0; x < cols; x++) {
      const i0 = Math.max(0, x - rx);
      const i1 = Math.min(cols - 1, x + rx);
      let s = 0;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) s += src[j * cols + i];
      out[y * cols + x] = s / ((j1 - j0 + 1) * (i1 - i0 + 1));
    }
  }
  return out;
}

/* The glyph atlas: the ramp in Aboreto, white, one cell each, ordered by the ink
   each carries (so sparse → dense is true), at the device's pixels. */
function buildAtlas(cwD, chD) {
  const size = chD * 1.05;
  const probe = document.createElement("canvas").getContext("2d");
  probe.font = `${size}px Aboreto, serif`;
  let maxAdv = 1;
  for (const c of RAMP) maxAdv = Math.max(maxAdv, probe.measureText(c).width);
  const sx = Math.min(1, (cwD * 1.14) / maxAdv);
  const capH = probe.measureText("H").actualBoundingBoxAscent || size * 0.7;
  const base = Math.round(chD / 2 + capH / 2);
  const raw = document.createElement("canvas");
  raw.width = cwD * RN;
  raw.height = chD;
  const r = raw.getContext("2d", { willReadFrequently: true });
  r.fillStyle = "#fff";
  r.font = `${size}px Aboreto, serif`;
  r.textAlign = "center";
  r.textBaseline = "alphabetic";
  for (let i = 0; i < RN; i++) {
    r.save();
    r.translate(i * cwD + cwD / 2, base);
    r.scale(sx, 1);
    r.fillText(RAMP[i], 0, 0);
    r.restore();
  }
  const px = r.getImageData(0, 0, raw.width, raw.height).data;
  const ink = new Float32Array(RN);
  for (let y = 0; y < chD; y++) for (let x = 0; x < raw.width; x++) ink[Math.floor(x / cwD)] += px[(y * raw.width + x) * 4 + 3];
  const order = [...Array(RN).keys()].sort((a, b) => ink[a] - ink[b]);
  const atlas = document.createElement("canvas");
  atlas.width = cwD * RN;
  atlas.height = chD;
  const a = atlas.getContext("2d");
  order.forEach((src, i) => a.drawImage(raw, src * cwD, 0, cwD, chD, i * cwD, 0, cwD, chD));
  const slot = {};
  order.forEach((src, i) => (slot[RAMP[src]] = i));
  return { atlas, slot };
}

export const sketches = {
  transitions: async (env) => {
    const view = env.canvas("2d");
    const ctx = view.ctx;
    const film = sprite();
    let S = null;

    function makeState(pic, w, h, dpr) {
      const lay = pic.layout;
      const cw = Math.max(3, Math.round(w / 220));
      const ch = Math.round(cw * 1.5);
      const cols = Math.ceil(w / cw);
      const rows = Math.ceil(h / ch);
      const N = cols * rows;
      const cwD = Math.round(cw * dpr);
      const chD = Math.round(ch * dpr);
      const A = buildAtlas(cwD, chD);
      const chestX = lay.chest.x;
      const fig = lay.figure;

      // ── the figure and the backdrop, one value a cell ──
      const sample = (src) => {
        const cv = document.createElement("canvas");
        cv.width = w;
        cv.height = h;
        const x = cv.getContext("2d", { willReadFrequently: true });
        x.drawImage(src, 0, 0, w, h);
        return x.getImageData(0, 0, w, h).data;
      };
      const fd = sample(pic.figure);
      const sd = sample(pic.silk);
      const cnt = new Float32Array(N);
      const pa = new Float32Array(N);
      const pr = new Float32Array(N);
      const pg = new Float32Array(N);
      const pb = new Float32Array(N);
      const sr = new Float32Array(N);
      const sg0 = new Float32Array(N);
      const sb = new Float32Array(N);
      for (let y = 0; y < h; y++) {
        const cy = Math.floor(y / ch);
        for (let x = 0; x < w; x++) {
          const c = cy * cols + Math.floor(x / cw);
          const i = (y * w + x) * 4;
          const a = fd[i + 3] / 255;
          cnt[c]++;
          pa[c] += a;
          pr[c] += (fd[i] / 255) * a;
          pg[c] += (fd[i + 1] / 255) * a;
          pb[c] += (fd[i + 2] / 255) * a;
          sr[c] += sd[i] / 255;
          sg0[c] += sd[i + 1] / 255;
          sb[c] += sd[i + 2] / 255;
        }
      }
      for (let c = 0; c < N; c++) {
        const n = cnt[c] || 1;
        pa[c] /= n;
        pr[c] /= n;
        pg[c] /= n;
        pb[c] /= n;
        sr[c] /= n;
        sg0[c] /= n;
        sb[c] /= n;
      }
      // the figure's cells, their colour, density and contour
      const figOn = new Uint8Array(N);
      const dPos = new Float32Array(N); // position: the picture's own brightness
      const dRel = new Float32Array(N); // the other palettes: dark parts keep a texture
      const lr = new Uint8Array(N);
      const lg = new Uint8Array(N);
      const lb = new Uint8Array(N);
      const a3 = box(pa, cols, rows, 2, 1);
      const lumA = new Float32Array(N);
      const edgeA = new Float32Array(N);
      const wLum = new Float32Array(N);
      const tmp = [0, 0, 0];
      for (let c = 0; c < N; c++) {
        if (pa[c] <= 0.45) continue;
        figOn[c] = 1;
        const r = pr[c] / pa[c];
        const g = pg[c] / pa[c];
        const b = pb[c] / pa[c];
        lift(r, g, b, tmp);
        lr[c] = tmp[0];
        lg[c] = tmp[1];
        lb[c] = tmp[2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const edge = 1 - ease(clamp((a3[c] - 0.6) / 0.35));
        lumA[c] = lum * pa[c];
        wLum[c] = pa[c];
        edgeA[c] = edge;
        dPos[c] = Math.max(clamp(0.06 + 0.94 * Math.pow(lum, 0.8)), edge * 0.62);
      }
      // for the other palettes: the figure's luminance against its 5 x 5 cell
      // neighbourhood, so the features (brow, nose, collar) show instead of one mid value
      const lumMean = box(lumA, cols, rows, 2, 2);
      const lumW = box(wLum, cols, rows, 2, 2);
      for (let c = 0; c < N; c++) {
        if (!figOn[c]) continue;
        const lum = lumA[c] / pa[c];
        const mean = lumMean[c] / Math.max(lumW[c], 1e-3);
        dRel[c] = Math.max(clamp(0.5 + (lum - mean) * 1.8 + (mean - 0.5) * 0.7), edgeA[c] * 0.66);
      }
      // the colour under a sprite cell: the figure, else the backdrop, blurred a little
      const a2 = box(pa, cols, rows, 1, 1);
      const r2 = box(pr, cols, rows, 1, 1);
      const g2 = box(pg, cols, rows, 1, 1);
      const b2 = box(pb, cols, rows, 1, 1);
      const s2r = box(sr, cols, rows, 1, 1);
      const s2g = box(sg0, cols, rows, 1, 1);
      const s2b = box(sb, cols, rows, 1, 1);
      const br = new Uint8Array(N);
      const bg = new Uint8Array(N);
      const bb = new Uint8Array(N);
      for (let c = 0; c < N; c++) {
        if (a2[c] > 0.45) lift(r2[c] / a2[c], g2[c] / a2[c], b2[c] / a2[c], tmp);
        else lift(s2r[c], s2g[c], s2b[c], tmp);
        br[c] = tmp[0];
        bg[c] = tmp[1];
        bb[c] = tmp[2];
      }
      const hs = new Float32Array(N);
      for (let c = 0; c < N; c++) hs[c] = h2(c, 4242);

      // ── the opening sweep: k per cell, slanted with the rain ──
      const top = lay.top;
      const kFig = new Float32Array(N);
      let kLo = 9;
      let kHi = -9;
      for (let c = 0; c < N; c++) {
        const cx = c % cols;
        const cy = (c / cols) | 0;
        const gx = (cx + 0.5) * cw;
        const gy = (cy + 0.5) * ch;
        kFig[c] = (gy + (gx - chestX) * SLANT - top) / (h - top);
        if (pa[c] > 0.02) {
          kLo = Math.min(kLo, kFig[c]);
          kHi = Math.max(kHi, kFig[c]);
        }
      }

      // ── the sprite's square, in the glyph grid and as pixels ──
      const side = Math.round(0.95 * h);
      const sqx = Math.round(clamp(chestX - 0.52 * side, 0, Math.max(0, w - side)));
      const sqy = h - side;
      const pxD = Math.max(1, Math.floor((0.95 * h * dpr) / 256));
      const pSide = (pxD * 256) / dpr;
      const psx = Math.round(clamp(chestX - 0.52 * pSide, 0, Math.max(0, w - pSide)));
      const psy = h - pSide;

      function makeCells(sx, sy, sd) {
        const k = 256 / sd;
        const cx0 = Math.max(0, Math.floor(sx / cw));
        const cx1 = Math.min(cols - 1, Math.floor((sx + sd - 1e-6) / cw));
        const cy0 = Math.max(0, Math.floor(sy / ch));
        const cy1 = Math.min(rows - 1, Math.floor((sy + sd - 1e-6) / ch));
        const frames = [];
        const any = new Uint8Array(N);
        for (let f = 0; f < 12; f++) {
          const spr = new Uint8Array(N);
          const dens = new Float32Array(N);
          const lit = new Float32Array(N);
          const accent = new Uint8Array(N);
          const outl = new Uint8Array(N);
          for (let cy = cy0; cy <= cy1; cy++) {
            for (let cx = cx0; cx <= cx1; cx++) {
              let x0 = Math.max(0, Math.round((cx * cw - sx) * k));
              let x1 = Math.min(256, Math.round(((cx + 1) * cw - sx) * k));
              let y0 = Math.max(0, Math.round((cy * ch - sy) * k));
              let y1 = Math.min(256, Math.round(((cy + 1) * ch - sy) * k));
              if (x0 >= 256 || y0 >= 256) continue;
              if (x1 <= x0) x1 = Math.min(256, x0 + 1);
              if (y1 <= y0) y1 = Math.min(256, y0 + 1);
              let tot = 0;
              let kc = 0;
              let lc = 0;
              let sc = 0;
              for (let y = y0; y < y1; y++) {
                for (let x = x0; x < x1; x++) {
                  const i = f * 65536 + y * 256 + x;
                  tot++;
                  if (film.G[i]) {
                    kc++;
                    if (film.R[i]) lc++;
                    if (accentAt(x, y)) sc++;
                  }
                }
              }
              if (kc / tot > 0.35) {
                const c = cy * cols + cx;
                spr[c] = 1;
                lit[c] = lc / kc;
                dens[c] = 0.06 + 0.94 * Math.pow(clamp((lc / kc) * 1.35), 0.85);
                if (sc / kc > 0.5) accent[c] = 1;
              }
            }
          }
          // the outline (dark cells touching the outside) is left blank; so are the
          // holes (cells the film leaves unlit). A lit edge cell, a mast or a pennant,
          // is part of the picture and stays
          const on = new Uint8Array(N);
          const onRole = new Uint8Array(N);
          for (let cy = cy0; cy <= cy1; cy++) {
            for (let cx = cx0; cx <= cx1; cx++) {
              const c = cy * cols + cx;
              if (!spr[c]) continue;
              const edge = cx === 0 || !spr[c - 1] || cx === cols - 1 || !spr[c + 1] || cy === 0 || !spr[c - cols] || cy === rows - 1 || !spr[c + cols];
              any[c] = 1;
              if (edge && lit[c] < 0.5) {
                outl[c] = 1;
                dens[c] = 0;
                onRole[c] = 1;
              } else if (lit[c] >= 0.12) {
                on[c] = 1;
                onRole[c] = 1;
              }
            }
          }
          frames.push({ spr, dens, accent, outl, on, onRole });
        }
        return { frames, any };
      }
      const cellsGlyph = makeCells(sqx, sqy, side);
      let cellsPixel = null;

      // ── the union of the figure's cells and the sprite's: the retype's sweep over both ──
      const visit = [];
      const visitFig = [];
      for (let c = 0; c < N; c++) {
        if (figOn[c] || cellsGlyph.any[c]) visit.push(c);
        if (figOn[c]) visitFig.push(c);
      }
      const topU = Math.min(top, sqy + 0.02 * side);
      const kn = new Float32Array(N);
      let uLo = 9;
      let uHi = -9;
      for (const c of visit) {
        const cx = c % cols;
        const cy = (c / cols) | 0;
        const v = ((cy + 0.5) * ch + ((cx + 0.5) * cw - chestX) * SLANT - topU) / (h - topU);
        kn[c] = v;
        uLo = Math.min(uLo, v);
        uHi = Math.max(uHi, v);
      }
      for (const c of visit) kn[c] = (kn[c] - uLo) / (uHi - uLo);
      // the sprite's rows, for the condensing
      let syLo = rows;
      let syHi = 0;
      for (const c of visit) if (cellsGlyph.any[c]) {
        const cy = (c / cols) | 0;
        syLo = Math.min(syLo, cy);
        syHi = Math.max(syHi, cy);
      }

      // ── erosion: when each cell turns into the sprite ──
      const turn = new Float32Array(N);
      const reach = 0.75 * fig.h;
      for (let c = 0; c < N; c++) {
        const cx = c % cols;
        const cy = (c / cols) | 0;
        const d = Math.hypot((cx + 0.5) * cw - chestX, (cy + 0.5) * ch - lay.chest.y);
        turn[c] = clamp(d / reach) * 0.82 + hs[c] * 0.12;
      }
      const pixCell = new Int32Array(65536);
      for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 256; x++) {
          const sx = psx + ((x + 0.5) * pSide) / 256;
          const sy = psy + ((y + 0.5) * pSide) / 256;
          const cx = Math.floor(sx / cw);
          const cy = Math.floor(sy / ch);
          pixCell[y * 256 + x] = cx < 0 || cy < 0 || cx >= cols || cy >= rows ? -1 : cy * cols + cx;
        }
      }
      const pixImg = new ImageData(256, 256);
      const pixCv = document.createElement("canvas");
      pixCv.width = 256;
      pixCv.height = 256;
      const pixCtx = pixCv.getContext("2d");
      const pix32 = new Uint32Array(pixImg.data.buffer);

      // ── layers: the picture through its per-cell mask ──
      const keepCv = document.createElement("canvas");
      keepCv.width = cols;
      keepCv.height = rows;
      const keepCtx = keepCv.getContext("2d");
      const keepImg = new ImageData(cols, rows);
      const photoCv = document.createElement("canvas");
      photoCv.width = view.canvas.width;
      photoCv.height = view.canvas.height;
      const photoCtx = photoCv.getContext("2d");

      // ── the tinted atlas, one row a colour, lazily ──
      const rowsCap = Math.max(16, Math.floor(16000 / chD));
      const tint = document.createElement("canvas");
      tint.width = cwD * RN;
      tint.height = chD * rowsCap;
      const tintCtx = tint.getContext("2d");
      const strip = document.createElement("canvas");
      strip.width = cwD * RN;
      strip.height = chD;
      const stripCtx = strip.getContext("2d");
      const tintRow = new Int16Array(4096).fill(-1);
      let nextRow = 0;
      function rowFor(r, g, b) {
        const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
        let row = tintRow[key];
        if (row >= 0) return row;
        if (nextRow >= rowsCap) {
          tintRow.fill(-1);
          nextRow = 0;
        }
        row = nextRow++;
        stripCtx.globalCompositeOperation = "source-over";
        stripCtx.clearRect(0, 0, strip.width, chD);
        stripCtx.fillStyle = `rgb(${(r >> 4) * 17},${(g >> 4) * 17},${(b >> 4) * 17})`;
        stripCtx.fillRect(0, 0, strip.width, chD);
        stripCtx.globalCompositeOperation = "destination-in";
        stripCtx.drawImage(A.atlas, 0, 0);
        tintCtx.clearRect(0, row * chD, strip.width, chD);
        tintCtx.drawImage(strip, 0, row * chD);
        tintRow[key] = row;
        return row;
      }

      // ── the rain: strips of the film's left edge everywhere, the film's own inside the square ──
      const pxs = side / 256;
      const ra = Math.ceil(sqx / pxs);
      const rb = Math.ceil(sqy / pxs);
      const rW = ra + Math.ceil((w - sqx) / pxs) + 1;
      const rH = rb + 257;
      const rainCv = [];
      function rain(f, hole) {
        const key = f * 2 + (hole ? 1 : 0);
        if (rainCv[key]) return rainCv[key];
        const cv = document.createElement("canvas");
        cv.width = rW;
        cv.height = rH;
        const x = cv.getContext("2d");
        const img = x.createImageData(rW, rH);
        const u32 = new Uint32Array(img.data.buffer);
        const ink = (255 << 24) | (RAIN_RGB[2] << 16) | (RAIN_RGB[1] << 8) | RAIN_RGB[0];
        const o = f * 65536;
        for (let j = 0; j < rH; j++) {
          const gy = j - rb;
          const ty = Math.floor(gy / 256);
          const ly = gy - ty * 256;
          for (let i = 0; i < rW; i++) {
            const gx = i - ra;
            let lit = 0;
            if (hole && gx >= 0 && gx < 256 && gy >= 0 && gy < 256) {
              lit = film.R[o + gy * 256 + gx] && !film.G[o + gy * 256 + gx] ? 1 : 0;
            } else {
              const tx = Math.floor(gx / STRIP);
              const lx = gx - tx * STRIP;
              const shift = Math.floor(h2(tx * 7 + 17, ty * 13 + 5) * 256);
              const at = o + ((ly + shift) % 256) * 256 + lx;
              lit = film.R[at] && !film.G[at] ? 1 : 0;
            }
            if (lit) u32[j * rW + i] = ink;
          }
        }
        x.putImageData(img, 0, 0);
        rainCv[key] = cv;
        return cv;
      }

      // ── the accent's glow: a soft sprite of light, added behind its cells only ──
      const glowSize = cw * 6;
      const glowCv = document.createElement("canvas");
      glowCv.width = glowCv.height = Math.ceil(glowSize * dpr);
      {
        const g = glowCv.getContext("2d");
        const r = glowCv.width / 2;
        const grad = g.createRadialGradient(r, r, 0, r, r, r);
        grad.addColorStop(0, "rgba(180,252,252,0.9)");
        grad.addColorStop(0.35, "rgba(180,252,252,0.4)");
        grad.addColorStop(1, "rgba(180,252,252,0)");
        g.fillStyle = grad;
        g.fillRect(0, 0, glowCv.width, glowCv.width);
      }

      // ── per-cell state for the frame ──
      const sgl = new Int8Array(N); // glyph slot, -1 none
      const sR = new Uint8Array(N);
      const sG = new Uint8Array(N);
      const sB = new Uint8Array(N);
      const sA = new Float32Array(N);
      const sP = new Float32Array(N); // the navy plate under it
      const sX = new Float32Array(N);
      const sY = new Float32Array(N);

      return {
        pic, w, h, dpr, cw, ch, cols, rows, N, A, tint, rowFor,
        figOn, dPos, dRel, lr, lg, lb, br, bg, bb, hs, kFig, kLo, kHi, kn, visit, visitFig, turn,
        cellsGlyph, syLo, syHi, side, sqx, sqy, pSide, psx, psy, pixCell, pixImg, pixCv, pixCtx, pix32,
        getCellsPixel: () => cellsPixel ?? (cellsPixel = makeCells(psx, psy, pSide)),
        keepCv, keepCtx, keepImg, photoCv, photoCtx,
        rain, pxs, ra, rb, rW, rH, glowCv, glowSize,
        sgl, sR, sG, sB, sA, sP, sX, sY,
      };
    }

    // ── colour ──
    const T = { r: 0, g: 0, b: 0, a: 1, p: 0 };
    function ramp(d) {
      d = 0.16 + 0.84 * d;
      let i = 0;
      while (i < 2 && d > CYAN[i + 1][0]) i++;
      const a = CYAN[i];
      const b = CYAN[i + 1];
      const t = clamp((d - a[0]) / (b[0] - a[0]));
      T.r = mix(a[1], b[1], t);
      T.g = mix(a[2], b[2], t);
      T.b = mix(a[3], b[3], t);
    }
    const strength = (d) => (d < 0.3 ? 0.34 : d < 0.6 ? 0.52 : 0.7);
    function colFig(c, d, cm) {
      const s = S;
      if (cm === "cyanotype") {
        ramp(d);
        T.a = 1;
        T.p = 0;
      } else if (cm === "bright") {
        T.r = T.g = T.b = 255;
        T.a = strength(d);
        T.p = 0;
      } else {
        T.r = s.lr[c];
        T.g = s.lg[c];
        T.b = s.lb[c];
        T.a = 1;
        T.p = cm === "position" ? 0.92 : 0;
      }
    }
    function colSprite(c, d, K, cm) {
      const s = S;
      const ac = K.accent[c];
      if (cm === "cyanotype") {
        ramp(d);
        T.a = 1;
        T.p = 0;
      } else if (cm === "bright") {
        if (ac) {
          T.r = TEAL[0];
          T.g = TEAL[1];
          T.b = TEAL[2];
          T.a = 1;
        } else {
          T.r = T.g = T.b = 255;
          T.a = strength(d);
        }
        T.p = 0;
      } else if (cm === "role") {
        const col = ac ? PALETTE.accent : K.outl[c] ? PALETTE.outline : d > 0.5 ? PALETTE.light : PALETTE.mid;
        T.r = col[0];
        T.g = col[1];
        T.b = col[2];
        T.a = 1;
        T.p = 0;
      } else {
        T.r = s.br[c];
        T.g = s.bg[c];
        T.b = s.bb[c];
        T.a = 1;
        T.p = 0.72;
      }
    }

    // The figure's type at a cell, `s` how far the opening sweep is past it (≥ 1: done).
    // Writes the cell's slot, colour, alpha and plate; false if there is none.
    function figCell(c, s, time, cm) {
      const st = S;
      if (s <= 0 || !st.figOn[c]) return false;
      let d = cm === "position" ? st.dPos[c] : st.dRel[c];
      let gi;
      if (s < 1) {
        d = h2(c, Math.floor(time * 20));
        gi = Math.min(RN - 1, Math.floor(d * RN));
      } else {
        gi = Math.min(RN - 1, Math.max(0, Math.round(d * (RN - 1))));
        if (h2(c, Math.floor(time * 3) * 13 + 5) < 0.035) gi = clamp(gi + (h2(c, 9) < 0.5 ? -1 : 1), 0, RN - 1);
      }
      const on = clamp(s * 1.6);
      colFig(c, d, cm);
      st.sgl[c] = gi;
      st.sR[c] = T.r;
      st.sG[c] = T.g;
      st.sB[c] = T.b;
      st.sA[c] = T.a * on;
      st.sP[c] = T.p * on;
      return true;
    }

    function render(u, time) {
      const { w: vw, h: vh, dpr: vd } = view;
      if (!S || S.w !== vw || S.h !== vh || S.dpr !== vd) S = makeState(picture(vw, vh, vd), vw, vh, vd);
      const st = S;
      const { w, h, dpr, cw, ch, cols, N } = st;
      const tm = env.settings.transition ?? "rain";
      const cm = env.settings.palette ?? "bright";
      const f = Math.floor(time * FPS) % 12;
      const seam = ease(span(u, 0.955, 1));
      const gA = 1 - seam;
      const tp = span(u, 0.42, 0.72);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(st.pic.silk, 0, 0, w, h);
      // the backdrop is graded down so that white type reads on it
      ctx.fillStyle = "rgba(3, 6, 26, 0.34)";
      ctx.fillRect(0, 0, w, h);
      drawName(ctx, w, h, u < 0.72 ? 1 - ease(tp) : seam);

      // ── how far the opening sweep is ──
      const sweepT = ease(span(u, 0.1, 0.28));
      const uAsc = mix(st.kLo - 0.03, st.kHi + BAND + 0.02, sweepT);
      const sOf = (c) => (uAsc - st.kFig[c]) / BAND;

      // ── the picture ──
      if (seam > 0) {
        ctx.globalAlpha = seam;
        ctx.drawImage(st.pic.figure, 0, 0, w, h);
        ctx.globalAlpha = 1;
      } else if (u < 0.1) {
        ctx.drawImage(st.pic.figure, 0, 0, w, h);
      } else if (u < 0.285) {
        const kd = st.keepImg.data;
        for (let c = 0; c < N; c++) kd[c * 4 + 3] = Math.round(255 * (1 - clamp(sOf(c))));
        st.keepCtx.putImageData(st.keepImg, 0, 0);
        const p = st.photoCtx;
        p.setTransform(dpr, 0, 0, dpr, 0, 0);
        p.globalCompositeOperation = "source-over";
        p.clearRect(0, 0, w, h);
        p.drawImage(st.pic.figure, 0, 0, w, h);
        p.globalCompositeOperation = "destination-in";
        p.imageSmoothingEnabled = false;
        p.drawImage(st.keepCv, 0, 0, st.cols * cw, st.rows * ch);
        p.globalCompositeOperation = "source-over";
        ctx.drawImage(st.photoCv, 0, 0, w, h);
      }

      // ── the cells' state ──
      for (const c of st.visit) st.sgl[c] = -1;
      const sf = st.cellsGlyph.frames[f];
      const sx = st.sX;
      const sy = st.sY;
      let rainBase = RAIN_A * ease(span(u, 0, 0.12));
      let wB = ease(span(u, 0.5, 0.72));
      let cf = 0;
      if (u >= 0.1 && seam < 1) {
        if (u < 0.42) {
          for (const c of st.visitFig) if (figCell(c, sOf(c), time, cm)) sx[c] = sy[c] = 0;
        } else if (tm === "retype") {
          const tpE = ease(tp);
          const onSp = cm === "role" ? sf.onRole : sf.on;
          for (const c of st.visit) {
            const tc = 0.06 + 0.88 * st.kn[c];
            const wd = 0.035 + st.hs[c] * 0.02;
            const q = (tpE - (tc - wd)) / (2 * wd);
            sx[c] = sy[c] = 0;
            const isSp = onSp[c] === 1;
            if (q <= 0) {
              figCell(c, 2, time, cm);
            } else if (q >= 1) {
              if (isSp) {
                const d = sf.dens[c];
                colSprite(c, d, sf, cm);
                st.sgl[c] = Math.min(RN - 1, Math.round(d * (RN - 1)));
                st.sR[c] = T.r;
                st.sG[c] = T.g;
                st.sB[c] = T.b;
                st.sA[c] = T.a;
                st.sP[c] = T.p;
              }
            } else {
              // the departure board: a random glyph in the palette, then the sprite's
              const was = st.figOn[c] === 1;
              if (!was && !isSp) continue;
              const d = h2(c, Math.floor(time * 20) + 7);
              const gi = Math.min(RN - 1, Math.floor(d * RN));
              let nr = 0;
              let ng = 0;
              let nb = 0;
              let np = 0;
              if (isSp) {
                colSprite(c, sf.dens[c], sf, cm);
                nr = T.r;
                ng = T.g;
                nb = T.b;
                np = T.p;
              }
              colFig(c, d, cm);
              if (cm === "bright") {
                if (isSp && sf.accent[c] && q > 0.5) {
                  T.r = TEAL[0];
                  T.g = TEAL[1];
                  T.b = TEAL[2];
                  T.a = 1;
                }
              } else if (cm !== "cyanotype") {
                // the figure's colour handing over to the sprite's
                const t = ease(q);
                if (isSp) {
                  T.r = was ? mix(st.lr[c], nr, t) : nr;
                  T.g = was ? mix(st.lg[c], ng, t) : ng;
                  T.b = was ? mix(st.lb[c], nb, t) : nb;
                }
                T.p = mix(was ? T.p : 0, isSp ? np : 0, t);
              }
              const keep = was && isSp ? 1 : isSp ? ease(clamp(q / 0.65)) : 1 - ease(clamp((q - 0.35) / 0.65));
              st.sgl[c] = gi;
              st.sR[c] = T.r;
              st.sG[c] = T.g;
              st.sB[c] = T.b;
              st.sA[c] = T.a * keep * 0.6;
              st.sP[c] = T.p * keep;
            }
          }
        } else if (tm === "rain") {
          // washed: the type falls with the rain, then the sprite condenses out of it
          const p = span(u, 0.42, 0.56);
          const onSpR = cm === "role" ? sf.onRole : sf.on;
          if (u < 0.6) rainBase = mix(RAIN_A, 0.4, ease(span(u, 0.42, 0.56)));
          else rainBase = mix(0.4, RAIN_A, ease(span(u, 0.6, 0.72)));
          wB = ease(span(u, 0.58, 0.72));
          for (const c of st.visit) {
            sx[c] = sy[c] = 0;
            if (u < 0.6) {
              if (!st.figOn[c]) continue;
              const cx = c % cols;
              const cy = (c / cols) | 0;
              const delay = h2(cx, 77) * 0.55 + (1 - cy / st.rows) * 0.1;
              const tau = clamp((p - delay) / 0.35);
              if (tau >= 1) continue;
              if (!figCell(c, 2, time, cm)) continue;
              const dist = tau * 10 + tau * tau * 0.5 * h;
              sx[c] = DIR_X * dist;
              sy[c] = DIR_Y * dist;
              const fade = 1 - ease(clamp((tau - 0.1) / 0.9));
              st.sA[c] *= fade;
              st.sP[c] *= fade;
            } else if (onSpR[c]) {
              const cy = (c / cols) | 0;
              const ry = (cy - st.syLo) / Math.max(1, st.syHi - st.syLo);
              const ta = 0.6 + 0.085 * (0.65 * ry + 0.35 * st.hs[c]);
              const dur = 0.03;
              const d = sf.dens[c];
              colSprite(c, d, sf, cm);
              if (u < ta - dur) continue;
              if (u < ta) {
                const tau = (u - (ta - dur)) / dur;
                const rem = (1 - tau * tau) * 7 * ch;
                sx[c] = -DIR_X * rem;
                sy[c] = -DIR_Y * rem;
                st.sgl[c] = st.A.slot[h2(c, 3) < 0.5 ? "|" : "/"];
                const bright = [mix(T.r, 255, 0.65), mix(T.g, 255, 0.65), mix(T.b, 255, 0.65)];
                st.sR[c] = bright[0];
                st.sG[c] = bright[1];
                st.sB[c] = bright[2];
                st.sA[c] = ease(clamp(tau * 1.4)) * 0.85;
                st.sP[c] = 0;
              } else {
                const flash = 1 - clamp((u - ta) / 0.035);
                st.sgl[c] = Math.min(RN - 1, Math.round(d * (RN - 1)));
                const k = flash * 0.7;
                st.sR[c] = mix(T.r, 255, k);
                st.sG[c] = mix(T.g, 255, k);
                st.sB[c] = mix(T.b, 255, k);
                st.sA[c] = Math.min(1, T.a + flash * 0.4);
                st.sP[c] = T.p;
              }
            }
          }
        } else {
          // erosion: cell by cell from the chest, into square pixels
          cf = ease(tp);
          for (const c of st.visitFig) {
            const since = cf - st.turn[c];
            sx[c] = sy[c] = 0;
            if (since <= 0) {
              figCell(c, 2, time, cm);
            } else if (since < 0.06) {
              const d = h2(c, Math.floor(time * 20));
              st.sgl[c] = Math.min(RN - 1, Math.floor(d * RN));
              if (cm === "position") {
                st.sR[c] = st.br[c];
                st.sG[c] = st.bg[c];
                st.sB[c] = st.bb[c];
                st.sA[c] = 1;
              } else {
                colFig(c, d, cm);
                st.sR[c] = T.r;
                st.sG[c] = T.g;
                st.sB[c] = T.b;
                st.sA[c] = T.a;
              }
              st.sP[c] = 0;
            }
          }
        }
      }

      // ── plates, then glyphs ──
      if (cm === "position") {
        ctx.fillStyle = NAVY_CSS;
        for (const c of st.visit) {
          if (st.sgl[c] < 0 || st.sP[c] <= 0.004) continue;
          ctx.globalAlpha = st.sP[c] * gA;
          ctx.fillRect((c % cols) * cw + (tm === "rain" ? sx[c] : 0), ((c / cols) | 0) * ch + (tm === "rain" ? sy[c] : 0), cw, ch);
        }
      }

      // the accent's light: behind its cells, as light, not a plate
      if (cm === "bright" && tm !== "erosion") {
        ctx.globalCompositeOperation = "lighter";
        const gz = st.glowSize;
        for (const c of st.visit) {
          if (st.sgl[c] < 0 || st.sR[c] !== TEAL[0] || st.sG[c] !== TEAL[1] || st.sB[c] !== TEAL[2]) continue;
          const a = st.sA[c] * gA;
          if (a <= 0.02) continue;
          ctx.globalAlpha = a * GLOW_A;
          ctx.drawImage(st.glowCv, (c % cols) * cw + cw / 2 - gz / 2 + sx[c], ((c / cols) | 0) * ch + ch / 2 - gz / 2 + sy[c], gz, gz);
        }
        ctx.globalCompositeOperation = "source-over";
      }

      let last = -1;
      ctx.imageSmoothingEnabled = false;
      const gw = Math.round(cw * dpr);
      const gh = Math.round(ch * dpr);
      for (const c of st.visit) {
        const g = st.sgl[c];
        if (g < 0) continue;
        const a = st.sA[c] * gA;
        if (a <= 0.004) continue;
        if (a !== last) {
          ctx.globalAlpha = a;
          last = a;
        }
        const row = st.rowFor(st.sR[c], st.sG[c], st.sB[c]);
        ctx.drawImage(st.tint, g * gw, row * gh, gw, gh, (c % cols) * cw + sx[c], ((c / cols) | 0) * ch + sy[c], cw, ch);
      }
      ctx.imageSmoothingEnabled = true;

      if (tm === "erosion" && cf > 0 && u >= 0.42 && seam < 1) drawPixels(st, f, cf, cm, gA);

      // the rain, in front of everything: strips of the film's edge outside the
      // sprite's square; inside it, the film's own rain, once the sprite has the cells
      const rainAlpha = rainBase * gA;
      if (rainAlpha > 0.004) {
        ctx.imageSmoothingEnabled = false;
        const rx = st.sqx - st.ra * st.pxs;
        const ry = st.sqy - st.rb * st.pxs;
        ctx.globalAlpha = rainAlpha * (1 - wB);
        ctx.drawImage(st.rain(f, false), rx, ry, st.rW * st.pxs, st.rH * st.pxs);
        if (wB > 0.004) {
          ctx.globalAlpha = rainAlpha * wB;
          ctx.drawImage(st.rain(f, true), rx, ry, st.rW * st.pxs, st.rH * st.pxs);
        }
        ctx.imageSmoothingEnabled = true;
      }
      ctx.globalAlpha = 1;
    }

    // The sprite as square pixels, from the chest outward.
    function drawPixels(st, f, cf, cm, gA) {
      const cellsPixel = st.getCellsPixel();
      const K = cellsPixel.frames[f];
      const o = f * 65536;
      const u32 = st.pix32;
      const navy = (Math.round(0.72 * 255) << 24) | (NAVY[2] << 16) | (NAVY[1] << 8) | NAVY[0];
      for (let i = 0; i < 65536; i++) {
        u32[i] = 0;
        if (!film.G[o + i]) continue;
        const c = st.pixCell[i];
        if (c < 0 || cf < st.turn[c]) continue;
        const lit = film.R[o + i] === 1;
        if (cm === "position") {
          u32[i] = lit ? (255 << 24) | (st.bb[c] << 16) | (st.bg[c] << 8) | st.br[c] : navy;
        } else {
          colSprite(c, K.spr[c] ? K.dens[c] : 0.4, K, cm);
          const al = Math.round(255 * clamp(T.a * (lit ? 1 : 0.45)));
          u32[i] = (al << 24) | (Math.round(T.b) << 16) | (Math.round(T.g) << 8) | Math.round(T.r);
        }
      }
      st.pixCtx.putImageData(st.pixImg, 0, 0);
      ctx.globalAlpha = gA;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(st.pixCv, st.psx, st.psy, st.pSide, st.pSide);
      ctx.imageSmoothingEnabled = true;
    }

    return { mode: "loop", duration: 12, still: 0.6, render };
  },
};
