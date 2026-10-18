/* Bulging grid: a page of hairline squares that bulge under the pointer and,
   on their own, under three slow swells that drift across the page and
   breathe. It was the background of jjmartin.co's blog, press and contact
   pages until October 2026.

   How it works: Canvas 2D. A lattice of points, each pushed away from the
   pointer and from the swells by a force that falls off linearly to nothing
   at the edge of its radius, then eased toward where it is pushed, so the
   cloth settles rather than snaps. The lines are drawn row by row and column
   by column through the moved points. Nothing is precomputed but the
   lattice.

   The swells' paths are sines of the loop, each a whole number of turns over
   it, so the loop has no seam. On the site they ran on a clock; the speeds
   here are close to those.

   GRID below holds every choice: the spacing, the pointer's bulge, the
   swells', the ink and the ground. */

const TAU = Math.PI * 2;

const GRID = {
  spacing: 50, // px between lines
  ink: "rgba(200, 200, 200, 0.4)",
  ground: "#ffffff",
  line: 1, // px
  // The pointer pushes the cloth out within `radius`, by up to `strength` px.
  pointer: { radius: 180, strength: 25 },
  // Each swell: its centre's path as a share of the stage (x0 + ax * sin, y0 +
  // ay * cos), the whole turns it makes on each axis in one loop, where its
  // turn starts, and how many breaths it takes. They push by up to
  // `strength`, within `radius`.
  swell: { radius: 250, strength: 18 },
  swells: [
    { x0: 0.3, ax: 0.2, kx: 1, px: 0, y0: 0.4, ay: 0.25, ky: 1, py: 0, breaths: 5, pb: 0 },
    { x0: 0.7, ax: 0.2, kx: 1, px: 2, y0: 0.6, ay: 0.2, ky: 1, py: 1, breaths: 6, pb: 1 },
    { x0: 0.5, ax: 0.3, kx: 2, px: 4, y0: 0.3, ay: 0.2, ky: 1, py: 3, breaths: 6, pb: 2 },
  ],
  // How quickly a point follows its push: the time constant in seconds.
  // (0.12 of the way a frame at 60fps.)
  ease: 0.13,
};

/* The cloth, without a page: give it a 2D context and the size in CSS px,
   then call `step(u, dt)` each frame with the loop's phase. `pointer` is
   where the pointer is, or null. */
export function createGrid(opts = {}) {
  const G = { ...GRID, ...opts };
  let w = 1;
  let h = 1;
  let cols = 0;
  let rows = 0;
  let pts = new Float32Array(0); // baseX, baseY, x, y per point
  const pointer = { x: 0, y: 0, on: false };

  function resize(width, height) {
    w = width;
    h = height;
    cols = Math.ceil(w / G.spacing) + 2;
    rows = Math.ceil(h / G.spacing) + 2;
    pts = new Float32Array(cols * rows * 4);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = (r * cols + c) * 4;
        pts[i] = pts[i + 2] = c * G.spacing - G.spacing;
        pts[i + 1] = pts[i + 3] = r * G.spacing - G.spacing;
      }
    }
  }

  function push(bx, by, cx, cy, radius, strength, out) {
    const dx = bx - cx;
    const dy = by - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius || d2 === 0) return;
    const d = Math.sqrt(d2);
    const f = (1 - d / radius) * strength;
    out.x += (dx / d) * f;
    out.y += (dy / d) * f;
  }

  const swells = G.swells.map(() => ({ x: 0, y: 0, k: 0 }));
  const acc = { x: 0, y: 0 };

  function step(u, dt) {
    for (let j = 0; j < G.swells.length; j++) {
      const s = G.swells[j];
      swells[j].x = w * (s.x0 + Math.sin(TAU * s.kx * u + s.px) * s.ax);
      swells[j].y = h * (s.y0 + Math.cos(TAU * s.ky * u + s.py) * s.ay);
      // A breath: 0 to 1 and back.
      swells[j].k = Math.sin(TAU * s.breaths * u + s.pb) * 0.5 + 0.5;
    }
    // dt of 0 (a scrub, a resize) jumps straight to the pushed shape.
    const follow = dt > 0 ? 1 - Math.exp(-dt / G.ease) : 1;
    for (let i = 0; i < pts.length; i += 4) {
      const bx = pts[i];
      const by = pts[i + 1];
      acc.x = 0;
      acc.y = 0;
      if (pointer.on) push(bx, by, pointer.x, pointer.y, G.pointer.radius, G.pointer.strength, acc);
      for (const s of swells) push(bx, by, s.x, s.y, G.swell.radius, G.swell.strength * s.k, acc);
      pts[i + 2] += (bx + acc.x - pts[i + 2]) * follow;
      pts[i + 3] += (by + acc.y - pts[i + 3]) * follow;
    }
  }

  function draw(ctx) {
    ctx.fillStyle = G.ground;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = G.ink;
    ctx.lineWidth = G.line;
    ctx.beginPath();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = (r * cols + c) * 4;
        if (c === 0) ctx.moveTo(pts[i + 2], pts[i + 3]);
        else ctx.lineTo(pts[i + 2], pts[i + 3]);
      }
    }
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const i = (r * cols + c) * 4;
        if (r === 0) ctx.moveTo(pts[i + 2], pts[i + 3]);
        else ctx.lineTo(pts[i + 2], pts[i + 3]);
      }
    }
    ctx.stroke();
  }

  return { resize, step, draw, pointer };
}

/* For the runtime (../shared/runtime.js): a 40 second loop on a stage, with
   the pointer read over the stage. */
export const sketches = {
  grid: async (env) => {
    const view = env.canvas("2d");
    const cloth = createGrid();
    let sized = "";
    const fit = () => {
      const key = `${view.w}x${view.h}`;
      if (key === sized) return;
      sized = key;
      cloth.resize(view.w, view.h);
    };
    const at = (e) => {
      const r = env.stage.getBoundingClientRect();
      cloth.pointer.x = e.clientX - r.left;
      cloth.pointer.y = e.clientY - r.top;
      cloth.pointer.on = true;
    };
    env.stage.addEventListener("pointermove", at);
    env.stage.addEventListener("pointerdown", at);
    env.stage.addEventListener("pointerleave", () => (cloth.pointer.on = false));
    return {
      duration: 40,
      still: 0.18,
      render(u, time, dt) {
        fit();
        const { ctx, dpr } = view;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cloth.step(u, dt);
        cloth.draw(ctx);
      },
    };
  },
};

/* The way the site used it: one fixed canvas behind the whole page, the
   pointer read anywhere on it. Returns a function that takes it down.

     import { mountBackground } from "./grid.js";
     mountBackground();                                                    */
export function mountBackground({ duration = 40, ...opts } = {}) {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", zIndex: "-1", pointerEvents: "none" });
  document.body.prepend(canvas);
  const ctx = canvas.getContext("2d");
  const cloth = createGrid(opts);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let u = 0.18;
  let last = 0;
  let raf = 0;
  const size = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cloth.resize(innerWidth, innerHeight);
  };
  const frame = (now) => {
    raf = 0;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    if (!reduced) u = (u + dt / duration) % 1;
    cloth.step(u, dt);
    cloth.draw(ctx);
    if (!document.hidden) raf = requestAnimationFrame(frame);
  };
  const move = (e) => Object.assign(cloth.pointer, { x: e.clientX, y: e.clientY, on: true });
  const leave = () => (cloth.pointer.on = false);
  const wake = () => {
    last = 0;
    if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
  };
  size();
  addEventListener("resize", size);
  addEventListener("pointermove", move);
  document.addEventListener("pointerleave", leave);
  document.addEventListener("visibilitychange", wake);
  wake();
  return () => {
    cancelAnimationFrame(raf);
    removeEventListener("resize", size);
    removeEventListener("pointermove", move);
    document.removeEventListener("pointerleave", leave);
    document.removeEventListener("visibilitychange", wake);
    canvas.remove();
  };
}
