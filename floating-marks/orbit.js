/* Orbit: three names ride one thin ring tilted round the figure. The ring
   passes behind the figure on its far side and in front of the chest on its
   near side, and each name grows and brightens as it comes round the front.

   How it works: Canvas 2D. The ring is a tilted ellipse seen with a little
   perspective, built once per size as four closed ribbons (a wide glow, a
   shaded edge, the body, a lit edge). Each ribbon is filled with a conic
   gradient whose stops carry the ring's own opacity by depth, so the near
   side is bright and the far side dim, and the gradient is gapped where a
   name sits so the name reads on a clean ring. The frame is drawn in the
   order the ring turns: the far half, the names behind, the figure, the near
   half, the names in front.

   After the Orbit tile of Bureau Cool.

   ORBIT below places the ring (centre as shares of the width and height,
   radii, roll, perspective); change them to fit your figure. Names come from
   MARKS in placeholders.js. */

import { hero, drawName, MARKS } from "./placeholders.js";

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (x) => {
  x = clamp(x);
  return x * x * (3 - 2 * x);
};

const ORBIT = {
  cx: 0.7, // × W
  cy: 0.6, // × H
  rx: 0.27, // × W
  ry: 0.068, // × W
  roll: -3 * DEG,
  cam: 6, // the camera's distance in ring radii: the front is a little bigger than the back
  depth: 0.92,
};
const RING_N = 220; // samples round the ring

/* The ring in the stage's pixels. */
function ringGeometry(w, h) {
  const o = ORBIT;
  const cx = o.cx * w;
  const cy = o.cy * h;
  const U = clamp(w / 1180, 0.55, 1.5); // line weights follow the stage's width
  const G = {
    w, h, U, cx, cy,
    rx: o.rx * w,
    ry: o.ry * w,
    cr: Math.cos(o.roll),
    sr: Math.sin(o.roll),
    n: RING_N,
    x: new Float32Array(RING_N),
    y: new Float32Array(RING_N),
    sn: new Float32Array(RING_N), // sin of each sample's angle: < 0 is the far half
    sc: new Float32Array(RING_N), // its perspective scale
    beta: new Float32Array(RING_N + 1),
  };
  for (let j = 0; j < RING_N; j++) {
    const p = ringPoint(G, (j / RING_N) * TAU);
    G.x[j] = p.x;
    G.y[j] = p.y;
    G.sc[j] = p.s;
    G.sn[j] = Math.sin((j / RING_N) * TAU);
  }
  // the screen angle of each sample, unwrapped from the first (a conic gradient's own measure)
  let prev = Math.atan2(G.y[0] - cy, G.x[0] - cx);
  G.beta0 = prev;
  G.beta[0] = 0;
  for (let j = 1; j <= RING_N; j++) {
    let b = Math.atan2(G.y[j % RING_N] - cy, G.x[j % RING_N] - cx);
    while (b < prev) b += TAU;
    G.beta[j] = b - G.beta0;
    prev = b;
  }
  G.layers = {
    glow: ribbon(G, 11 * U, 0, 0),
    shade: ribbon(G, Math.max(1.6, 2.6 * U), 0.9 * U, 1.7 * U),
    core: ribbon(G, Math.max(1.25, 2.1 * U), 0, 0),
    lit: ribbon(G, Math.max(0.7, 0.9 * U), -0.55 * U, -0.95 * U),
  };
  return G;
}

function ringPoint(G, psi) {
  const sn = Math.sin(psi);
  const s = ORBIT.cam / (ORBIT.cam - ORBIT.depth * sn);
  const x = G.rx * Math.cos(psi) * s;
  const y = G.ry * sn * s;
  return { x: G.cx + x * G.cr - y * G.sr, y: G.cy + x * G.sr + y * G.cr, s };
}

/* A closed ribbon along the ring, a Path2D to fill (evenodd): wider where it is nearer. */
function ribbon(G, width, ox, oy) {
  const n = G.n;
  const outer = [];
  const inner = [];
  for (let j = 0; j < n; j++) {
    const a = (j + n - 1) % n;
    const b = (j + 1) % n;
    let tx = G.x[b] - G.x[a];
    let ty = G.y[b] - G.y[a];
    const m = Math.hypot(tx, ty) || 1;
    tx /= m;
    ty /= m;
    const half = (width * G.sc[j]) / 2;
    outer.push([G.x[j] + ox - ty * half, G.y[j] + oy + tx * half]);
    inner.push([G.x[j] + ox + ty * half, G.y[j] + oy - tx * half]);
  }
  const path = new Path2D();
  outer.forEach(([x, y], j) => (j ? path.lineTo(x, y) : path.moveTo(x, y)));
  path.closePath();
  inner.forEach(([x, y], j) => (j ? path.lineTo(x, y) : path.moveTo(x, y)));
  path.closePath();
  return path;
}

const ringAlpha = new Float32Array(RING_N);

/* One half of the ring: pass 0 is what goes behind the figure, pass 1 what
   crosses in front. */
function paintRing(ctx, G, labels, pass) {
  const n = G.n;
  // the ring's own opacity by depth, gapped where a label sits on it
  for (let j = 0; j < n; j++) {
    const sn = G.sn[j];
    let a = lerp(0.2, 0.6, smooth((sn + 1) / 2));
    const wb = smooth((0.14 - sn) / 0.28);
    a *= pass === 0 ? wb : 1 - wb;
    for (const t of labels) {
      const x0 = t.tx - 7 * G.U;
      const x1 = t.tx + t.tw + 7 * G.U;
      const y0 = t.p.y - t.fs / 2 - 3 * G.U;
      const y1 = t.p.y + t.fs / 2 + 3 * G.U;
      const dx = Math.max(x0 - G.x[j], 0, G.x[j] - x1);
      const dy = Math.max(y0 - G.y[j], 0, G.y[j] - y1);
      a *= 1 - 0.94 * smooth(1 - Math.hypot(dx, dy) / (11 * G.U));
    }
    ringAlpha[j] = a;
  }
  const grad = (r, g, b, k) => {
    const cg = ctx.createConicGradient(G.beta0, G.cx, G.cy);
    for (let j = 0; j <= n; j++) cg.addColorStop(clamp(G.beta[j] / TAU), `rgba(${r},${g},${b},${(ringAlpha[j % n] * k).toFixed(3)})`);
    return cg;
  };
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = grad(120, 150, 255, 0.2);
  ctx.fill(G.layers.glow, "evenodd");
  ctx.restore();
  ctx.fillStyle = grad(2, 8, 30, 0.55);
  ctx.fill(G.layers.shade, "evenodd");
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = grad(214, 226, 255, 1);
  ctx.fill(G.layers.core, "evenodd");
  ctx.fillStyle = grad(255, 255, 255, 0.7);
  ctx.fill(G.layers.lit, "evenodd");
  ctx.restore();
}

/* A name, centred on its place on the ring. In front of the figure it gets a
   close, soft shadow so white holds on a light shirt (no plate, no wash). */
function drawLabel(ctx, t, front) {
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.font = `${t.fs}px Aboreto, serif`;
  ctx.letterSpacing = `${0.18 * t.fs}px`;
  ctx.textBaseline = "middle";
  ctx.globalAlpha = t.alpha * t.edge;
  if (front) {
    ctx.shadowColor = "rgba(3,10,40,0.5)";
    ctx.shadowBlur = 9 * t.sc * t.U;
    ctx.fillText(t.name, t.tx, t.p.y + 0.06 * t.fs);
    ctx.shadowColor = "rgba(3,10,40,0.7)";
    ctx.shadowBlur = 2.5 * t.sc * t.U;
  }
  ctx.fillText(t.name, t.tx, t.p.y + 0.06 * t.fs);
  ctx.restore();
}

export const sketches = {
  orbit: async (env) => {
    const view = env.canvas("2d");
    let key = "";
    let scene = null;
    let G = null;

    function render(u) {
      const { ctx, w, h, dpr } = view;
      if (key !== `${w}x${h}@${dpr}`) {
        key = `${w}x${h}@${dpr}`;
        scene = hero(w, h, dpr);
        G = ringGeometry(w, h);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(scene.backdrop, 0, 0, w, h);

      // where the names are on the ring, and how big they are there
      const labels = MARKS.map((m, i) => {
        const psi = TAU * (u + i / 3) + 0.62;
        const p = ringPoint(G, psi);
        const d = (Math.sin(psi) + 1) / 2; // 1 at the front
        const sc = lerp(0.75, 1, d);
        const fs = Math.max(0.02 * h, 8.2) * sc;
        ctx.font = `${fs}px Aboreto, serif`;
        ctx.letterSpacing = `${0.18 * fs}px`;
        const tw = ctx.measureText(m.name).width;
        const tx = p.x - tw / 2;
        // fade out a name that would run off the right edge
        const edge = 1 - smooth((tx + tw - 0.955 * w) / (0.05 * w));
        return { name: m.name, U: G.U, edge, p, d, sc, alpha: 0.3 + 0.7 * Math.pow(d, 1.5), fs, tw, tx, back: Math.sin(psi) < 0 };
      }).sort((a, b) => a.d - b.d);

      paintRing(ctx, G, labels, 0);
      for (const t of labels) if (t.back) drawLabel(ctx, t, false);
      ctx.drawImage(scene.figure, 0, 0, w, h);
      paintRing(ctx, G, labels, 1);
      for (const t of labels) if (!t.back) drawLabel(ctx, t, true);
      drawName(ctx, w, h);
      ctx.letterSpacing = "0px";
    }

    return { mode: "loop", duration: 14, still: 0.12, render };
  },
};
