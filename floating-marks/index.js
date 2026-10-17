/* Index: a quiet hero. Nothing floats; the picture, the figure and a name,
   and at the foot of the frame an index of what follows, one entry lit at a
   time with a hairline drawing under it.

   How it works: Canvas 2D. The backdrop pushes in a couple of percent and
   comes back, so slowly it is only alive and the loop has no seam. The index
   is set once per size to fit the open space left of the figure, then each
   entry cross-fades in its turn and its hairline is drawn left to right.

   After Unveil's filter bar, which does the same job for a page of work.

   ITEMS below is the index: a number and a name each. The loop gives each
   entry the same share of its length. */

import { hero, drawName } from "./placeholders.js";

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (x) => {
  x = clamp(x);
  return x * x * (3 - 2 * x);
};
const mod1 = (x) => x - Math.floor(x);

const ITEMS = [
  ["00", "ADA VESPER"],
  ["01", "NORTH"],
  ["02", "ATLAS.BUILD"],
  ["03", "ATLAS.LIVE"],
];

export const sketches = {
  index: async (env) => {
    const view = env.canvas("2d");
    let key = "";
    let scene = null;
    let M = null;

    /* Measure the entries at a size that fits the open silk: 0.017 of the
       height with a floor so a small stage still reads, shrunk if the row
       would run into the figure. */
    function measure() {
      const { ctx, w, h } = view;
      let fs = Math.max(0.017 * h, 8);
      const widths = () => {
        ctx.font = `${fs}px Aboreto, serif`;
        ctx.letterSpacing = `${0.18 * fs}px`;
        return ITEMS.map(([n, t]) => [ctx.measureText(n).width, ctx.measureText(t).width]);
      };
      let ws = widths();
      const gapNum = () => 0.9 * fs;
      const sum = () => ws.reduce((a, [nw, tw]) => a + nw + gapNum() + tw, 0);
      const room = 0.56 * w;
      if (sum() + 3 * 1.5 * fs > room) {
        fs *= room / (sum() + 3 * 1.5 * fs);
        ws = widths();
      }
      const gapItem = clamp((room - sum()) / 3, 1.5 * fs, 3.4 * fs);
      let x = 0;
      M = { fs, items: [] };
      ITEMS.forEach(([n, t], i) => {
        const [nw, tw] = ws[i];
        M.items.push({ n, t, x, nw, w: nw + gapNum() + tw, gapNum: gapNum() });
        x += nw + gapNum() + tw + gapItem;
      });
      ctx.letterSpacing = "0px";
    }

    function render(u) {
      const { ctx, w, h, dpr } = view;
      if (key !== `${w}x${h}@${dpr}`) {
        key = `${w}x${h}@${dpr}`;
        scene = hero(w, h, dpr);
        measure();
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const scale = 1 + 0.025 * (0.5 - 0.5 * Math.cos(TAU * u));
      ctx.drawImage(scene.backdrop, (w - w * scale) / 2, (h - h * scale) / 2, w * scale, h * scale);
      ctx.drawImage(scene.figure, 0, 0, w, h);
      drawName(ctx, w, h);

      const x = u * ITEMS.length;
      const cross = 0.4 / 3; // a 0.4 s cross-fade in a 3 s turn
      ctx.font = `${M.fs}px Aboreto, serif`;
      ctx.letterSpacing = `${0.18 * M.fs}px`;
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#fff";
      const x0 = 0.0625 * w;
      const base = 0.93 * h;
      M.items.forEach((it, i) => {
        const t = mod1((x - i) / ITEMS.length) * ITEMS.length;
        const on = smooth(t / cross) * (1 - smooth((t - 1) / cross));
        const a = lerp(0.38, 1, on);
        ctx.globalAlpha = a * 0.55;
        ctx.fillText(it.n, x0 + it.x, base);
        ctx.globalAlpha = a;
        ctx.fillText(it.t, x0 + it.x + it.nw + it.gapNum, base);
        // the hairline, drawn left to right through its turn
        if (on > 0.001) {
          ctx.globalAlpha = on * 0.9;
          ctx.fillRect(x0 + it.x, base + 0.5 * M.fs, Math.max(0, (it.w - 0.18 * M.fs) * smooth(t / 0.9)), 1);
        }
      });
      ctx.globalAlpha = 1;
      ctx.letterSpacing = "0px";
    }

    return { mode: "loop", duration: 12, still: 0.3, render };
  },
};
