/* The helix: the cards strung on a spiral, as on jjmartin.co's home page.

   The card the camera is on faces it, square to the screen. The next waits
   further round and further down, the last has gone on round and up. Between
   two cards the camera draws back, so three cards of the spiral show, their
   corners rounding and their shadows falling on the page; on a card it is
   home again and the card is the screen.

   Two shapes:
     helix  the site's own, the corkscrew: the helix's axis leans, so the
            ribbon runs from the upper right to the lower left and the cards
            twist round it as they go
     calm   the axis upright, a third of the pull-back, and holds that last
            longer than the turns

   poseOf() is the site's, as it shipped: pure maths from the camera's place
   to each card's CSS matrix, in the screen's own px. Each frame writes the
   cards' transforms directly and reads no layout.

   Options (createHelix): shape (see SHAPES), move and hold, in screens.
   After Simon Rogers' ribbon (loadmo.re), with Unveil's stacked records for
   the stations. */

import { makeFaces } from "./placeholders.js";
import { plan, placeOf, fadeCards, smooth, el, FILL, dprOf } from "./scroll.js";

const { PI, cos, sin, abs, min, max, round, floor } = Math;
const deg = (d) => (d * PI) / 180;

/* turn    a card's turn round the axis, per card
   radius  the helix's radius, in screen widths (at least 0.6 of the longer side)
   pitch   the drop from one card to the next along the axis, in screen heights
   dolly   how far the camera draws back mid-turn, in the screen's longer side
   lean    the axis's lean: round the screen's normal, then over (tilt) toward the camera */
export const SHAPES = {
  corkscrew: { turn: deg(62), radius: 0.5, pitch: 0.82, dolly: 1.0, lean: deg(30), tilt: deg(-16) },
  calm: { turn: deg(50), radius: 0.45, pitch: 0.9, dolly: 0.36, lean: 0, tilt: 0 },
};

/* The perspective the spiral is seen through, px. */
const perspectiveFor = (w, h) => round(max(w, h) * 1.25);

/* 3 x 3 rotations in CSS's frame (x right, y down, z toward the reader), row-major. */
const rotX = (a) => [1, 0, 0, 0, cos(a), -sin(a), 0, sin(a), cos(a)];
const rotY = (a) => [cos(a), 0, sin(a), 0, 1, 0, -sin(a), 0, cos(a)];
const rotZ = (a) => [cos(a), -sin(a), 0, sin(a), cos(a), 0, 0, 0, 1];
function mul(a, b) {
  const o = new Array(9).fill(0);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) for (let k = 0; k < 3; k++) o[r * 3 + c] += a[r * 3 + k] * b[k * 3 + c];
  return o;
}
const transpose = (m) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const apply = (m, v) => [0, 1, 2].map((r) => m[r * 3] * v[0] + m[r * 3 + 1] * v[1] + m[r * 3 + 2] * v[2]);

export function poseOf(index, p, width, height, shape) {
  const s = index - p;
  const a = abs(s);
  const long = max(width, height);
  const r = shape.radius * max(width, long * 0.6);
  const phi = s * shape.turn;
  // On the upright helix, a card at `phi` sits at this offset from the card the
  // camera is on, turned by rotY(phi) to face out from the axis...
  const local = [r * sin(phi), s * shape.pitch * height, -r * (1 - cos(phi))];
  // ...and the lean turns the whole helix about the camera's card, which
  // therefore stays square to the screen.
  const lean = mul(rotZ(shape.lean), rotX(shape.tilt));
  const [x, y, z0] = apply(lean, local);
  const m = mul(mul(lean, rotY(phi)), transpose(lean));
  // Mid-turn the camera is back; on a card it is home.
  const between = p - floor(p);
  const z = z0 - shape.dolly * long * sin(PI * between);
  const f = (n) => (abs(n) < 1e-6 ? "0" : n.toFixed(5));
  return {
    // CSS's matrix3d is column-major.
    transform: `matrix3d(${f(m[0])},${f(m[3])},${f(m[6])},0,${f(m[1])},${f(m[4])},${f(m[7])},0,${f(m[2])},${f(m[5])},${f(m[8])},0,${x.toFixed(1)},${y.toFixed(1)},${z.toFixed(1)},1)`,
    // square full screen, rounded in the turn
    radius: min(1, a * 6) * 18,
    opacity: 1 - smooth(1.35, 1.9, a),
    // the card nearest the camera on top
    z: 100 - round(a * 10),
    // On a card the others are behind it, not drawn; in the turn, the open spiral is.
    visible: a < 0.999 || (between > 0.001 && a < 1.9),
  };
}

export function createHelix(env, { shape = SHAPES.corkscrew, move = 1.2, hold = 0.45 } = {}) {
  const faces = makeFaces(env.cards);
  const count = faces.canvases.length;
  const pl = plan(count, move, hold, !env.reduced);
  const root = el("div", FILL + "perspective-origin:50% 50%;", env.stage);
  const cards = faces.canvases.map((c) => {
    const d = el("div", FILL + "overflow:hidden;transform-origin:50% 50%;backface-visibility:hidden;visibility:hidden;", root);
    c.style.cssText = "display:block;width:100%;height:100%;";
    d.append(c);
    return d;
  });
  let W = env.stage.clientWidth || 600;
  let H = env.stage.clientHeight || 375;
  const at = { k: 0, f: 0, p: 0 };
  const size = () => {
    faces.build(W * dprOf(), H * dprOf());
    root.style.perspective = `${perspectiveFor(W, H)}px`;
  };
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
      if (env.reduced) return fadeCards(cards, at.p);
      for (let i = 0; i < count; i++) {
        const pose = poseOf(i, at.p, W, H, shape);
        const st = cards[i].style;
        st.transform = pose.transform;
        st.opacity = pose.opacity >= 1 ? "" : pose.opacity.toFixed(3);
        st.borderRadius = pose.radius ? `${pose.radius.toFixed(1)}px` : "";
        st.zIndex = String(pose.z);
        st.visibility = pose.visible ? "visible" : "hidden";
        st.boxShadow = pose.radius > 0 ? "0 40px 90px -40px rgb(26 26 26 / 45%), 0 12px 30px -16px rgb(26 26 26 / 25%)" : "";
      }
    },
  };
}

export const sketches = {
  helix: (env) => createHelix(env),
  calm: (env) => createHelix(env, { shape: SHAPES.calm, move: 1.0, hold: 0.8 }),
};
