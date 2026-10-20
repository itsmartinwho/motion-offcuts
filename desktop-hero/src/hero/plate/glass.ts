/*
 * The live picture in a post's icon: lines of text set in the caps face and
 * read through fluted glass — Paper Design's "contour" flutes, done on a 2D
 * canvas — and, when the icon is engaged, a scene's colour leaking through.
 *
 * Two regimes, one picture:
 *
 *   At rest the flutes are refracted once, into a strip as tall as the block
 *   of type, and each frame is one or two blits of that strip, rising slowly.
 *   Nothing else is drawn.
 *
 *   Engaged (hover or keyboard focus on the icon's link) the strip is set
 *   aside and the flutes are drawn live: they relax until the line can be
 *   read, the type rises faster, the outline trembles off its fill, and a
 *   depth band sweeps across and tears the type open around itself. The
 *   colour lives in CSS: an exclusion wash over the plate, driven from here.
 *
 *   Lit (a screen with no hover): the plate rests in the engaged look.
 *
 *   Asleep, a plate that has drawn once and is not engaged is skipped: it
 *   holds its frame and costs nothing until it is woken.
 *
 * Every plate shares one ticker, and only plates on (or nearly on) screen
 * are on it; they set their type one plate a frame, so a desktop of them
 * never lands all at once. No WebGL: a desktop of twelve icons must not cost
 * twelve contexts.
 */

export type RGB = readonly [number, number, number];

export interface Ramp {
  /** The plate's darkest note and the tint it lifts toward. Both CSS. */
  ground: RGB;
  deep: RGB;
  /** The type: its fill, and its misregistered outline. */
  ink: RGB;
  edge: RGB;
}

export interface GlassOptions {
  host: HTMLElement;
  canvas: HTMLCanvasElement;
  /** The lines to set, one entry per paragraph. */
  quotes: string[];
  ramp: Ramp;
  /** Where on the colour curve this plate's wash sits. */
  phase: number;
  /** Rest engaged: the plate's look at rest is the engaged one, for a
      screen with no hover to engage it. Asleep, a lit plate draws that look
      once and holds it. */
  lit?: boolean;
}

/** Flutes across the plate. Mirrored in CSS (--flutes). */
export const FLUTES = 14;

/*
 * Paper's "contour" flute, at the plates' distortion (0.35 → 1.05 here):
 * across one flute, x in 0..1 samples the picture at s(x). The middle 60% is
 * a 1:1 copy shifted a quarter-flute left; the left edge is the region to its
 * right squeezed and folded back, the right edge a squeezed preview of the
 * next flute. Seven cuts are enough to carry the curve.
 */
export const CUTS = [0, 0.05, 0.1, 0.2, 0.8, 0.9, 0.95, 1];
export const DISTORTION = 1.05;
export const contour = (x: number, k: number) => x + k * ((2 * x - 1) ** 6 - 0.25);

/** The scene's outline passes: offset x, offset y, line width — in em. */
const OUTLINE_PASSES: [number, number, number][] = [
  [-0.05, -0.045, 0.017],
  [0.035, 0.055, 0.009],
];

/** Rise, in CSS px per second, at rest and engaged. */
const RISE_REST = 7;
const RISE_ENGAGED = 26;
const REST_FRAME_MS = 1000 / 30;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const rgb = ([r, g, b]: RGB, a = 1) => `rgb(${r} ${g} ${b} / ${a})`;

function canvas2d(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  return { canvas, ctx };
}

/** Deterministic PRNG — the tear's noise is the same on every visit. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── Type ──────────────────────────────────────────────────────────────── */

function wrapGreedy(words: string[], maxChars: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Wrap to at most `maxChars` a line, then even the lines out. */
function wrapWords(text: string, maxChars: number): string[] {
  const words = text.toUpperCase().split(/\s+/).filter(Boolean);
  const greedy = wrapGreedy(words, maxChars);
  if (greedy.length <= 1) return greedy;
  const total = words.join(" ").length;
  for (let target = Math.ceil(total / greedy.length); target <= maxChars; target++) {
    const balanced = wrapGreedy(words, target);
    if (balanced.length <= greedy.length) return balanced;
  }
  return greedy;
}

interface Block {
  rows: string[];
  /** Font size, line advance and cap height, in CSS px. */
  size: number;
  advance: number;
  cap: number;
  /** One pass of the block, in CSS px; it repeats with no seam. */
  height: number;
}

/**
 * The opening act as one block: each quote wrapped, a blank line between
 * them and one before the block comes round again. Sized so the widest line
 * nearly spans the plate, and repeated until one pass is taller than it.
 */
function setBlock(quotes: string[], family: string, W: number, H: number): Block {
  const probe = canvas2d(1, 1).ctx;
  probe.font = `400 100px ${family}`;
  const cap = (probe.measureText("H").actualBoundingBoxAscent || 70) / 100;
  const maxChars = W < 380 ? 11 : 13;
  const rows: string[] = [];
  quotes.forEach((quote, n) => {
    if (n) rows.push("");
    rows.push(...wrapWords(quote, maxChars));
  });
  rows.push("");
  let widest = 1;
  for (const row of rows) widest = Math.max(widest, probe.measureText(row).width / 100);
  const size = Math.max(H * 0.13, Math.min((W * 0.86) / widest, H * 0.24));
  const advance = size * 1.06;
  const once = rows.slice();
  while (rows.length * advance < H + advance) rows.push(...once);
  return { rows, size, advance, cap: cap * size, height: rows.length * advance };
}

type Layer = "soft" | "fill" | "line";

/** Far enough off the canvas that only a shadow cast back onto it lands. */
const OFFSTAGE = 20000;

/**
 * One layer of the block on transparent, at `scale` device px per CSS px:
 * the fill, its misregistered outline, or the fill out of focus. `margin`
 * pads both sides, so the flutes at the plate's edges have picture to fold.
 *
 * The soft layer is the fill's shadow alone — the glyphs drawn far off the
 * canvas and their blur cast back onto it — which blurs in every browser,
 * where the context's `filter` does not.
 */
function paintLayer(
  block: Block,
  family: string,
  W: number,
  margin: number,
  scale: number,
  layer: Layer,
  colour: string,
): HTMLCanvasElement {
  const { canvas, ctx } = canvas2d((W + margin * 2) * scale, block.height * scale);
  ctx.scale(scale, scale);
  ctx.font = `400 ${block.size}px ${family}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  if (layer === "soft") {
    ctx.shadowColor = colour;
    ctx.shadowBlur = block.size * 0.16 * scale;
    ctx.shadowOffsetX = OFFSTAGE * scale;
    ctx.fillStyle = "#000";
  }
  const cx = margin + W / 2 - (layer === "soft" ? OFFSTAGE : 0);
  block.rows.forEach((row, i) => {
    if (!row) return;
    const baseline = (i + 0.5) * block.advance + block.cap / 2;
    if (layer !== "line") {
      ctx.fillStyle = layer === "fill" ? colour : "#000";
      ctx.fillText(row, cx, baseline);
      // Twice: one blurred pass is too faint to carry the picture.
      if (layer === "soft") ctx.fillText(row, cx, baseline);
      return;
    }
    ctx.strokeStyle = colour;
    for (const [dx, dy, lw] of OUTLINE_PASSES) {
      ctx.lineWidth = lw * block.size;
      ctx.strokeText(row, cx + dx * block.size, baseline + dy * block.size);
    }
  });
  return canvas;
}

/** How much of each layer shows at engagement `e`: at rest, the soft one
    and a trace of the fill to give it an edge; engaged, the type in focus. */
const mix = (e: number) => ({ soft: 1 - e, fill: 0.1 + 0.9 * e, line: e });

/* ── Grain ─────────────────────────────────────────────────────────────── */

let grainUrl: string | null = null;

/**
 * The scene's photocopier grain, at a quarter of its size: mid-grey speckle
 * with soft blotches and a few vertical streaks. Painted once per page and
 * shared by every plate through a custom property on the root.
 */
function shareGrain() {
  if (grainUrl) return;
  const W = 256;
  const { canvas, ctx } = canvas2d(W, W);
  const rand = mulberry32(5);
  const cells = 6;
  const grid = Array.from({ length: cells * cells }, rand);
  const streak = Array.from({ length: W }, () => (rand() < 0.04 ? 0.06 + rand() * 0.08 : 0));
  const img = ctx.createImageData(W, W);
  const s = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < W; y++) {
    const gy = (y / W) * cells;
    const y0 = Math.floor(gy);
    const fy = s(gy - y0);
    for (let x = 0; x < W; x++) {
      const gx = (x / W) * cells;
      const x0 = Math.floor(gx);
      const fx = s(gx - x0);
      const at = (cx: number, cy: number) => grid[(cy % cells) * cells + (cx % cells)];
      const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx;
      const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx;
      const blot = top + (bottom - top) * fy;
      const v = 0.24 + (blot - 0.5) * 0.12 + (rand() - 0.5) * 0.22 + streak[x];
      const c = Math.round(clamp01(v) * 255);
      const i = (y * W + x) * 4;
      img.data[i] = c;
      img.data[i + 1] = c;
      img.data[i + 2] = c;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  grainUrl = canvas.toDataURL("image/png");
  document.documentElement.style.setProperty("--hero-plate-grain", `url(${grainUrl})`);
}

/* ── The tear ──────────────────────────────────────────────────────────── */

/**
 * The plates' depth field reduced to the one axis a slice can use: mostly 1,
 * with a turbulent band. Sampled at u + sweep, so the band crosses the plate
 * as the sweep runs; the vertex shader's `w` becomes each slice's divisor.
 */
function makeDepth(seed: number) {
  const N = 96;
  const rand = mulberry32(seed);
  const coarse = Array.from({ length: 9 }, rand);
  const fine = Array.from({ length: N }, rand);
  const noise = (u: number) => {
    const f = ((u % 1) + 1) % 1;
    const c = f * 8;
    const c0 = Math.floor(c);
    const k = c - c0;
    const smoothK = k * k * (3 - 2 * k);
    const coarseV = coarse[c0] + (coarse[c0 + 1] - coarse[c0]) * smoothK;
    return 0.55 * coarseV + 0.45 * fine[Math.floor(f * N)];
  };
  return (u: number) => {
    const f = ((u % 1) + 1) % 1;
    const band = Math.sin(Math.PI * f) ** 6;
    return 1 - band * (0.2 + 0.75 * noise(u * 1.7));
  };
}

/* ── The wash ──────────────────────────────────────────────────────────── */

/**
 * The engaged colour: a curve of three sines at different rates. A plate
 * sits at its own point on it (its phase) and drifts a little either side.
 * Lifted off black, since an exclusion wash of black is no wash.
 */
export function washAt(c: number): string {
  const r = Math.max(0, Math.sin(c * 3)) * 75;
  const g = Math.max(0, Math.sin(c * 2)) * 155;
  const b = Math.max(0, Math.sin(c * 2.5)) * 155;
  const lift = Math.max(0, 110 - (r + g + b) / 2);
  return `${Math.round(r + lift * 0.3)} ${Math.round(g + lift * 0.7)} ${Math.round(b + lift)}`;
}

/* ── One plate ─────────────────────────────────────────────────────────── */

class GlassPlate {
  private readonly ctx: CanvasRenderingContext2D;
  private family = "";
  private W = 0;
  private H = 0;
  private scale = 1;
  private margin = 0;
  private block: Block | null = null;
  /** The flutes refracted once, at rest: as wide as the plate, one block tall. */
  private strip: HTMLCanvasElement | null = null;
  /** The raw layers, each painted when first needed, kept only while engaged. */
  private layers: Partial<Record<Layer, HTMLCanvasElement>> = {};
  /** The size or the face changed; repaint on the next frame with budget. */
  private stale = false;
  private readonly depth: (u: number) => number;
  private offset = 0;
  private level = 0;
  private target = 0;
  private sweep = 0;
  private lastDraw = 0;
  private lastTick = 0;
  private disengagedAt = 0;
  private painted = false;
  /** Where the plate rests: 0, or 1 for a lit plate. */
  private readonly rest: number;
  /** A pointer or keyboard focus is on it. */
  private pointer = false;
  /** The wash has been set at least once. */
  private washed = false;
  visible = false;
  disposed = false;

  constructor(
    private readonly o: GlassOptions,
    private readonly still: boolean,
  ) {
    const ctx = o.canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas unavailable");
    this.ctx = ctx;
    this.depth = makeDepth(7 + Math.round(o.phase * 100));
    this.rest = o.lit ? 1 : 0;
    this.level = this.target = this.rest;
    // Written now, since the ticker writes it only when it changes (and a
    // plate re-mounted on the same host must not keep the last one's).
    o.host.style.setProperty("--engage", String(this.rest));
    o.host.dataset.engage = this.rest > 0 ? "on" : "off";
  }

  setFamily(family: string) {
    this.family = family;
    this.resize();
  }

  engage(on: boolean) {
    this.pointer = on;
    this.target = on ? 1 : this.rest;
    this.o.host.dataset.engaged = on ? "true" : "false";
    wake();
  }

  /** Note the plate's size; the type is re-set when there is budget for it. */
  resize() {
    const W = this.o.host.clientWidth;
    const H = this.o.host.clientHeight;
    if (!this.family || W < 2 || H < 2) return;
    if (W === this.W && H === this.H && this.strip) return;
    this.W = W;
    this.H = H;
    this.stale = true;
    wake();
  }

  /**
   * Set the type and refract it — a few milliseconds of canvas work, so the
   * ticker allows one plate a frame, and only plates near the screen.
   */
  private paint(now: number) {
    this.stale = false;
    const { W, H } = this;
    // The plate is soft behind its glass anyway; 1.5× keeps the engaged type
    // crisp enough to read without paying for a full retina canvas.
    this.scale = Math.min(1.5, window.devicePixelRatio || 1);
    this.margin = (W / FLUTES) * 2;
    this.o.canvas.width = Math.round(W * this.scale);
    this.o.canvas.height = Math.round(H * this.scale);
    this.block = setBlock(this.o.quotes, this.family, W, H);
    this.layers = {};
    this.strip = this.refract(DISTORTION);
    if (this.level === 0) this.layers = {};
    this.draw(now);
    if (!this.painted) {
      this.painted = true;
      this.o.host.dataset.glass = "ready";
    }
  }

  private layer(name: Layer) {
    const cached = this.layers[name];
    if (cached) return cached;
    const { ramp } = this.o;
    // Out of focus the type is the ramp's mid-tone; in focus it is near
    // white, so that the wash, when it comes up, turns it inside out.
    const colour =
      name === "soft" ? rgb(ramp.ink) : name === "fill" ? rgb(ramp.edge, 0.86) : rgb(ramp.edge, 0.62);
    const painted = paintLayer(this.block!, this.family, this.W, this.margin, this.scale, name, colour);
    this.layers[name] = painted;
    return painted;
  }

  /** The block at rest, refracted at distortion `k`, into a strip one pass tall. */
  private refract(k: number) {
    const block = this.block!;
    const { canvas, ctx } = canvas2d(this.W * this.scale, block.height * this.scale);
    const h = canvas.height;
    const alpha = mix(0);
    const soft = this.layer("soft");
    const fill = this.layer("fill");
    this.eachSlice(k, (sx, sw, dx, dw) => {
      ctx.globalAlpha = alpha.soft;
      ctx.drawImage(soft, sx, 0, sw, h, dx, 0, dw, h);
      ctx.globalAlpha = alpha.fill;
      ctx.drawImage(fill, sx, 0, sw, h, dx, 0, dw, h);
    });
    return canvas;
  }

  /**
   * Walk every slice of every flute: source x and width (into a layer, which
   * carries the margin), destination x and width, in device px; and where
   * across the plate the slice sits, 0..1.
   */
  private eachSlice(
    k: number,
    fn: (sx: number, sw: number, dx: number, dw: number, u: number) => void,
  ) {
    const F = (this.W / FLUTES) * this.scale;
    const m = this.margin * this.scale;
    for (let i = 0; i < FLUTES; i++) {
      const x0 = i * F;
      for (let c = 0; c < CUTS.length - 1; c++) {
        const a = CUTS[c];
        const b = CUTS[c + 1];
        const sa = contour(a, k);
        const sb = contour(b, k);
        const sx = m + x0 + Math.min(sa, sb) * F;
        const sw = Math.max(0.5, Math.abs(sb - sa) * F);
        const dx = x0 + a * F;
        const dw = (b - a) * F;
        fn(sx, sw, dx, dw, (x0 + ((a + b) / 2) * F) / (FLUTES * F));
      }
    }
  }

  tick(now: number) {
    const dt = this.lastTick ? Math.min(0.1, (now - this.lastTick) / 1000) : 0;
    this.lastTick = now;
    // In over ~0.45s, out over ~0.7s.
    const tau = this.target > this.level ? 0.45 : 0.7;
    const prev = this.level;
    this.level += (this.target - this.level) * (1 - Math.exp(-dt / tau));
    if (Math.abs(this.target - this.level) < 0.002) this.level = this.target;

    const host = this.o.host;
    // Asleep, settled where it rests and drawn: nothing moves until it is
    // woken or engaged, so the type does not jump when it is.
    const held = host.dataset.asleep === "true" && this.painted && !this.pointer && this.level === this.target;
    if (!held) {
      this.offset += dt * (RISE_REST + (RISE_ENGAGED - RISE_REST) * this.level);
      if (this.level > 0) this.sweep += dt / 3.6;
    }

    if (this.level !== prev) {
      host.style.setProperty("--engage", this.level.toFixed(3));
      host.dataset.engage = this.level > 0 ? "on" : "off";
    }
    if (this.level > 0) {
      if (!held || !this.washed) {
        host.style.setProperty("--wash", washAt(this.o.phase + Math.sin(now / 7000) * 0.14));
        this.washed = true;
      }
      this.disengagedAt = 0;
    } else if (this.layers.soft) {
      // Let the raw layers go a little after the plate settles.
      this.disengagedAt ||= now;
      if (now - this.disengagedAt > 4000) this.layers = {};
    }

    if (this.stale) {
      if (paintBudget <= 0) return;
      paintBudget--;
      this.paint(now);
      return;
    }
    if (held) return;
    // At rest, 30 fps; engaged, the display's rate — but a lit plate at
    // rest is engaged only in look, and keeps to 30.
    const engaged = this.level > 0 && (this.pointer || this.rest === 0);
    if (!engaged && now - this.lastDraw < REST_FRAME_MS) return;
    this.draw(now);
  }

  private draw(now: number) {
    const { block, strip, ctx } = this;
    if (!block || !strip) return;
    this.lastDraw = now;
    const s = this.scale;
    const Hd = this.o.canvas.height;
    const Wd = this.o.canvas.width;
    // The strip and the layers are all one pass of the block tall, rounded
    // to the same whole pixel.
    const period = strip.height;
    const oy = ((this.offset * s) % period + period) % period;
    ctx.clearRect(0, 0, Wd, Hd);

    if (this.level === 0) {
      // At rest: the strip, rising — one blit, two across the seam.
      const first = Math.min(Hd, period - oy);
      ctx.drawImage(strip, 0, oy, Wd, first, 0, 0, Wd, first);
      if (first < Hd) ctx.drawImage(strip, 0, 0, Wd, Hd - first, 0, first, Wd, Hd - first);
      return;
    }

    const e = this.level;
    const k = DISTORTION * (1 - 0.82 * e);
    const t = now / 1000;
    // The outline trembles against the fill, as on the scene's plates.
    const jitter = this.still ? 0 : Math.sin(t * 58) * 0.003 * Wd * e;
    // The band crosses the plate, rests off it, and comes round again.
    const phase = this.sweep % 1;
    const sweepU = -0.75 + phase * 1.5;
    const bite = 0.85 * e * smooth(0, 0.12, phase) * (1 - smooth(0.88, 1, phase));
    const cy = Hd / 2;
    const cx = Wd / 2;
    const alpha = mix(e);
    const layers = { soft: this.layer("soft"), fill: this.layer("fill"), line: this.layer("line") };

    this.eachSlice(k, (sx, sw, dx, dw, u) => {
      const d = this.depth(u - sweepU + 0.5);
      const w = 1 + (Math.max(d, 0.16) - 1) * bite;
      const grow = 1 / w;
      // Away from the plate's middle by 1/w — the tear opening.
      const mid = dx + dw / 2;
      const tx = (mid - cx) * (grow - 1);
      const blit = (layer: Layer, ox: number) => {
        if (alpha[layer] < 0.004) return;
        ctx.globalAlpha = alpha[layer];
        const src = layers[layer];
        const first = Math.min(Hd, period - oy);
        ctx.drawImage(src, sx + ox, oy, sw, first, dx + tx, cy + (0 - cy) * grow, dw, first * grow);
        if (first < Hd) {
          const rest = Hd - first;
          ctx.drawImage(src, sx + ox, 0, sw, rest, dx + tx, cy + (first - cy) * grow, dw, rest * grow);
        }
      };
      blit("soft", 0);
      blit("fill", 0);
      blit("line", jitter);
    });
    ctx.globalAlpha = 1;
  }

  dispose() {
    this.disposed = true;
    this.strip = null;
    this.layers = {};
  }
}

/* ── The shared ticker ─────────────────────────────────────────────────── */

const plates = new Set<GlassPlate>();
let raf = 0;
/** Plates that may (re)paint their type this frame. */
let paintBudget = 0;

function loop(now: number) {
  raf = 0;
  paintBudget = 1;
  let any = false;
  for (const plate of plates) {
    if (!plate.visible) continue;
    any = true;
    plate.tick(now);
  }
  if (any) raf = requestAnimationFrame(loop);
}

function wake() {
  if (!raf) raf = requestAnimationFrame(loop);
}

/** Wake all plates on their next frame (a plate was woken). */
export function wakePlates() {
  wake();
}

let visibility: IntersectionObserver | null = null;
const byHost = new WeakMap<Element, GlassPlate>();

function observer() {
  visibility ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const plate = byHost.get(entry.target);
        if (!plate) continue;
        plate.visible = entry.isIntersecting;
      }
      wake();
    },
    // A little ahead of the screen, so a plate has painted before it arrives.
    { rootMargin: "240px 0px" },
  );
  return visibility;
}

let familyPromise: Promise<string> | null = null;

/** The caps face as the canvas must name it, once it can draw with it. */
function capsFamily(probe: HTMLElement): Promise<string> {
  familyPromise ??= (() => {
    const family = getComputedStyle(probe).fontFamily;
    return document.fonts
      .load(`400 100px ${family}`)
      .catch(() => undefined)
      .then(() => family);
  })();
  return familyPromise;
}

/**
 * Mount the glass on one plate. Returns its teardown. Hover and keyboard
 * focus come from the link the plate sits in.
 */
export function mountPlate(o: GlassOptions): () => void {
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let plate: GlassPlate;
  try {
    plate = new GlassPlate(o, still);
  } catch {
    return () => undefined;
  }
  shareGrain();
  plates.add(plate);
  byHost.set(o.host, plate);
  const visibility = observer();
  visibility.observe(o.host);

  const link = o.host.closest("a");
  const on = () => plate.engage(true);
  const off = () => plate.engage(false);
  const focusOn = () => {
    if (link?.matches(":focus-visible")) on();
  };
  if (link) {
    link.addEventListener("pointerenter", on);
    link.addEventListener("pointerleave", off);
    link.addEventListener("focus", focusOn);
    link.addEventListener("blur", off);
  }

  const resize = new ResizeObserver(() => plate.resize());
  resize.observe(o.host);
  capsFamily(o.canvas).then((family) => {
    if (!plate.disposed) plate.setFamily(family);
  });

  return () => {
    plate.dispose();
    plates.delete(plate);
    visibility.unobserve(o.host);
    resize.disconnect();
    if (link) {
      link.removeEventListener("pointerenter", on);
      link.removeEventListener("pointerleave", off);
      link.removeEventListener("focus", focusOn);
      link.removeEventListener("blur", off);
    }
  };
}
