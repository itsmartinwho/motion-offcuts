/** Finishes for a mark tile (`{ node, ...FINISHES.silver }`): a background
    and the ink the mark is drawn in. */
export const FINISHES = {
  /** A diagonal of pale green, white and pale pink; deep green ink. */
  pastel: { background: "linear-gradient(135deg, #cfeee4 0%, #ffffff 52%, #f6dbe8 100%)", color: "#0f4f4a" },
  /** Brushed silver lit from the top; near-black ink. */
  silver: {
    background: "linear-gradient(180deg, rgb(255 255 255 / 55%) 0%, rgb(255 255 255 / 0%) 46%), linear-gradient(145deg, #e9ecf1 0%, #b9bec7 100%)",
    color: "#15171b",
  },
  /** Near-black, lit faintly from the top left; white ink. */
  ink: { background: "linear-gradient(150deg, rgb(196 200 210 / 16%), rgb(196 200 210 / 0%) 58%), #08090c", color: "#ffffff" },
  /** Bone, like a struck coin; graphite ink. */
  bone: { background: "radial-gradient(120% 120% at 30% 20%, #ffffff 0%, #ece8df 55%, #cfc9bc 100%)", color: "#2a2a2e" },
} as const;
