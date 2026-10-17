/* Sheets: the next card slides up over the last.

   The one on screen steps back as it is covered: it shrinks a little, rises a
   little, rounds its corners and dims. The one arriving carries a lip of
   shadow on its top edge while it moves and lands square, full screen. Two
   cards are drawn at a time, with plain transforms.

   Stacked sheets are a common pattern; nothing here is taken from one site.

   Options (createSheets): move and hold, in screens. */

import { makeFaces } from "./placeholders.js";
import { plan, placeOf, fadeCards, ease, smooth, el, FILL, dprOf } from "./scroll.js";

const RAD = 14; // corner radius of a card in motion, px
const px = (n) => `${n.toFixed(2)}px`;

export function createSheets(env, { move = 1.0, hold = 0.45 } = {}) {
  const faces = makeFaces(env.cards);
  const count = faces.canvases.length;
  const pl = plan(count, move, hold, !env.reduced);
  const root = el("div", FILL, env.stage);
  const cards = faces.canvases.map((c) => {
    const d = el("div", FILL + "overflow:hidden;transform-origin:50% 50%;visibility:hidden;will-change:transform;", root);
    c.style.cssText = "display:block;width:100%;height:100%;";
    d.append(c);
    const dim = el("div", FILL + "background:#000;opacity:0;", d);
    return { d, dim };
  });
  let W = env.stage.clientWidth || 600;
  let H = env.stage.clientHeight || 375;
  const at = { k: 0, f: 0, p: 0 };
  const size = () => faces.build(W * dprOf(), H * dprOf());
  size();

  return {
    mode: "scroll",
    screens: pl.screens,
    rests: pl.rests,
    start: pl.start,
    labels: faces.names,
    resize(w, h) {
      W = w;
      H = h;
      size();
    },
    render(s) {
      placeOf(pl, s, at);
      if (env.reduced) {
        fadeCards(cards.map((c) => c.d), at.p);
        for (const c of cards) c.dim.style.opacity = "0";
        return;
      }
      const { k, f } = at;
      const e = ease(f);
      for (let i = 0; i < count; i++) {
        const c = cards[i];
        const st = c.d.style;
        if (i < k || i > k + 1 || (i === k + 1 && f === 0)) {
          st.visibility = "hidden";
          continue;
        }
        st.visibility = "visible";
        if (i === k) {
          // the covered card steps back and dims
          st.zIndex = "1";
          st.transform = e > 0 ? `translate3d(0,${(-0.025 * H * e).toFixed(2)}px,0) scale(${(1 - 0.08 * e).toFixed(4)})` : "none";
          st.borderRadius = e > 0 ? px(RAD * smooth(0, 0.5, e)) : "";
          st.boxShadow = "none";
          c.dim.style.opacity = (0.45 * e).toFixed(3);
        } else {
          // the arriving card: a lip of shadow on its top edge while it moves
          const moving = smooth(0, 0.03, e) * (1 - smooth(0.94, 1, e));
          st.zIndex = "2";
          st.transform = `translate3d(0,${((1 - e) * H).toFixed(2)}px,0)`;
          st.borderRadius = px(RAD * moving);
          st.boxShadow = moving > 0.01 ? `0 -16px 50px -8px rgb(0 0 0 / ${(0.55 * moving).toFixed(3)})` : "none";
          c.dim.style.opacity = "0";
        }
      }
    },
  };
}

export const sketches = {
  sheets: (env) => createSheets(env),
};
