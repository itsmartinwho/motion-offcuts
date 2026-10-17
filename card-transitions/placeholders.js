/* Stand-in cards, painted in code at any size: four full-screen compositions
   with invented names, so the transitions have something to turn, twist and
   slide. Nothing is loaded.

   A card is { name, line, paint(g, w, h) }: `paint` draws the whole picture
   into a 2D context of w x h pixels, and `line` is the words a seam prints
   under the name. To use your own pictures, hand a sketch your own cards as
   `env.cards`; a paint function can just drawImage() a photograph, cut to
   the shape it is given. The cards are painted again whenever the stage is
   resized, so they are never scaled up.

   The type is Aboreto (Google Fonts), which has no lowercase, one weight and
   no letter-spacing of its own, so it is tracked glyph by glyph. */

const { PI, cos, sin, abs, min, max, round, pow } = Math;
const FONT = "Aboreto, Georgia, serif";

/* A small seeded random, so a card paints the same every time. */
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Type with tracking, a glyph at a time (canvas letterSpacing is not in every
   browser yet). Returns the width. */
export function tracked(g, text, x, y, size, track, align = "left", maxWidth = Infinity) {
  g.font = `${size}px ${FONT}`;
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  const glyphs = [...text];
  let widths = glyphs.map((c) => g.measureText(c).width);
  let total = widths.reduce((a, b) => a + b, 0) + size * track * (glyphs.length - 1);
  if (total > maxWidth) {
    size *= maxWidth / total;
    g.font = `${size}px ${FONT}`;
    widths = glyphs.map((c) => g.measureText(c).width);
    total = maxWidth;
  }
  const gap = size * track;
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  glyphs.forEach((c, i) => {
    g.fillText(c, cx, y);
    cx += widths[i] + gap;
  });
  return total;
}

/* Speckle: black and white points of a few percent alpha, to tile over a
   picture so flat gradients read as paper or film. */
export function grainTile(strength = 11) {
  const c = document.createElement("canvas");
  c.width = c.height = 160;
  const g = c.getContext("2d");
  const d = g.createImageData(160, 160);
  const r = rng(7);
  for (let i = 0; i < d.data.length; i += 4) {
    const n = r() * 2 - 1;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = n > 0 ? 255 : 0;
    d.data[i + 3] = n * n * strength;
  }
  g.putImageData(d, 0, 0);
  return c;
}
const grained = (g, w, h, strength) => {
  g.fillStyle = g.createPattern(grainTile(strength), "repeat");
  g.fillRect(0, 0, w, h);
};

/* A soft light: a radial gradient from `color` to nothing. */
function glow(g, x, y, r, color, alpha = 1) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color);
  gr.addColorStop(1, `${color}00`);
  g.globalAlpha = alpha;
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, 2 * r, 2 * r);
  g.globalAlpha = 1;
}

/* What every card carries: a small label in the corner and an arrow, the way
   a page that links somewhere would. */
function chrome(g, m, pad, name, ink) {
  g.save();
  g.shadowColor = "rgba(0,0,0,.35)";
  g.shadowBlur = 0.01 * m;
  g.fillStyle = ink;
  g.globalAlpha = 0.72;
  tracked(g, `${name.toLowerCase()}.example`, pad, pad + 0.012 * m, 0.016 * m, 0.3);
  const w = g.canvas.width;
  const a = 0.016 * m;
  g.strokeStyle = ink;
  g.lineWidth = max(1, 0.002 * m);
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(w - pad - a, pad + a * 0.7);
  g.lineTo(w - pad, pad - a * 0.3);
  g.moveTo(w - pad - a * 0.9, pad - a * 0.3);
  g.lineTo(w - pad, pad - a * 0.3);
  g.lineTo(w - pad, pad + a * 0.8);
  g.stroke();
  g.restore();
}

/* ── NORTH: ultramarine light behind fluted glass ──
   The picture is a few blue lights; each flute of the glass shows a
   squeezed, shifted slice of it, with a dark lip on one side and a lit one on
   the other. */
function north(g, w, h) {
  const m = min(w / 1.6, h);
  const light = document.createElement("canvas");
  light.width = w;
  light.height = h;
  const s = light.getContext("2d");
  const base = s.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, "#050b3d");
  base.addColorStop(0.5, "#1230c9");
  base.addColorStop(1, "#06103f");
  s.fillStyle = base;
  s.fillRect(0, 0, w, h);
  const lights = [
    [0.16, 0.28, 0.55, "#2f58ff", 0.95],
    [0.64, 0.72, 0.62, "#0b1fa8", 0.9],
    [0.86, 0.2, 0.42, "#5aa0ff", 0.6],
    [0.42, 1.0, 0.45, "#02051f", 0.95],
    [0.04, 0.92, 0.4, "#4a2bd0", 0.65],
    [0.7, 0.04, 0.3, "#b4d2ff", 0.4],
  ];
  for (const [x, y, r, c, a] of lights) glow(s, x * w, y * h, r * m * 1.6, c, a);

  const flutes = 30;
  for (let i = 0; i < flutes; i++) {
    const x0 = round((i * w) / flutes);
    const x1 = round(((i + 1) * w) / flutes);
    const fw = x1 - x0;
    const span = fw * 2.4;
    const sx = min(w - span, max(0, x0 + fw / 2 - span / 2 + sin(i * 1.7) * fw * 0.5));
    g.drawImage(light, sx, 0, span, h, x0, 0, fw, h);
    const lens = g.createLinearGradient(x0, 0, x1, 0);
    lens.addColorStop(0, "rgba(0,4,40,.4)");
    lens.addColorStop(0.2, "rgba(0,4,40,0)");
    lens.addColorStop(0.74, "rgba(150,185,255,0)");
    lens.addColorStop(0.93, "rgba(150,185,255,.17)");
    lens.addColorStop(1, "rgba(0,4,40,.3)");
    g.fillStyle = lens;
    g.fillRect(x0, 0, fw, h);
  }
  grained(g, w, h, 9);

  const pad = 0.055 * m;
  g.fillStyle = "#fff";
  const nameW = tracked(g, "NORTH", pad * 1.7, 0.6 * h, 0.21 * m, 0.08, "left", w * 0.6);
  g.globalAlpha = 0.72;
  tracked(g, "ALL BEARINGS", pad * 1.7 + 0.01 * m, 0.6 * h + 0.07 * m, 0.027 * m, 0.42, "left", nameW);
  g.globalAlpha = 1;
  chrome(g, m, pad, "North", "#dfe8ff");
}

/* ── ATLAS: a dawn, rose down to mint, with ridges and a low sun ── */
function atlas(g, w, h) {
  const m = min(w / 1.6, h);
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#a24a7e");
  sky.addColorStop(0.36, "#cf7fa3");
  sky.addColorStop(0.6, "#f0b6c6");
  sky.addColorStop(0.8, "#f8d9d6");
  sky.addColorStop(1, "#bff0df");
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);

  const sunX = 0.7 * w;
  const sunY = 0.74 * h;
  glow(g, sunX, sunY, 0.7 * m, "#fff1dc", 0.85);
  glow(g, sunX, sunY, 0.2 * m, "#ffffff", 0.9);
  g.fillStyle = "#fff9ee";
  g.beginPath();
  g.arc(sunX, sunY, 0.065 * m, 0, 2 * PI);
  g.fill();

  const ridge = (base, amp, seed, fill) => {
    const r = rng(seed);
    const f1 = 1 + r() * 1.5;
    const f2 = 2.5 + r() * 2;
    const p1 = r() * 2 * PI;
    const p2 = r() * 2 * PI;
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w + 1; x += w / 48) {
      const t = x / w;
      g.lineTo(x, base + amp * (0.65 * sin(2 * PI * f1 * t + p1) + 0.35 * sin(2 * PI * f2 * t + p2)));
    }
    g.lineTo(w, h);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  };
  ridge(0.78 * h, 0.03 * h, 11, "rgba(205,190,215,.55)");
  ridge(0.855 * h, 0.035 * h, 23, "rgba(160,215,200,.78)");
  ridge(0.935 * h, 0.03 * h, 37, "rgba(104,178,156,.92)");
  grained(g, w, h, 10);

  const pad = 0.055 * m;
  g.strokeStyle = "#fff";
  g.fillStyle = "#fff";
  g.lineWidth = max(1, 0.003 * m);
  g.beginPath();
  g.arc(w / 2, 0.3 * h, 0.04 * m, 0, 2 * PI);
  g.stroke();
  tracked(g, "A", w / 2, 0.3 * h + 0.014 * m, 0.04 * m, 0, "center");
  tracked(g, "MAP THE LONG WAY ROUND", w / 2, 0.47 * h, 0.05 * m, 0.14, "center", w * 0.82);
  chrome(g, m, pad, "Atlas", "#ffffff");
}

/* ── HALCYON: satin chrome, bands of light bent into a swirl ──
   Each band is the strip between two slowly shifting waves, filled across
   with a grey that runs from black to white and back; a pool of light sits
   behind the wordmark, as it does on a polished plate. */
function halcyon(g, w, h) {
  const m = min(w / 1.6, h);
  g.fillStyle = "#090a0c";
  g.fillRect(0, 0, w, h);
  const bands = 150;
  const steps = 48;
  const edge = (k, x) => {
    const t = x / w;
    const fade = 1 - 0.55 * abs((k / bands - 0.5) * 2);
    return (
      h * (-0.3 + (1.6 * k) / bands) +
      h * 0.24 * fade * sin(2 * PI * (0.9 * t + k * 0.0045) + 0.6) +
      h * 0.07 * sin(2 * PI * 2.3 * t + k * 0.04)
    );
  };
  // light along a band: a slow wave of k and x, sharpened so highlights are narrow
  const grey = (k, t) => {
    const wave = 0.5 + 0.5 * sin(2 * PI * (k * 0.019 + t * 0.55) + 1.3);
    const v = round(14 + 236 * pow(wave, 1.7));
    return `rgb(${v},${v + 2},${v + 6})`;
  };
  for (let k = 0; k < bands; k++) {
    g.beginPath();
    for (let i = 0; i <= steps; i++) {
      const x = (-0.05 + (1.1 * i) / steps) * w;
      i ? g.lineTo(x, edge(k, x)) : g.moveTo(x, edge(k, x));
    }
    for (let i = steps; i >= 0; i--) {
      const x = (-0.05 + (1.1 * i) / steps) * w;
      g.lineTo(x, edge(k + 1.2, x));
    }
    g.closePath();
    const fill = g.createLinearGradient(0, 0, w, 0);
    for (let j = 0; j <= 4; j++) fill.addColorStop(j / 4, grey(k, j / 4));
    g.fillStyle = fill;
    g.fill();
  }
  glow(g, w / 2, 0.56 * h, 0.5 * m, "#ffffff", 0.5);
  grained(g, w, h, 9);

  // the wordmark: black, with a thread of light on its upper edge
  const size = 0.17 * m;
  const cy = 0.55 * h;
  g.fillStyle = "rgba(255,255,255,.7)";
  tracked(g, "HALCYON", w / 2, cy - max(1, 0.003 * m), size, 0.2, "center", w * 0.78);
  g.fillStyle = "#060607";
  tracked(g, "HALCYON", w / 2, cy, size, 0.2, "center", w * 0.78);
  g.globalAlpha = 0.85;
  tracked(g, "SATIN WORKS", w / 2, cy + 0.075 * m, 0.024 * m, 0.5, "center");
  g.globalAlpha = 1;
  chrome(g, m, 0.055 * m, "Halcyon", "#f2f4f8");
}

/* ── VESPER: a dark card, a dial of rings and one point of light ── */
function vesper(g, w, h) {
  const m = min(w / 1.6, h);
  g.fillStyle = "#06060a";
  g.fillRect(0, 0, w, h);
  const cx = w / 2;
  const cy = 0.5 * h;
  const R = 0.37 * m;
  glow(g, cx, cy, 0.75 * m, "#ff8a30", 0.17);
  const bright = -0.95; // where the one bright point sits, radians

  // each ring is 360 short arcs, brightest near the point of light
  const ring = (r, width, lift, spread) => {
    g.lineWidth = width;
    g.lineCap = "butt";
    g.strokeStyle = "#ffb878";
    for (let i = 0; i < 360; i++) {
      const a = (i / 360) * 2 * PI;
      g.globalAlpha = lift + (1 - lift) * pow(max(0, cos(a - bright)), spread);
      g.beginPath();
      g.arc(cx, cy, r, a, a + (2 * PI) / 358);
      g.stroke();
    }
    g.globalAlpha = 1;
  };
  ring(R, 0.007 * m, 0.16, 3);
  ring(R * 0.78, 0.003 * m, 0.08, 2);
  ring(R * 0.58, 0.003 * m, 0.05, 2);
  ring(R * 0.4, 0.003 * m, 0.03, 2);

  // a dial's ticks outside the ring
  g.strokeStyle = "#ffe2c4";
  g.lineWidth = max(1, 0.0018 * m);
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * 2 * PI;
    const long = i % 10 === 0;
    const r0 = R * 1.06;
    const r1 = r0 + (long ? 0.03 : 0.014) * m;
    g.globalAlpha = 0.12 + 0.5 * pow(max(0, cos(a - bright)), 4);
    g.beginPath();
    g.moveTo(cx + r0 * cos(a), cy + r0 * sin(a));
    g.lineTo(cx + r1 * cos(a), cy + r1 * sin(a));
    g.stroke();
  }
  g.globalAlpha = 1;

  const px = cx + R * cos(bright);
  const py = cy + R * sin(bright);
  glow(g, px, py, 0.1 * m, "#ffb060", 0.9);
  glow(g, px, py, 0.03 * m, "#ffffff", 1);
  g.fillStyle = "#fff";
  g.beginPath();
  g.arc(px, py, 0.0065 * m, 0, 2 * PI);
  g.fill();

  grained(g, w, h, 8);
  g.fillStyle = "#f4efe8";
  tracked(g, "VESPER", cx, cy + 0.02 * m, 0.08 * m, 0.34, "center", R * 1.2);
  g.globalAlpha = 0.55;
  tracked(g, "EVENING SIGNAL", cx, cy + 0.085 * m, 0.0185 * m, 0.55, "center");
  g.globalAlpha = 1;
  chrome(g, m, 0.055 * m, "Vesper", "#f4efe8");
}

export const CARDS = [
  { name: "NORTH", line: "ALL BEARINGS", paint: north },
  { name: "ATLAS", line: "MAP THE LONG WAY ROUND", paint: atlas },
  { name: "HALCYON", line: "SATIN WORKS", paint: halcyon },
  { name: "VESPER", line: "EVENING SIGNAL", paint: vesper },
];

/* One canvas per card, painted at the size the stage is drawn at;
   build() again on resize. */
export function makeFaces(cards = CARDS) {
  const canvases = cards.map(() => document.createElement("canvas"));
  let key = "";
  return {
    canvases,
    names: cards.map((c) => c.name),
    seams: cards.map((c) => [c.name, c.line]),
    build(w, h) {
      w = max(2, round(w));
      h = max(2, round(h));
      if (key === `${w}x${h}`) return;
      key = `${w}x${h}`;
      canvases.forEach((c, i) => {
        c.width = w;
        c.height = h;
        cards[i].paint(c.getContext("2d"), w, h);
      });
    },
  };
}
