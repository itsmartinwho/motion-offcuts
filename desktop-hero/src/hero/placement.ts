import { washAt } from "./plate/glass";
import type { FigureFit, PlatePalette } from "./types";

/* Where the files sit on the desktop, the order the spotlight takes them in,
   and where the figure stands. Pure data: the hero reads it into CSS
   variables, so placement costs nothing at runtime and never depends on a
   measurement.

   A desktop file is placed by its icon's horizontal centre and its top edge,
   as fractions of the card's width and height. The card keeps one shape
   within a band (2:1 from 901px up, 4:3 from 701 to 900) and the icon size
   scales with it, so fractions stay true across the band. The scatter keeps
   to the left three-fifths of the card and clear of the name, leaving the
   right to the figure; no two files share a column or a row, and there are
   at least 8px between any two at every width. Files are taken in the posts'
   order. */

export type Slot = readonly [x: number, y: number];

/** ≥ 901px, 2:1. Twelve places; more posts than that are left off the
    desktop (and go in the phone's folder). */
export const WIDE: readonly Slot[] = [
  [0.6, 0.045],
  [0.411, 0.097],
  [0.38, 0.336],
  [0.48, 0.568],
  [0.309, 0.07],
  [0.344, 0.577],
  [0.271, 0.317],
  [0.171, 0.408],
  [0.207, 0.69],
  [0.071, 0.248],
  [0.071, 0.491],
  [0.107, 0.757],
];

/** 701–900px, 4:3. */
export const MID: readonly Slot[] = [
  [0.359, 0.249],
  [0.382, 0.054],
  [0.53, 0.13],
  [0.217, 0.18],
  [0.311, 0.494],
  [0.7, 0.045],
  [0.169, 0.37],
  [0.405, 0.677],
  [0.084, 0.186],
  [0.264, 0.678],
  [0.13, 0.56],
  [0.084, 0.819],
];

/** The order the spotlight visits the desktop's files in: slow, and each step
    lands far from the last, so the one awake file wanders the desktop. */
export const SPOTLIGHT_ORDER: readonly number[] = [0, 11, 1, 10, 3, 9, 5, 4, 8, 2, 7, 6];

/** A phone's home screen: the files stand in a staircase on the left of the
    card — four high in the first column, then three, two and one — so the
    figure has the right and the top. Columns and rows of a 4 x 4 grid,
    counted from 1 and stood on the dock; the files fill it in reading order,
    and the folder holding the rest is the step at the foot (FOLDER_SLOT). */
export const PHONE_SLOTS: readonly Slot[] = [
  [1, 1],
  [1, 2],
  [2, 2],
  [1, 3],
  [2, 3],
  [3, 3],
  [1, 4],
  [2, 4],
  [3, 4],
];

export const FOLDER_SLOT: Slot = [4, 4];

/** Files on a phone's home screen: one per step, the folder in the last. */
export const PHONE_FILES = PHONE_SLOTS.length;

/** The spotlight's order on a phone's home screen (files 0–8). */
export const PHONE_ORDER: readonly number[] = [0, 8, 3, 5, 1, 7, 4, 6, 2];

/** The folder's mini-grid shows at most this many of the rest (3 x 3). */
export const FOLDER_MAX = 9;

/** The figure: a box the size of the card, its picture covered into it at
    `anchor`, then scaled down to `scale` and stood on the bottom edge at `x`
    — so it stands on the right, smaller than the card. */
export const FIGURE_FIT: Record<"wide" | "mid" | "phone", FigureFit> = {
  wide: { anchor: "70% 22%", scale: 0.82, x: 0.72 },
  mid: { anchor: "70% 22%", scale: 0.82, x: 0.72 },
  phone: { anchor: "78% 0%", scale: 0.85, x: 0.78 },
};

const palette = (ground: PlatePalette["ground"], deep: PlatePalette["deep"], ink: PlatePalette["ink"], edge: PlatePalette["edge"]): PlatePalette => ({
  ground,
  deep,
  ink,
  edge,
});

/** Palettes for the live icons: each a dark ground lifting toward one hue.
    Posts without a palette take these in turn. */
export const PALETTES = {
  indigo: palette([9, 9, 17], [34, 32, 64], [92, 90, 148], [206, 203, 238]),
  ember: palette([16, 9, 8], [58, 30, 24], [148, 96, 78], [240, 214, 202]),
  teal: palette([6, 14, 13], [20, 48, 45], [76, 128, 120], [206, 236, 230]),
  violet: palette([11, 9, 19], [40, 32, 70], [112, 96, 164], [222, 214, 244]),
  amber: palette([16, 11, 7], [56, 38, 20], [152, 112, 70], [244, 224, 196]),
  ochre: palette([15, 13, 7], [52, 44, 22], [140, 118, 70], [242, 230, 196]),
  steel: palette([7, 10, 16], [24, 36, 56], [82, 110, 146], [208, 222, 240]),
  green: palette([5, 14, 10], [16, 50, 34], [66, 136, 100], [204, 240, 220]),
  sand: palette([15, 12, 8], [52, 42, 28], [150, 126, 90], [244, 232, 208]),
  plum: palette([15, 7, 15], [52, 22, 48], [138, 78, 126], [242, 210, 234]),
  blue: palette([8, 9, 18], [28, 30, 66], [90, 94, 160], [208, 212, 244]),
  slate: palette([6, 12, 14], [20, 40, 46], [70, 116, 126], [204, 228, 232]),
} as const satisfies Record<string, PlatePalette>;

const ROTATION = Object.values(PALETTES);
/** Washes that suit each palette above, in the same order. */
const PHASES = [0.62, 3.0, 0.9, 2.8, 3.2, 0.45, 3.5, 0.95, 0.3, 2.65, 3.05, 0.7];

/** A post's palette and phase, given or picked by its position, and the
    engaged wash they make (as "r g b"). */
export function plateLook(i: number, given?: PlatePalette, phase?: number) {
  const k = i % ROTATION.length;
  const at = phase ?? PHASES[k];
  return { palette: given ?? ROTATION[k], phase: at, wash: washAt(at) };
}
