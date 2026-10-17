/* The crate: the cards as records in a diagonal crate.

   Each move has three beats, overlapping a little:
     settle  the card on screen shrinks and tilts into the crate, a stack of
             records leaning up and to the right, each one further back and
             a little darker
     slide   the stack shifts one place, the front record going on out
     lift    the next record comes up out of the stack, growing to fill the
             screen, lifted toward you as it goes

   Only the card on screen and the one coming are drawn; the rest wait
   behind. Everything is a CSS 3D transform written each frame.

   Options (createCrate): move and hold, in screens.
   After Unveil's stacked records. */

import { makeFaces } from "./placeholders.js";
import { plan, placeOf, fadeCards, clamp, lerp, range, ease, smooth, el, FILL, dprOf } from "./scroll.js";

const { PI, sin, max, round } = Math;

const SC = 0.44; // a record's size against the view
const RX = 6; // the crate's lean, degrees
const RY = -38;
const FULL = { x: 0, y: 0, z: 0, rx: 0, ry: 0, sc: 1, r: 0 };

/* Slot `rel` of the stack (0 = the front one, lower left; each further slot
   up and to the right, and back), for a view of W x H. */
function slot(rel, W, H, o) {
  o.x = -0.21 * W + 0.12 * W * rel;
  o.y = 0.17 * H - 0.11 * H * rel;
  o.z = -0.12 * W * rel;
  o.rx = RX;
  o.ry = RY;
  o.sc = SC;
  o.r = 10;
  return o;
}

function mix(a, b, t, o) {
  for (const k of Object.keys(FULL)) o[k] = lerp(a[k], b[k], t);
  return o;
}

export function createCrate(env, { move = 1.6, hold = 0.45 } = {}) {
  const faces = makeFaces(env.cards);
  const count = faces.canvases.length;
  const pl = plan(count, move, hold, !env.reduced);
  const root = el("div", FILL + "perspective-origin:50% 50%;", env.stage);
  const cards = faces.canvases.map((c) => {
    const d = el("div", FILL + "transform-origin:50% 50%;backface-visibility:hidden;visibility:hidden;overflow:hidden;box-shadow:0 12px 26px -12px rgb(10 14 40 / .5);", root);
    c.style.cssText = "display:block;width:100%;height:100%;";
    d.append(c);
    // a record deeper in the stack is darker; a record in the stack has a pale edge
    const shade = el("div", FILL + "background:#05071a;opacity:0;", d);
    const edge = el("div", FILL + "box-shadow:inset 0 0 0 2px rgb(255 255 255 / .42);", d);
    return { d, shade, edge };
  });
  let W = env.stage.clientWidth || 600;
  let H = env.stage.clientHeight || 375;
  const at = { k: 0, f: 0, p: 0 };
  const size = () => {
    faces.build(W * dprOf(), H * dprOf());
    root.style.perspective = `${round(W * 1.15)}px`;
  };
  size();
  const A = {};
  const P = {};

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
        for (const c of cards) c.edge.style.opacity = c.shade.style.opacity = "0";
        return;
      }
      const { k, f } = at;
      const p1 = ease(range(f, 0, 0.42)); // settle
      const p2 = ease(range(f, 0.26, 0.74)); // slide
      const p3 = ease(range(f, 0.58, 1)); // lift
      for (let i = 0; i < count; i++) {
        const c = cards[i];
        const st = c.d.style;
        if (i < k || (f === 0 && i !== k)) {
          st.visibility = "hidden";
          continue;
        }
        let opacity = 1;
        let full = 0; // how much of the card is "the screen" (no stack shading or edge)
        let z = 0;
        let lift = 0;
        const rel = i - k - p2;
        if (i === k) {
          if (f === 0) {
            Object.assign(P, FULL);
            full = 1;
            z = 200;
          } else {
            mix(FULL, slot(rel, W, H, A), p1, P);
            full = 1 - p1;
            opacity = 1 - smooth(0.12, 0.9, p2);
            z = 150;
          }
        } else if (i === k + 1) {
          mix(slot(rel, W, H, A), FULL, p3, P);
          full = p3;
          lift = sin(PI * p3);
          z = p3 > 0 ? 220 : round(100 - rel * 10);
        } else {
          slot(rel, W, H, P);
          z = round(100 - rel * 10);
        }
        if (opacity <= 0.002) {
          st.visibility = "hidden";
          continue;
        }
        const tz = P.z + lift * 0.08 * W;
        st.visibility = "visible";
        st.transform = `translate3d(${P.x.toFixed(1)}px,${P.y.toFixed(1)}px,${tz.toFixed(1)}px) rotateY(${P.ry.toFixed(2)}deg) rotateX(${P.rx.toFixed(2)}deg) scale(${P.sc.toFixed(4)})`;
        st.borderRadius = P.r > 0.05 ? `${(P.r / P.sc).toFixed(1)}px` : "";
        st.opacity = opacity >= 1 ? "" : opacity.toFixed(3);
        st.zIndex = String(z);
        const depth = clamp(0.14 * max(0, rel), 0, 0.55) * (1 - full);
        c.shade.style.opacity = depth > 0.003 ? depth.toFixed(3) : "0";
        c.edge.style.opacity = (1 - full).toFixed(3);
      }
    },
  };
}

export const sketches = {
  crate: (env) => createCrate(env),
};
