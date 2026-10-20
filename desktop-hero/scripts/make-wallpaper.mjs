/**
 * Makes the demo's wallpaper: deep blue silk, gathered to a point on the
 * left and falling away in folds, with a satin sheen and a fine grain —
 * generated, not photographed, so it is yours to use. The fluted glass is
 * drawn over it in the browser; this is only the picture it bends.
 *
 *   node scripts/make-wallpaper.mjs [out.webp] [--seed 7] [--hue blue|violet|teal|ember]
 *
 * Writes public/demo/wallpaper.webp by default, 2000 x 1600 (it is covered
 * into a 2:1 card on a desktop and a 10:16 one on a phone, so it is taller
 * than either needs).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const out = args[0] && !args[0].startsWith("--") ? path.resolve(args[0]) : path.join(root, "public/demo/wallpaper.webp");
const SEED = Number(flag("seed", 7));
const HUE = flag("hue", "blue");

const W = 2000;
const H = 1600;

/** Dark to light: the ramp the sheen is graded through. */
const RAMPS = {
  blue: [
    [0, [2, 4, 30]],
    [0.22, [6, 14, 92]],
    [0.48, [12, 40, 178]],
    [0.72, [34, 96, 238]],
    [0.9, [102, 160, 255]],
    [1, [196, 220, 255]],
  ],
  violet: [
    [0, [8, 3, 28]],
    [0.22, [30, 10, 88]],
    [0.48, [78, 30, 170]],
    [0.72, [140, 80, 236]],
    [0.9, [196, 150, 255]],
    [1, [236, 218, 255]],
  ],
  teal: [
    [0, [1, 14, 16]],
    [0.22, [3, 44, 50]],
    [0.48, [8, 98, 104]],
    [0.72, [36, 166, 168]],
    [0.9, [120, 220, 214]],
    [1, [214, 250, 244]],
  ],
  ember: [
    [0, [20, 4, 2]],
    [0.22, [70, 14, 6]],
    [0.48, [150, 40, 12]],
    [0.72, [226, 96, 34]],
    [0.9, [255, 168, 96]],
    [1, [255, 226, 196]],
  ],
};
const RAMP = RAMPS[HUE] ?? RAMPS.blue;

/** Deterministic PRNG, so a seed always makes the same silk. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(SEED);

/** Smooth value noise on a 64 x 64 lattice that wraps. */
const N = 64;
const lattice = Float32Array.from({ length: N * N }, rand);
function noise(x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const at = (i, j) => lattice[(((j % N) + N) % N) * N + (((i % N) + N) % N)];
  const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
  const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
  return a + (b - a) * sy;
}
const fbm = (x, y) => noise(x, y) * 0.6 + noise(x * 2.1, y * 2.1) * 0.28 + noise(x * 4.3, y * 4.3) * 0.12;

/* The gather point, and the folds' phases. */
const CX = W * (0.04 + rand() * 0.04);
const CY = H * (0.44 + rand() * 0.08);
const P1 = rand() * 6.28;
const P2 = rand() * 6.28;
const P3 = rand() * 6.28;

/** The cloth's height at a point: broad folds that radiate from the gather
    point, bent gently by noise, with a finer fold riding on each. */
function height(x, y) {
  const dx = x - CX;
  const dy = y - CY;
  const r = Math.hypot(dx, dy) / W;
  const bend = (fbm(x / 760, y / 760) - 0.5) * 0.8 + (fbm(x / 300 + 9, y / 300) - 0.5) * 0.12;
  const a = Math.atan2(dy, dx) + bend * 0.32;
  const big = Math.sin(a * 6 + Math.log(r + 0.05) * 1.1 + P1);
  const mid = Math.sin(a * 13 + r * 3 + P2) * 0.4;
  const small = Math.sin(a * 29 - r * 5 + P3) * 0.1;
  // Folds keep their depth as they spread: the angle changes more slowly
  // away from the gather point, so the amplitude grows with the distance.
  return (big + mid + small) * (0.35 + r * 2.4);
}

const L = normalize([0.55, -0.62, 0.56]);
const HALF = normalize([L[0], L[1], L[2] + 1]);
function normalize(v) {
  const n = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / n, v[1] / n, v[2] / n];
}

function grade(v) {
  for (let k = 1; k < RAMP.length; k++) {
    const [t1, c1] = RAMP[k];
    const [t0, c0] = RAMP[k - 1];
    if (v <= t1) {
      const f = (v - t0) / (t1 - t0);
      return [c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f];
    }
  }
  return RAMP[RAMP.length - 1][1];
}

const pixels = Buffer.alloc(W * H * 3);
const grain = mulberry32(SEED + 101);
const STEP = 1.5;
const RELIEF = 24;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const h = height(x, y);
    const gx = (height(x + STEP, y) - h) / STEP;
    const gy = (height(x, y + STEP) - h) / STEP;
    const n = normalize([-gx * RELIEF, -gy * RELIEF, 1]);
    const diffuse = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
    const spec = Math.max(0, n[0] * HALF[0] + n[1] * HALF[1] + n[2] * HALF[2]) ** 12;
    // Darker where the cloth is gathered, and toward the left edge.
    const r = Math.hypot(x - CX, y - CY) / W;
    const gather = Math.min(1, 0.35 + r * 1.4);
    let v = ((0.05 + diffuse * 0.4 + spec * 0.62) * gather) ** 1.2;
    // A fine photographic grain.
    v += (grain() + grain() + grain() - 1.5) * 0.045;
    const c = grade(Math.min(1, Math.max(0, v)));
    const i = (y * W + x) * 3;
    pixels[i] = c[0];
    pixels[i + 1] = c[1];
    pixels[i + 2] = c[2];
  }
}

await sharp(pixels, { raw: { width: W, height: H, channels: 3 } }).blur(1.1).webp({ quality: 82, effort: 6 }).toFile(out);
console.log(`${path.relative(root, out)}  ${W} x ${H}`);
