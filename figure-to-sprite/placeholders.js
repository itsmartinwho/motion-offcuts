/* Stand-ins for the picture and the sprite, made in code so that nothing is
   downloaded:

     picture(w, h, dpr)  the backdrop (blue fluted glass), the figure (a lit 3D
                         bust, cut out with alpha, shaded so that type has form
                         to follow) and where things are in it
     drawName()          a name where a hero would set one
     sprite()            a 1-bit film: 12 frames of a sailboat on a 256 x 256
                         grid, in two bit planes
     accentAt(x, y)      which pixels of the sprite are its one accent part
     PALETTE             the picture's own colours, by the part they would
                         paint on the sprite

   The sprite's planes are the ones the transitions read. `own` (the site's
   green channel) is the pixels that belong to the sprite itself; `lit` (red)
   is every pixel that is lit, so the sprite's lit pixels are lit-and-own, and
   rain is lit-and-not-own. The left 34 columns of the film are rain and
   nothing else: the transitions tile them to rain across the whole stage.

   Swap this file for your own picture, film and palette and the transitions
   follow: they read nothing else. */

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);

function mkCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function seeded(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/* The picture's colours, by role (0-255): what the transitions' `role` palette
   paints the sprite with. The accent is the picture's skin, the outline its
   jacket, the light fill its shirt, the mid its jacket in the light. */
export const PALETTE = {
  accent: [227, 171, 141],
  outline: [78, 98, 200],
  light: [244, 241, 236],
  mid: [127, 151, 255],
};

/* ── The backdrop: fluted glass over blue ── */

let glassCache = null;
function glass() {
  if (glassCache) return glassCache;
  const w = 1200;
  const h = 750;
  const c = mkCanvas(w, h);
  const g = c.getContext("2d");
  g.fillStyle = "#050b3a";
  g.fillRect(0, 0, w, h);
  // slow pools of ultramarine, lit from the upper left
  g.globalCompositeOperation = "lighter";
  for (const [x, y, r, a] of [
    [0.18, 0.2, 0.55, 0.62],
    [0.62, 0.05, 0.5, 0.4],
    [0.9, 0.55, 0.5, 0.5],
    [0.4, 0.95, 0.55, 0.38],
  ]) {
    const p = g.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * w);
    p.addColorStop(0, `rgba(36,86,255,${a})`);
    p.addColorStop(0.5, `rgba(18,48,190,${a * 0.4})`);
    p.addColorStop(1, "rgba(18,48,190,0)");
    g.fillStyle = p;
    g.fillRect(0, 0, w, h);
  }
  g.globalCompositeOperation = "source-over";
  // the flutes: vertical ribs, each lit on one side
  const rib = 56;
  for (let x = 0; x < w; x += rib) {
    const f = g.createLinearGradient(x, 0, x + rib, 0);
    f.addColorStop(0, "rgba(255,255,255,0.05)");
    f.addColorStop(0.35, "rgba(255,255,255,0)");
    f.addColorStop(0.75, "rgba(0,4,30,0.11)");
    f.addColorStop(1, "rgba(0,4,30,0)");
    g.fillStyle = f;
    g.fillRect(x, 0, rib, h);
  }
  glassCache = c;
  return c;
}

/* ── The figure: a bust, ray-marched ── */

/* Distance fields, in world units: x right, y up, z toward the viewer. */
const ellipsoid = (x, y, z, rx, ry, rz) => {
  const k0 = Math.hypot(x / rx, y / ry, z / rz);
  const k1 = Math.hypot(x / (rx * rx), y / (ry * ry), z / (rz * rz));
  return (k0 * (k0 - 1)) / k1;
};
const capsule = (x, y, z, y0, y1, r) => Math.hypot(x, y - clamp(y, y1, y0), z) - r;
const roundBox = (x, y, z, bx, by, bz, r) => {
  const qx = Math.abs(x) - bx;
  const qy = Math.abs(y) - by;
  const qz = Math.abs(z) - bz;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
};
const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};

/* Head, jaw, brow, nose and ears; neck; shoulders on a long torso that runs
   off the bottom of the picture. */
function bust(x, y, z) {
  let head = ellipsoid(x, y - 0.62, z, 0.4, 0.47, 0.44);
  head = smin(head, ellipsoid(x, y - 0.38, z - 0.14, 0.27, 0.17, 0.28), 0.16);
  head = smin(head, ellipsoid(x, y - 0.68, z - 0.33, 0.3, 0.06, 0.14), 0.08);
  head = smin(head, ellipsoid(x, y - 0.54, z - 0.41, 0.065, 0.14, 0.1), 0.07);
  head = Math.min(head, ellipsoid(Math.abs(x) - 0.4, y - 0.6, z + 0.02, 0.04, 0.1, 0.07));
  const neck = capsule(x, y, z, 0.3, -0.3, 0.2);
  let body = smin(ellipsoid(x, y + 0.7, z, 0.92, 0.56, 0.5), roundBox(x, y + 1.9, z, 0.66, 1.2, 0.34, 0.25), 0.25);
  body = smin(body, neck, 0.16);
  return smin(head, body, 0.1);
}

const SKIN = [221, 177, 153];
const HAIR = [44, 31, 25];
const JACKET = [24, 36, 92];
const SHIRT = [234, 238, 250];

/* Where the surface at (x, y, z) is skin, hair, jacket or shirt. */
function material(x, y, z) {
  if (y < -0.12) {
    // the V of the shirt, widest at the neck, to a point low on the chest
    if (z > 0.1 && y > -1.0 && Math.abs(x) < 0.3 * (1 - (-0.12 - y) / 0.88)) return SHIRT;
    return JACKET;
  }
  if (y < 0.18) return SKIN;
  if (Math.abs(x) > 0.38 && y < 0.78) return SKIN; // the ears
  // the hairline: high on the forehead, down to the nape at the back
  if (y > 0.85 - 0.45 * clamp((0.35 - z) / 0.45) || (Math.abs(x) > 0.34 && y > 0.76)) return HAIR;
  return SKIN;
}

const LIGHT = (() => {
  const v = [-0.55, 0.55, 0.62];
  const m = Math.hypot(...v);
  return v.map((a) => a / m);
})();

/* The bust lit from the upper left front, with a soft shadow from the same
   lamp, a little ambient occlusion and a cool fill from the right. Orthographic,
   `w` x `h` px over a view 2.2 units wide; the edge pixels carry coverage in
   their alpha from how near the ray passed. */
function renderBust(w, h) {
  const px = 2.2 / w;
  const out = mkCanvas(w, h);
  const g = out.getContext("2d");
  const img = g.createImageData(w, h);
  const d = img.data;
  const e = 0.003;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const x = -1.1 + (i + 0.5) * px;
      const y = 1.28 - (j + 0.5) * px;
      let z = 2.2;
      let near = 1;
      let hit = false;
      for (let s = 0; s < 70 && z > -1.6; s++) {
        const dist = bust(x, y, z);
        if (dist < near) near = dist;
        if (dist < 0.002) {
          hit = true;
          break;
        }
        z -= dist;
      }
      const o = (j * w + i) * 4;
      if (!hit) {
        const cover = clamp(1 - near / px);
        if (cover > 0.02) {
          const m = material(x, y, z);
          d[o] = m[0] * 0.3;
          d[o + 1] = m[1] * 0.3;
          d[o + 2] = m[2] * 0.3;
          d[o + 3] = cover * 255;
        }
        continue;
      }
      // the normal, from the field's gradient
      const nx = bust(x + e, y, z) - bust(x - e, y, z);
      const ny = bust(x, y + e, z) - bust(x, y - e, z);
      const nz = bust(x, y, z + e) - bust(x, y, z - e);
      const nl = Math.hypot(nx, ny, nz) || 1;
      const n = [nx / nl, ny / nl, nz / nl];
      // a soft shadow toward the lamp
      let shade = 1;
      let t = 0.03;
      for (let s = 0; s < 18 && t < 1.5; s++) {
        const dist = bust(x + LIGHT[0] * t, y + LIGHT[1] * t, z + LIGHT[2] * t);
        shade = Math.min(shade, (8 * dist) / t);
        if (dist < 0.001) break;
        t += clamp(dist, 0.02, 0.2);
      }
      shade = clamp(shade);
      let occ = 1;
      for (let s = 1; s <= 3; s++) {
        const r = 0.06 * s;
        occ -= (r - bust(x + n[0] * r, y + n[1] * r, z + n[2] * r)) / (2 ** s * 0.06 * 3);
      }
      occ = clamp(occ);
      const lam = Math.max(n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2], 0) * shade;
      const fill = Math.max(n[0] * 0.6 + n[2] * 0.8, 0);
      const m = material(x, y, z);
      const skin = m === SKIN;
      const spec = skin ? Math.pow(Math.max(n[0] * -0.2 + n[1] * 0.28 + n[2] * 0.94, 0), 24) * shade * 0.1 : 0;
      for (let c = 0; c < 3; c++) {
        const cool = c === 2 ? 1.25 : 1;
        const v = m[c] * (0.16 * occ + 1.0 * lam * (0.55 + 0.45 * occ) + 0.1 * fill * cool) + spec * 255;
        d[o + c] = clamp(v, 0, 255);
      }
      d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return out;
}

let bustCache = null;
const BUST_W = 300;
const BUST_H = 375;

/* The stage's picture at `dpr`: canvases of w x h CSS px x dpr, and the layout
   in CSS px. The figure stands on the bottom edge at the right: `figure` is
   where the bust's picture sits, `chest` where the transitions start, `top`
   where the sweep begins (just above the head). Cached by size. */
const cache = new Map();
export function picture(w, h, dpr) {
  const key = `${w}x${h}@${dpr}`;
  if (!cache.has(key)) {
    const W = Math.round(w * dpr);
    const H = Math.round(h * dpr);
    const silk = mkCanvas(W, H);
    const s = silk.getContext("2d");
    const src = glass();
    const k = Math.max(W / src.width, H / src.height);
    s.imageSmoothingQuality = "high";
    s.drawImage(src, (W - src.width * k) / 2, (H - src.height * k) / 2, src.width * k, src.height * k);

    bustCache ??= renderBust(BUST_W, BUST_H);
    const fh = 0.86 * h;
    const fw = (fh * BUST_W) / BUST_H;
    const figure = { x: 0.72 * w - fw / 2, y: h - fh, w: fw, h: fh };
    const canvas = mkCanvas(W, H);
    const f = canvas.getContext("2d");
    f.imageSmoothingQuality = "high";
    f.drawImage(bustCache, figure.x * dpr, figure.y * dpr, figure.w * dpr, figure.h * dpr);
    cache.set(key, {
      silk,
      figure: canvas,
      layout: { figure, chest: { x: figure.x + 0.5 * figure.w, y: figure.y + 0.72 * figure.h }, top: figure.y + 0.07 * figure.h },
    });
    if (cache.size > 12) cache.delete(cache.keys().next().value);
  }
  return cache.get(key);
}

/* A name and the line under it, in Aboreto, large in the open space left of
   the figure. */
export function drawName(ctx, w, h, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "alphabetic";
  const size = 0.105 * h;
  ctx.font = `${size}px Aboreto, serif`;
  ctx.letterSpacing = `${0.02 * size}px`;
  ctx.fillText("ADA VESPER", 0.0625 * w, 0.512 * h);
  const small = 0.02 * h;
  ctx.font = `${small}px Aboreto, serif`;
  ctx.letterSpacing = `${0.3 * small}px`;
  ctx.globalAlpha = alpha * 0.8;
  ctx.fillText("FOUNDER ×3", 0.0625 * w + 2, 0.512 * h + 2.2 * small);
  ctx.restore();
}

/* ── The sprite: a sailboat, in 1 bit ── */

/* The pennant at the masthead is the sprite's one accent part: a thin shape
   no bigger than a few cells. This box holds it through every frame (the boat
   bobs and leans) and nothing else of the boat reaches into it. */
export const accentAt = (x, y) => y < 67 && x >= 118 && x <= 178;

/* An 8 x 8 ordered-dither threshold, 0..1. */
const BAYER = (() => {
  const m = [[0, 2], [3, 1]];
  let b = m;
  for (let n = 2; n < 8; n *= 2) {
    const next = [];
    for (let y = 0; y < n * 2; y++) {
      next.push([]);
      for (let x = 0; x < n * 2; x++) next[y].push(4 * b[y % n][x % n] + m[Math.floor(y / n)][Math.floor(x / n)]);
    }
    b = next;
  }
  return b.map((row) => row.map((v) => (v + 0.5) / 64));
})();

const PART = { none: 0, hull: 1, main: 2, jib: 3, mast: 4, boom: 5, pennant: 6 };
const FRAME = 256 * 256;
const FRAMES = 12;

/* One frame of the boat as a part id per pixel and a brightness per pixel
   (0..1, before dithering). The boat bobs once and leans once a loop, the
   pennant waves twice, the sails breathe. It stands at x = 133, which the
   transitions put where the figure's chest is. */
function boat(f, part, bright) {
  const t = f / FRAMES;
  const bob = 4 * Math.sin(TAU * t);
  const lean = ((3.5 * Math.PI) / 180) * Math.sin(TAU * t + 1.1);
  const cr = Math.cos(lean);
  const sr = Math.sin(lean);
  const breathe = 0.65 + 0.35 * Math.sin(TAU * t + 0.4);
  part.fill(0);
  bright.fill(0);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const dx = x + 0.5 - 133;
      const dy = y + 0.5 - (190 + bob);
      const lx = dx * cr + dy * sr;
      const ly = -dx * sr + dy * cr;
      let p = 0;
      let b = 0;
      // the hull: a half-ellipse bowl under a deck line that rises at both ends
      const deck = -10 * (lx / 74) ** 2;
      if (ly > deck && (lx / 74) ** 2 + (ly / 40) ** 2 < 1) {
        p = PART.hull;
        b = 0.5 - 0.5 * (ly / 40) - 0.28 * ((lx + 74) / 148);
        if (ly > 7 && ly < 12) b = 0.78; // the wale, a light stripe along it
      }
      // the mainsail: a curve out from the mast to a leech that bellies
      const s = (-ly - 10) / 108;
      if (s > 0 && s < 1 && lx > 4) {
        const edge = 5 + 52 * (1 - s) ** 0.9 + breathe * 9 * Math.sin(Math.PI * s);
        if (lx < edge) {
          p = PART.main;
          b = 0.94 - 0.34 * ((lx - 4) / 60) - 0.1 * s;
          if (Math.sin(lx * 0.2 + s * 2.4) > 0.86) b -= 0.4; // folds
        }
      }
      // the jib, on the other side of the mast, facing the lamp
      const j = (-ly - 8) / 94;
      if (j > 0 && j < 1 && lx < -4) {
        const edge = -5 - 58 * (1 - j) ** 1.1 - breathe * 5 * Math.sin(Math.PI * j);
        if (lx > edge) {
          p = PART.jib;
          b = 0.9 - 0.2 * j;
          if (Math.sin(lx * 0.25 - j * 2) > 0.88) b -= 0.4;
        }
      }
      // the mast, the boom and the pennant: thin, and fully lit
      if (Math.abs(lx) < 3 && ly > -138 && ly < 4) {
        p = PART.mast;
        b = 0.85;
      }
      if (lx > 3 && lx < 58 && ly > -13 && ly < -8) {
        p = PART.boom;
        b = 0.8;
      }
      if (lx > 1 && lx < 34) {
        const k = (lx - 1) / 33;
        const mid = -136 + 3.2 * Math.sin(TAU * 2 * t - lx * 0.34);
        const half = 5 * (1 - k) + 1.2;
        if (Math.abs(ly - mid) < half) {
          p = PART.pennant;
          b = 1;
        }
      }
      const i = y * 256 + x;
      part[i] = p;
      bright[i] = p ? clamp(b) : 0;
    }
  }
}

/* The film: 12 frames of the boat, then its rain, as the two planes the
   transitions read: G (the sprite's own pixels), R (lit pixels: the boat's lit
   ones and the rain). Built once, at the first call. */
let spriteCache = null;
export function sprite() {
  if (spriteCache) return spriteCache;
  const G = new Uint8Array(FRAMES * FRAME);
  const R = new Uint8Array(FRAMES * FRAME);
  const part = new Uint8Array(FRAME);
  const bright = new Float32Array(FRAME);
  for (let f = 0; f < FRAMES; f++) {
    boat(f, part, bright);
    const o = f * FRAME;
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const i = y * 256 + x;
        const p = part[i];
        if (!p) continue;
        G[o + i] = 1;
        // the outline of the hull and the sails is dark: pixels of the sprite
        // that touch the outside stay unlit
        const solid = p <= PART.jib;
        const edge = solid && (!part[i - 1] || !part[i + 1] || !part[i - 256] || !part[i + 256]);
        if (!edge && bright[i] > BAYER[y & 7][x & 7]) R[o + i] = 1;
      }
    }
  }
  // Rain: streaks that fall slanted, each living four frames, started from a
  // jittered grid so no part of the film is left dry. A streak never lives
  // across the loop's seam, so frame 11 runs into frame 0.
  const rand = seeded(23);
  const DIR = [-0.309, 0.951];
  for (let f0 = 0; f0 < FRAMES; f0++) {
    for (let cy = 0; cy < 8; cy++) {
      for (let cx = 0; cx < 8; cx++) {
        if (rand() > 0.66) continue;
        const x0 = cx * 32 + rand() * 32;
        const y0 = cy * 32 + rand() * 32;
        const len = 8 + rand() * 7;
        const speed = 19 + rand() * 4;
        for (let life = 0; life < 4; life++) {
          const f = (f0 + life) % FRAMES;
          const hx = x0 + DIR[0] * speed * life;
          const hy = y0 + DIR[1] * speed * life;
          for (let k = 0; k < len; k++) {
            const x = Math.floor(hx - DIR[0] * k + 2048) % 256;
            const y = Math.floor(hy - DIR[1] * k + 2048) % 256;
            const i = f * FRAME + y * 256 + x;
            if (!G[i]) R[i] = 1;
          }
        }
      }
    }
  }
  spriteCache = { G, R };
  return spriteCache;
}
