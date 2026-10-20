import type { JSX } from "react";
import type { LineGlyphName } from "./types";

/* The dock's quiet style: four line glyphs, drawn on a 24 grid inside a
   3-unit keyline, one 1.5 stroke with round ends, in the tile's ink (white
   by default), on a squircle of barely-there glass (Hero.module.css,
   .tileLine). They sit at one weight beside picture and mark tiles.

   `page` is a document with a folded corner (writing, a blog), `steps` three
   staggered bars (work, building), `news` a newspaper (press), `mail` an
   envelope (contact). */

type GlyphProps = { className?: string };

const svgProps = {
  viewBox: "0 0 24 24",
  "aria-hidden": true,
  focusable: false,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function PageGlyph({ className }: GlyphProps) {
  return (
    <svg {...svgProps} className={className}>
      <path d="M14.5 3.5H6.5a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V7.5Z" />
      <path d="M14.5 3.5V7.5H18.5" />
      <path d="M8.5 11h7M8.5 14h7M8.5 17h4" />
    </svg>
  );
}

export function StepsGlyph({ className }: GlyphProps) {
  return (
    <svg {...svgProps} className={className}>
      <rect x="3" y="16" width="12" height="3.5" rx="1" />
      <rect x="6" y="10.5" width="12" height="3.5" rx="1" />
      <rect x="9" y="5" width="12" height="3.5" rx="1" />
    </svg>
  );
}

export function NewsGlyph({ className }: GlyphProps) {
  return (
    <svg {...svgProps} className={className}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <rect x="6.25" y="7.25" width="11.5" height="2" rx="0.5" fill="currentColor" stroke="none" />
      <path d="M6.5 12.5h4.5M6.5 16h4.5" />
      <rect x="13" y="11.75" width="4.75" height="5" rx="0.75" />
    </svg>
  );
}

export function MailGlyph({ className }: GlyphProps) {
  return (
    <svg {...svgProps} className={className}>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3.75 7 12 12.75 20.25 7" />
    </svg>
  );
}

export const LINE_GLYPHS: Record<LineGlyphName, (props: GlyphProps) => JSX.Element> = {
  page: PageGlyph,
  steps: StepsGlyph,
  news: NewsGlyph,
  mail: MailGlyph,
};
