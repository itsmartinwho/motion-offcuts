/* The scroll the four card transitions share, and the small helpers they use.

   The scroll is counted in screens (one screen is the stage's height). Cards
   alternate a hold (a card full screen, at rest) and a move (the turn to the
   next one), so card k comes to rest at k * (move + hold). Everything here is
   a pure function of the reader's place, so a sketch only has to write
   transforms, styles or pixels from it.

   placeOf() is the site's own: the scroll in screens -> p, the camera's place
   in cards (an integer is a card at rest, between two the move is on). */

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const range = (x, a, b) => clamp((x - a) / (b - a));
export const ease = (f) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(f));
export const smooth = (a, b, x) => {
  const t = range(x, a, b);
  return t * t * (3 - 2 * t);
};
export const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/* Where each of `count` cards rests, and how long the scroll is. `start` is
   mid-way through the first move, so a page opens on a turn already going,
   or on the first card when `opening` is false. */
export function plan(count, move, hold, opening = true) {
  const rests = Array.from({ length: count }, (_, k) => k * (move + hold));
  return { count, move, hold, rests, screens: rests[count - 1], start: opening ? rests[1] - move * 0.5 : 0 };
}

/* The card the reader is on (k) and how far through its move to the next
   (f, 0 on a hold), and the camera's place p. A move eases out of one card
   and into the next: slow off the card, quick through the open space, slow
   onto the next. */
export function placeOf(pl, s, out) {
  const last = pl.count - 1;
  out.k = last;
  out.f = 0;
  for (let k = 0; k < last; k++) {
    const t0 = pl.rests[k + 1] - pl.move;
    if (s < t0) {
      out.k = k;
      break;
    }
    if (s < pl.rests[k + 1]) {
      out.k = k;
      out.f = (s - t0) / pl.move;
      break;
    }
  }
  out.p = out.k + ease(out.f);
  return out;
}

/* Under reduced motion nothing turns, slides or twists: the next card fades in
   over the last, in place, in the middle of the move (a half-and-half of two
   pictures reads as mud). `i - p` is how far card i is ahead of the camera. */
export const fadeOf = (i, p) => {
  const s = i - p;
  return s <= 0 ? (s > -1 ? 1 : 0) : clamp((0.7 - s) / 0.4);
};

/* Cards as absolutely placed elements: the reduced-motion state of a stack. */
export function fadeCards(divs, p) {
  divs.forEach((d, i) => {
    const o = fadeOf(i, p);
    const st = d.style;
    st.transform = "none";
    st.borderRadius = "";
    st.boxShadow = "none";
    st.opacity = o >= 1 ? "" : o.toFixed(3);
    st.zIndex = String(i > p ? 101 : 100);
    st.visibility = o > 0 ? "visible" : "hidden";
  });
}

export function el(tag, css, parent) {
  const e = document.createElement(tag);
  if (css) e.style.cssText = css;
  if (parent) parent.append(e);
  return e;
}
export const FILL = "position:absolute;inset:0;";
export const dprOf = () => Math.min(2, devicePixelRatio || 1);
