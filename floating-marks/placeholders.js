/* Stand-ins for the picture the pieces float over, all made in code so that
   nothing is downloaded:

     hero(w, h, dpr)  the backdrop (a blue satin), the figure (a bust cut out
                      with alpha, standing on the bottom edge at the right)
                      and drawName(), as canvases at the stage's pixels
     MARKS            three invented marks, drawn as paths
     markImage()      a mark painted in one colour onto its own canvas
     skins()          the three sphere finishes, 2:1 longitude-latitude maps
     plates()         three 4:5 pictures for the deck

   Swap this file for your own picture, marks and plates and the pieces
   follow: they read nothing else. */

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;

function mkCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/* Repeatable noise, so the stand-ins are the same on every load. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

function hash(x, y, seed) {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise(x, y, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  return lerp(lerp(hash(ix, iy, seed), hash(ix + 1, iy, seed), u), lerp(hash(ix, iy + 1, seed), hash(ix + 1, iy + 1, seed), u), v);
}

function fbm(x, y, seed, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x, y, seed + i);
    x = x * 2.03 + 17.1;
    y = y * 2.03 + 31.7;
    amp *= 0.5;
  }
  return sum / (1 - 0.5 ** octaves);
}

/* ── The backdrop: a satin ── */

/* A height field of folds, warped by its own noise so they flow rather than
   repeat, lit from the upper left. The shading is the slope against the
   light, plus a tight highlight along each crest, which is what makes
   cloth read as satin. Made once at 1000 × 625 and covered into any stage:
   it is smooth, so it scales. */
let satinCache = null;
function satin() {
  if (satinCache) return satinCache;
  const w = 1000;
  const h = 625;
  const k = 2.4 / h; // fold scale: two and a half across the height
  const hf = new Float32Array((w + 2) * (h + 2));
  for (let y = -1; y <= h; y++) {
    for (let x = -1; x <= w; x++) {
      const px = x * k;
      const py = y * k;
      const qx = px + 1.1 * (fbm(px * 0.5, py * 0.5, 3, 3) - 0.5);
      const qy = py + 1.1 * (fbm(px * 0.5 + 5.2, py * 0.5 + 1.3, 9, 3) - 0.5);
      // long folds running diagonally, each a rounded ridge between two
      // sharp creases (|sin|), crossed by a second, slower set
      const f1 = Math.abs(Math.sin((qx * 0.9 + qy * 0.5) * 2.6 + 3.4 * fbm(qx * 0.5, qy * 0.5, 21, 3)));
      const f2 = Math.abs(Math.sin((qx * -0.4 + qy * 0.9) * 1.7 + 4 * fbm(qx * 0.4 + 8, qy * 0.4, 27, 3)));
      hf[(y + 1) * (w + 2) + x + 1] = f1 * 0.8 + f2 * 0.6 + 0.025 * fbm(qx * 9, qy * 4, 33, 2);
    }
  }
  const out = mkCanvas(w, h);
  const g = out.getContext("2d");
  const img = g.createImageData(w, h);
  const d = img.data;
  const L = [-0.5, -0.55, 0.67];
  const H = [-0.26, -0.3, 0.92];
  const rand = seeded(5);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y + 1) * (w + 2) + x + 1;
      const dx = (hf[i + 1] - hf[i - 1]) * 9;
      const dy = (hf[i + w + 2] - hf[i - w - 2]) * 9;
      const inv = 1 / Math.hypot(dx, dy, 1);
      const nx = -dx * inv;
      const ny = -dy * inv;
      const nz = inv;
      const diff = clamp(nx * L[0] + ny * L[1] + nz * L[2]);
      const nh = clamp(nx * H[0] + ny * H[1] + nz * H[2]);
      const spec = Math.pow(nh, 48);
      const sheen = Math.pow(nh, 7);
      const t = Math.pow(clamp((diff - 0.45) / 0.5), 1.7);
      // near-black blue in the troughs, ultramarine on the slopes, ice on the crests
      const r = lerp(2, 22, t) + spec * 140 + sheen * 16;
      const gr = lerp(6, 62, t) + spec * 170 + sheen * 30;
      const b = lerp(30, 236, Math.pow(t, 0.75)) + spec * 110 + sheen * 44;
      const grain = (rand() - 0.5) * 6;
      d[(y * w + x) * 4] = clamp(r + grain, 0, 255);
      d[(y * w + x) * 4 + 1] = clamp(gr + grain, 0, 255);
      d[(y * w + x) * 4 + 2] = clamp(b + grain, 0, 255);
      d[(y * w + x) * 4 + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  satinCache = out;
  return out;
}

/* ── The figure: a bust, cut out ── */

/* Head, neck and shoulders in a navy jacket, drawn at the right of the frame
   and running off its bottom edge, from `h` CSS px of height. Faceless on
   purpose: it is there to be passed behind and in front of. */
function paintBust(g, w, h) {
  const cx = 0.72 * w;
  const u = h;
  const P = (dx, y) => [cx + dx * u, y * u];

  // the jacket
  g.beginPath();
  g.moveTo(...P(-0.07, 0.5));
  g.bezierCurveTo(...P(-0.15, 0.535), ...P(-0.3, 0.54), ...P(-0.37, 0.63));
  g.bezierCurveTo(...P(-0.405, 0.69), ...P(-0.42, 0.86), ...P(-0.43, 1.02));
  g.lineTo(...P(0.43, 1.02));
  g.bezierCurveTo(...P(0.42, 0.86), ...P(0.405, 0.69), ...P(0.37, 0.63));
  g.bezierCurveTo(...P(0.3, 0.54), ...P(0.15, 0.535), ...P(0.07, 0.5));
  g.closePath();
  const jk = g.createLinearGradient(cx - 0.4 * u, 0.55 * u, cx + 0.35 * u, 1.0 * u);
  jk.addColorStop(0, "#26356f");
  jk.addColorStop(0.45, "#101a42");
  jk.addColorStop(1, "#050818");
  g.fillStyle = jk;
  g.fill();
  // a rim of light along the shoulder the lamp is on
  g.save();
  g.clip();
  g.strokeStyle = "rgba(150,176,255,0.34)";
  g.lineWidth = 0.006 * u;
  g.beginPath();
  g.moveTo(...P(-0.15, 0.537));
  g.bezierCurveTo(...P(-0.28, 0.545), ...P(-0.34, 0.585), ...P(-0.372, 0.635));
  g.stroke();
  g.restore();

  // the neck, with the chin's shadow on it
  g.beginPath();
  g.moveTo(...P(-0.066, 0.38));
  g.bezierCurveTo(...P(-0.07, 0.45), ...P(-0.073, 0.5), ...P(-0.078, 0.56));
  g.lineTo(...P(0.078, 0.56));
  g.bezierCurveTo(...P(0.073, 0.5), ...P(0.07, 0.45), ...P(0.066, 0.38));
  g.closePath();
  const nk = g.createLinearGradient(cx - 0.08 * u, 0, cx + 0.08 * u, 0);
  nk.addColorStop(0, "#d9b8a4");
  nk.addColorStop(0.6, "#b38b78");
  nk.addColorStop(1, "#7d5a4f");
  g.fillStyle = nk;
  g.fill();
  g.save();
  g.clip();
  const chin = g.createRadialGradient(cx + 0.01 * u, 0.42 * u, 0, cx + 0.01 * u, 0.42 * u, 0.11 * u);
  chin.addColorStop(0, "rgba(40,20,22,0.66)");
  chin.addColorStop(1, "rgba(40,20,22,0)");
  g.fillStyle = chin;
  g.fillRect(cx - 0.12 * u, 0.3 * u, 0.24 * u, 0.3 * u);
  g.restore();

  // the shirt, in a V, with its collar
  g.beginPath();
  g.moveTo(...P(-0.104, 0.52));
  g.quadraticCurveTo(...P(-0.045, 0.62), ...P(0, 0.8));
  g.quadraticCurveTo(...P(0.045, 0.62), ...P(0.104, 0.52));
  g.quadraticCurveTo(...P(0, 0.555), ...P(-0.104, 0.52));
  g.closePath();
  const sh = g.createLinearGradient(cx - 0.1 * u, 0.5 * u, cx + 0.1 * u, 0.8 * u);
  sh.addColorStop(0, "#f1f4ff");
  sh.addColorStop(1, "#aab5d6");
  g.fillStyle = sh;
  g.fill();
  g.fillStyle = "#e4e9f8";
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(...P(s * 0.06, 0.505));
    g.lineTo(...P(s * 0.115, 0.51));
    g.lineTo(...P(s * 0.07, 0.585));
    g.closePath();
    g.fill();
  }
  // lapels: a darker leaf each side of the V, lit along its edge
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(...P(s * 0.115, 0.525));
    g.quadraticCurveTo(...P(s * 0.06, 0.64), ...P(s * 0.012, 0.815));
    g.quadraticCurveTo(...P(s * 0.1, 0.77), ...P(s * 0.16, 0.6));
    g.quadraticCurveTo(...P(s * 0.15, 0.55), ...P(s * 0.115, 0.525));
    g.closePath();
    g.fillStyle = "rgba(3,6,26,0.38)";
    g.fill();
    g.strokeStyle = s < 0 ? "rgba(150,176,255,0.3)" : "rgba(150,176,255,0.1)";
    g.lineWidth = 0.004 * u;
    g.beginPath();
    g.moveTo(...P(s * 0.115, 0.525));
    g.quadraticCurveTo(...P(s * 0.06, 0.64), ...P(s * 0.012, 0.815));
    g.stroke();
  }

  // the ears
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(...P(s * 0.1, 0.295), 0.016 * u, 0.034 * u, 0, 0, TAU);
    g.fillStyle = s < 0 ? "#c9a18b" : "#92695c";
    g.fill();
  }

  // the head: an egg, widest above the eyes, narrowing to a square chin
  g.beginPath();
  g.moveTo(...P(0, 0.13));
  g.bezierCurveTo(...P(0.075, 0.13), ...P(0.108, 0.2), ...P(0.104, 0.28));
  g.bezierCurveTo(...P(0.1, 0.35), ...P(0.07, 0.43), ...P(0.012, 0.442));
  g.bezierCurveTo(...P(-0.05, 0.43), ...P(-0.1, 0.35), ...P(-0.104, 0.28));
  g.bezierCurveTo(...P(-0.108, 0.2), ...P(-0.075, 0.13), ...P(0, 0.13));
  g.closePath();
  const hd = g.createRadialGradient(cx - 0.045 * u, 0.24 * u, 0.01 * u, cx - 0.01 * u, 0.29 * u, 0.17 * u);
  hd.addColorStop(0, "#f6e0d0");
  hd.addColorStop(0.45, "#d6ad96");
  hd.addColorStop(0.8, "#a07460");
  hd.addColorStop(1, "#5d3f3c");
  g.fillStyle = hd;
  g.fill();

  // the hair, swept from a parting
  const hair = new Path2D();
  hair.moveTo(...P(-0.108, 0.285));
  hair.bezierCurveTo(...P(-0.125, 0.19), ...P(-0.085, 0.115), ...P(0.005, 0.105));
  hair.bezierCurveTo(...P(0.09, 0.1), ...P(0.125, 0.18), ...P(0.106, 0.27));
  hair.bezierCurveTo(...P(0.098, 0.22), ...P(0.07, 0.185), ...P(0.02, 0.18));
  hair.bezierCurveTo(...P(-0.03, 0.2), ...P(-0.075, 0.2), ...P(-0.108, 0.285));
  hair.closePath();
  const hr = g.createLinearGradient(cx - 0.1 * u, 0.1 * u, cx + 0.1 * u, 0.25 * u);
  hr.addColorStop(0, "#3a2820");
  hr.addColorStop(0.5, "#1c1210");
  hr.addColorStop(1, "#0a0605");
  g.fillStyle = hr;
  g.fill(hair);
  g.save();
  g.clip(hair);
  g.strokeStyle = "rgba(255,220,190,0.16)";
  g.lineWidth = 0.003 * u;
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.moveTo(...P(-0.07 + i * 0.026, 0.19 - i * 0.004));
    g.quadraticCurveTo(...P(-0.04 + i * 0.026, 0.13), ...P(-0.02 + i * 0.03, 0.115));
    g.stroke();
  }
  g.restore();

  // the light's fall across the face: the lit cheek, the shaded jaw
  g.save();
  g.beginPath();
  g.moveTo(...P(0, 0.19));
  g.bezierCurveTo(...P(0.075, 0.19), ...P(0.104, 0.24), ...P(0.104, 0.28));
  g.bezierCurveTo(...P(0.1, 0.35), ...P(0.07, 0.43), ...P(0.012, 0.442));
  g.bezierCurveTo(...P(-0.05, 0.43), ...P(-0.1, 0.35), ...P(-0.104, 0.28));
  g.bezierCurveTo(...P(-0.102, 0.24), ...P(-0.07, 0.19), ...P(0, 0.19));
  g.clip();
  const jaw = g.createLinearGradient(cx - 0.1 * u, 0, cx + 0.1 * u, 0);
  jaw.addColorStop(0.45, "rgba(60,30,30,0)");
  jaw.addColorStop(1, "rgba(40,20,28,0.5)");
  g.fillStyle = jaw;
  g.fillRect(cx - 0.12 * u, 0.15 * u, 0.24 * u, 0.32 * u);
  g.restore();
}

/* The stage's picture at `dpr`: canvases of w × h CSS px × dpr, cached. */
const heroCache = new Map();
export function hero(w, h, dpr) {
  const key = `${w}x${h}@${dpr}`;
  if (!heroCache.has(key)) {
    const W = Math.round(w * dpr);
    const H = Math.round(h * dpr);
    const backdrop = mkCanvas(W, H);
    const b = backdrop.getContext("2d");
    const src = satin();
    const k = Math.max(W / src.width, H / src.height);
    b.imageSmoothingQuality = "high";
    b.drawImage(src, (W - src.width * k) / 2, (H - src.height * k) / 2, src.width * k, src.height * k);
    const figure = mkCanvas(W, H);
    const f = figure.getContext("2d");
    f.scale(dpr, dpr);
    paintBust(f, w, h);
    heroCache.set(key, { backdrop, figure });
    if (heroCache.size > 12) heroCache.delete(heroCache.keys().next().value);
  }
  return heroCache.get(key);
}

/* The name and the line under it, in Aboreto, where a hero would set them:
   large in the open space to the left of the figure. */
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

/* ── The marks ── */

/* Three invented companies, in the three shapes marks tend to come in. Each
   `draw` fills its mark with the context's fillStyle into the box x, y, w, h;
   `ar` is width : height and `wide` says it is a wordmark. */
function ring(g, cx, cy, ro, ri) {
  g.moveTo(cx + ro, cy);
  g.arc(cx, cy, ro, 0, TAU);
  g.moveTo(cx + ri, cy);
  g.arc(cx, cy, ri, 0, TAU, true);
}

export const MARKS = [
  {
    // a ring with a letter in it
    name: "NORTH",
    ar: 1,
    wide: false,
    draw(g, x, y, w, h) {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = Math.min(w, h) / 2;
      g.beginPath();
      ring(g, cx, cy, r, r * 0.88);
      // an N: two stems and the diagonal between them, one polygon
      const s = r * 0.5;
      const t = r * 0.15;
      g.moveTo(cx - s, cy + s);
      g.lineTo(cx - s, cy - s);
      g.lineTo(cx - s + t, cy - s);
      g.lineTo(cx + s - t, cy + s * 0.46);
      g.lineTo(cx + s - t, cy - s);
      g.lineTo(cx + s, cy - s);
      g.lineTo(cx + s, cy + s);
      g.lineTo(cx + s - t, cy + s);
      g.lineTo(cx - s + t, cy - s * 0.46);
      g.lineTo(cx - s + t, cy + s);
      g.closePath();
      g.fill("evenodd");
    },
  },
  {
    // a short wordmark, fitted to its box whatever face is loaded
    name: "ATLAS.BUILD",
    ar: 4.4,
    wide: true,
    draw(g, x, y, w, h) {
      g.save();
      g.font = `${h * 1.25}px Aboreto, serif`;
      g.letterSpacing = `${h * 0.1}px`;
      g.textBaseline = "alphabetic";
      const tw = g.measureText("ATLAS").width - h * 0.1;
      const cap = g.measureText("H").actualBoundingBoxAscent || h * 0.9;
      g.translate(x, y + (h + cap) / 2);
      g.scale(w / tw, 1);
      g.fillText("ATLAS", 0, 0);
      g.restore();
    },
  },
  {
    // a ring with a radial mark: twelve rays round a dot
    name: "ATLAS.LIVE",
    ar: 1,
    wide: false,
    draw(g, x, y, w, h) {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = Math.min(w, h) / 2;
      g.beginPath();
      ring(g, cx, cy, r, r * 0.9);
      g.fill("evenodd");
      g.beginPath();
      g.arc(cx, cy, r * 0.1, 0, TAU);
      g.fill();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        const long = i % 2 === 0;
        const r0 = r * 0.24;
        const r1 = r * (long ? 0.68 : 0.5);
        const half = r * 0.045;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        g.beginPath();
        g.moveTo(cx + ca * r0 - sa * half, cy + sa * r0 + ca * half);
        g.lineTo(cx + ca * r1 - sa * half, cy + sa * r1 + ca * half);
        g.lineTo(cx + ca * r1 + sa * half, cy + sa * r1 - ca * half);
        g.lineTo(cx + ca * r0 + sa * half, cy + sa * r0 - ca * half);
        g.closePath();
        g.fill();
      }
    },
  },
];

/* A mark painted in one colour onto a canvas of its own shape, `long` px on
   its longer side. */
export function markImage(mark, long, color = "#fff") {
  const w = mark.ar >= 1 ? long : long * mark.ar;
  const h = mark.ar >= 1 ? long / mark.ar : long;
  const c = mkCanvas(w, h);
  const g = c.getContext("2d");
  g.fillStyle = color;
  mark.draw(g, 0, 0, c.width, c.height);
  return c;
}

/* ── The sphere skins ── */

const SKIN = { w: 1024, h: 512 };

/* A horizontal ramp that meets itself at the seam. */
function ramp(g, w, stops) {
  const r = g.createLinearGradient(0, 0, w, 0);
  stops.forEach((c, i) => r.addColorStop(i / (stops.length - 1), c));
  return r;
}

/* Three finishes, each wrapped round a sphere as a map: the mark twice round
   the equator, one copy facing the camera at the sphere's rest and one
   behind, so a turn always brings a mark round. A sphere bends it, which is
   the distortion. In the order of MARKS. */
const FINISHES = [
  {
    // pale green, white and pink, the mark in deep green
    size: 0.64,
    ink: "#0f4f4a",
    ground(g, w, h) {
      g.fillStyle = ramp(g, w, ["#cfeee4", "#ffffff", "#f6dbe8", "#ffffff", "#cfeee4"]);
      g.fillRect(0, 0, w, h);
      const v = g.createLinearGradient(0, 0, 0, h);
      v.addColorStop(0, "rgb(246 219 232 / 55%)");
      v.addColorStop(0.5, "rgb(255 255 255 / 0%)");
      v.addColorStop(1, "rgb(176 228 210 / 60%)");
      g.fillStyle = v;
      g.fillRect(0, 0, w, h);
    },
  },
  {
    // brushed silver, the mark near-black
    size: 0.46,
    ink: "#15171b",
    ground(g, w, h) {
      const v = g.createLinearGradient(0, 0, 0, h);
      v.addColorStop(0, "#f3f5f8");
      v.addColorStop(0.45, "#d4d8de");
      v.addColorStop(0.55, "#c3c8d0");
      v.addColorStop(1, "#9ea4ae");
      g.fillStyle = v;
      g.fillRect(0, 0, w, h);
      // hairlines round the equator, each the full way round so no seam shows
      const rand = seeded(7);
      for (let i = 0; i < 900; i++) {
        g.fillStyle = rand() < 0.5 ? `rgb(255 255 255 / ${0.05 + rand() * 0.12})` : `rgb(40 44 52 / ${0.03 + rand() * 0.07})`;
        g.fillRect(0, rand() * h, w, 0.6 + rand() * 1.2);
      }
    },
  },
  {
    // black, the mark white
    size: 0.62,
    ink: "#ffffff",
    ground(g, w, h) {
      g.fillStyle = "rgb(6 8 12)";
      g.fillRect(0, 0, w, h);
      const v = g.createLinearGradient(0, 0, 0, h);
      v.addColorStop(0, "rgb(40 44 54 / 70%)");
      v.addColorStop(0.5, "rgb(0 0 0 / 0%)");
      v.addColorStop(1, "rgb(24 26 32 / 60%)");
      g.fillStyle = v;
      g.fillRect(0, 0, w, h);
    },
  },
];

export function skins() {
  return FINISHES.map((f, i) => {
    const c = mkCanvas(SKIN.w, SKIN.h);
    const g = c.getContext("2d");
    f.ground(g, SKIN.w, SKIN.h);
    const mark = MARKS[i];
    const bw = mark.wide ? f.size * SKIN.w : f.size * SKIN.h * Math.min(1, mark.ar);
    const bh = bw / mark.ar;
    g.fillStyle = f.ink;
    for (const cx of [SKIN.w / 2, 0, SKIN.w]) mark.draw(g, cx - bw / 2, SKIN.h / 2 - bh / 2, bw, bh);
    return c;
  });
}

/* ── The deck's plates ── */

const PLATE = { w: 480, h: 600 };

/* A pink-to-mint dawn: rose above, blush at the horizon, a mild green low
   down, a low sun's glow and a little grain. */
function dawn() {
  const c = mkCanvas(PLATE.w, PLATE.h);
  const g = c.getContext("2d");
  const v = g.createLinearGradient(0, 0, 0, PLATE.h);
  v.addColorStop(0, "#c2587f");
  v.addColorStop(0.42, "#e693ae");
  v.addColorStop(0.7, "#f5d4cf");
  v.addColorStop(1, "#bfe9d6");
  g.fillStyle = v;
  g.fillRect(0, 0, PLATE.w, PLATE.h);
  const sun = g.createRadialGradient(PLATE.w * 0.5, PLATE.h * 0.72, 0, PLATE.w * 0.5, PLATE.h * 0.72, PLATE.w * 0.75);
  sun.addColorStop(0, "rgba(255,246,226,0.85)");
  sun.addColorStop(0.35, "rgba(255,226,214,0.35)");
  sun.addColorStop(1, "rgba(255,226,214,0)");
  g.fillStyle = sun;
  g.fillRect(0, 0, PLATE.w, PLATE.h);
  grain(g, PLATE.w, PLATE.h, 9, 1);
  return c;
}

function grain(g, w, h, amount, seed) {
  const img = g.getImageData(0, 0, w, h);
  const rand = seeded(seed);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * amount;
    img.data[i] = clamp(img.data[i] + n, 0, 255);
    img.data[i + 1] = clamp(img.data[i + 1] + n, 0, 255);
    img.data[i + 2] = clamp(img.data[i + 2] + n, 0, 255);
  }
  g.putImageData(img, 0, 0);
}

/* Silver poured into a swirl: a twisted polar field of noise, mapped through
   a ramp of greys. */
function swirl() {
  const { w, h } = PLATE;
  const c = mkCanvas(w, h);
  const g = c.getContext("2d");
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - w * 0.46) / h;
      const dy = (y - h * 0.52) / h;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx) + r * 7.5;
      const f = fbm(Math.cos(a) * r * 4 + 3, Math.sin(a) * r * 4 + 3, 41, 4);
      const band = 0.5 + 0.5 * Math.sin(f * 15 + r * 9);
      const t = clamp(band * 0.9 + (0.5 - r) * 0.25);
      const m = lerp(34, 238, Math.pow(t, 1.35));
      const i = (y * w + x) * 4;
      img.data[i] = m * 0.97;
      img.data[i + 1] = m;
      img.data[i + 2] = m * 1.04;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/* Black with a bloom radiating from one point: rays of uneven length, a hot
   core, cool white fading to violet. */
function bloom() {
  const { w, h } = PLATE;
  const c = mkCanvas(w, h);
  const g = c.getContext("2d");
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - w * 0.5) / h;
      const dy = (y - h * 0.5) / h;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      const rays = fbm(a * 5 + 40, r * 3, 77, 3);
      const reach = 0.1 + 0.42 * Math.pow(rays, 1.4);
      const ray = clamp(1 - r / reach);
      const core = Math.exp(-r * r * 90);
      const k = clamp(Math.pow(ray, 1.6) * 0.85 + core);
      const i = (y * w + x) * 4;
      img.data[i] = lerp(6, 235, k) * (0.82 + 0.18 * k);
      img.data[i + 1] = lerp(6, 232, k) * (0.78 + 0.22 * k);
      img.data[i + 2] = lerp(10, 255, k);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

let plateCache = null;
/* In the order of MARKS: the dawn, the silver, the bloom. */
export function plates() {
  return (plateCache ??= [dawn(), swirl(), bloom()]);
}
