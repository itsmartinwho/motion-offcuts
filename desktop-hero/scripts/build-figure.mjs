/**
 * Builds the two pictures a hero figure is made from, from a photograph and
 * a trace of the person's silhouette in it:
 *
 *   <name>.webp        The photograph at full size, with everything well
 *                      outside the silhouette flattened to one colour (the
 *                      mask hides it anyway, and it is most of the bytes).
 *   <name>-mask.png    White where the person is, transparent elsewhere, at
 *                      half the photograph's size and the same shape. The
 *                      silhouette is pulled in a pixel first, so the old
 *                      background's light on the person's edge does not show
 *                      as a halo on the wallpaper, then feathered, so there
 *                      is no cut-out line.
 *
 * The trace is an SVG in the photograph's own pixel space (its viewBox is
 * "0 0 <photo width> <photo height>"): one filled path round the person,
 * with any gaps (between an arm and the body) as further subpaths, evenodd.
 * Trace it in any vector editor over the photograph, at 3-5x zoom on the
 * hair and the hands.
 *
 *   node scripts/build-figure.mjs --photo me.jpg --silhouette me.svg [--out public/hero] [--name figure]
 *       [--feather 1.1] [--tuck 1] [--keep 10] [--flat "24,44,96"]
 *
 * Then: <Hero figure={{ src: "/hero/figure.webp", mask: "/hero/figure-mask.png" }} />
 * and move it with `wide`, `mid` and `phone` (FigureFit) until it stands
 * where you want it.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const PHOTO = flag("photo");
const SILHOUETTE = flag("silhouette");
if (!PHOTO || !SILHOUETTE) {
  console.error("usage: node scripts/build-figure.mjs --photo <photo> --silhouette <trace.svg> [--out dir] [--name figure]");
  process.exit(1);
}
const OUT_DIR = path.resolve(flag("out", "public/hero"));
const NAME = flag("name", "figure");
/** The feather, a Gaussian in mask pixels; how far the silhouette is pulled
    in first, in mask pixels; how far round it the photograph is kept. */
const FEATHER = Number(flag("feather", 1.1));
const TUCK = Number(flag("tuck", 1));
const KEEP = Number(flag("keep", 10));
/** The colour the photograph is flattened to outside the silhouette. */
const FLAT = flag("flat", "24,44,96").split(",").map(Number);

fs.mkdirSync(OUT_DIR, { recursive: true });
const meta = await sharp(PHOTO).metadata();
const FW = meta.width;
const FH = meta.height;
const W = Math.round(FW / 2);
const H = Math.round(FH / 2);

/** The silhouette rasterised to W x H, as 0..255 greyscale. */
async function silhouette() {
  const { data } = await sharp(SILHOUETTE, { density: 144 })
    .resize(W, H, { fit: "fill" })
    .flatten({ background: "#000" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data;
}

/** A square max filter: the silhouette grown by `r` px. */
function grow(grey, r) {
  const tmp = new Uint8Array(W * H);
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let m = 0;
      for (let i = -r; i <= r; i++) m = Math.max(m, grey[y * W + Math.min(W - 1, Math.max(0, x + i))]);
      tmp[y * W + x] = m;
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let m = 0;
      for (let i = -r; i <= r; i++) m = Math.max(m, tmp[Math.min(H - 1, Math.max(0, y + i)) * W + x]);
      out[y * W + x] = m;
    }
  }
  return out;
}

async function buildMask(grey) {
  const tucked = TUCK > 0 ? grow(grey.map((v) => 255 - v), TUCK).map((v) => 255 - v) : grey;
  const feathered = await sharp(Buffer.from(tucked), { raw: { width: W, height: H, channels: 1 } })
    .blur(FEATHER)
    .extractChannel(0)
    .raw()
    .toBuffer();
  // White RGB, alpha = the feathered silhouette.
  const rgba = Buffer.alloc(W * H * 4, 255);
  for (let i = 0; i < W * H; i++) rgba[i * 4 + 3] = feathered[i];
  const file = path.join(OUT_DIR, `${NAME}-mask.png`);
  await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(file);
  return file;
}

async function buildFigure(grey) {
  const rgb = await sharp(PHOTO).removeAlpha().raw().toBuffer();
  // How far from the silhouette the photograph is kept: the grown mask,
  // brought up to the photograph's size and softened.
  const near = await sharp(Buffer.from(grow(grey, KEEP)), { raw: { width: W, height: H, channels: 1 } })
    .resize(FW, FH, { kernel: "cubic" })
    .blur(Math.max(0.3, KEEP * 0.7))
    .extractChannel(0)
    .raw()
    .toBuffer();
  const out = Buffer.alloc(FW * FH * 3);
  for (let i = 0; i < FW * FH; i++) {
    const k = near[i] / 255;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(rgb[i * 3 + c] * k + FLAT[c] * (1 - k));
  }
  const file = path.join(OUT_DIR, `${NAME}.webp`);
  await sharp(out, { raw: { width: FW, height: FH, channels: 3 } }).webp({ quality: 88, effort: 6, smartSubsample: true }).toFile(file);
  return file;
}

const grey = await silhouette();
for (const file of [await buildMask(grey), await buildFigure(grey)]) {
  console.log(`${path.relative(process.cwd(), file)}  ${(fs.statSync(file).size / 1024).toFixed(1)} KB`);
}
