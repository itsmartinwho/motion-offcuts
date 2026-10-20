import type { JSX } from "react";
import type { GlyphName } from "./types";

/* The dock's four built-in glyphs, each in liquid glass — frosted white, lit
   from the top left, with a specular rim — for a tile on one of the colour
   grounds (Hero.module.css, .groundUltramarine…). The glass's edge is split
   cyan and red, as misregistered print is, and it throws a soft caustic
   onto the ground; the ground is seen through fluted glass.

   `nib` is a fountain-pen nib with a stroke of ink (writing, a blog),
   `layers` three stacked slabs with a hot core (work, projects), `mic` a
   studio microphone (talks, press, podcasts), `plane` a paper plane
   (contact). Drawn on a 24 grid. Hovered or keyboard-focused on a desktop
   each does one thing (Hero.module.css): the nib writes, the slabs part, the
   microphone sounds, the plane flies off and comes back round. A phone shows
   them at rest.

   The gradients and the fringe are defined once (DockGlyphDefs), in the dock. */

type GlyphProps = { className?: string };

export function DockGlyphDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute" }}>
      <defs>
        <linearGradient id="hero-dock-glass" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.96" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0.72" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id="hero-dock-glass-back" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.18" />
        </linearGradient>
        <linearGradient id="hero-dock-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.15" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="hero-dock-hot" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe9a8" />
          <stop offset="0.5" stopColor="#ff9ccf" />
          <stop offset="1" stopColor="#b98bff" />
        </linearGradient>
        <radialGradient id="hero-dock-caustic">
          <stop offset="0" stopColor="#ffd3ef" stopOpacity="0.75" />
          <stop offset="1" stopColor="#ff7ad1" stopOpacity="0" />
        </radialGradient>
        {/* The glass's edge, split cyan up-left and red down-right, and its
            shadow on the ground. */}
        <filter id="hero-dock-fringe" x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
          <feMorphology in="SourceAlpha" operator="dilate" radius="0.25" result="fat" />
          <feComposite in="fat" in2="SourceAlpha" operator="out" result="edge" />
          <feOffset in="edge" dx="-0.4" dy="-0.2" result="e1" />
          <feFlood floodColor="#47ffd9" floodOpacity="0.85" />
          <feComposite in2="e1" operator="in" result="c1" />
          <feOffset in="edge" dx="0.4" dy="0.25" result="e2" />
          <feFlood floodColor="#ff3b6b" floodOpacity="0.8" />
          <feComposite in2="e2" operator="in" result="c2" />
          <feGaussianBlur in="SourceAlpha" stdDeviation="0.6" />
          <feOffset dy="0.7" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.35" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="c1" />
            <feMergeNode in="c2" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}

const svgProps = { viewBox: "0 0 24 24", "aria-hidden": true, focusable: false } as const;

export function NibGlyph({ className }: GlyphProps) {
  return (
    <svg {...svgProps} className={className}>
      <ellipse cx="11" cy="17" rx="7" ry="4" fill="url(#hero-dock-caustic)" />
      <path
        data-part="ink"
        d="M4.2 19.6c2.4-.3 4.3-1.6 6-3.6"
        pathLength={1}
        fill="none"
        stroke="url(#hero-dock-hot)"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <g data-part="nib">
        <g filter="url(#hero-dock-fringe)" transform="rotate(38 12 12)">
          <path
            fillRule="evenodd"
            fill="url(#hero-dock-glass)"
            stroke="url(#hero-dock-rim)"
            strokeWidth={0.4}
            d="M12 21.2 7.6 12.6c-.5-1-.3-2.1.5-2.8l1.6-1.5V5.1h4.6v3.2l1.6 1.5c.8.7 1 1.8.5 2.8Z M12 13.9a1.15 1.15 0 1 0 0-2.3 1.15 1.15 0 0 0 0 2.3Z"
          />
          <path d="M12 14.2v6.1" stroke="#2a0f9a" strokeOpacity={0.55} strokeWidth={0.55} strokeLinecap="round" />
          <rect x="9.4" y="3.2" width="5.2" height="2.6" rx="0.8" fill="url(#hero-dock-glass-back)" stroke="url(#hero-dock-rim)" strokeWidth={0.3} />
        </g>
      </g>
    </svg>
  );
}

export function LayersGlyph({ className }: GlyphProps) {
  const slab = { stroke: "url(#hero-dock-rim)", strokeLinejoin: "round" } as const;
  return (
    <svg {...svgProps} className={className}>
      <ellipse cx="12" cy="19.5" rx="8" ry="3.4" fill="url(#hero-dock-caustic)" />
      <g filter="url(#hero-dock-fringe)">
        <path data-part="low" d="M12 14.6 19.4 18.4 12 22.2 4.6 18.4Z" fill="url(#hero-dock-glass-back)" strokeWidth={0.35} {...slab} />
        <path d="M12 9.9 19.4 13.7 12 17.5 4.6 13.7Z" fill="url(#hero-dock-glass-back)" strokeWidth={0.35} {...slab} />
        <g data-part="high">
          <path d="M12 5.2 19.4 9 12 12.8 4.6 9Z" fill="url(#hero-dock-glass)" strokeWidth={0.4} {...slab} />
          <path data-part="core" d="M12 7.4 15.2 9 12 10.6 8.8 9Z" fill="url(#hero-dock-hot)" />
        </g>
      </g>
    </svg>
  );
}

export function MicGlyph({ className }: GlyphProps) {
  return (
    <svg {...svgProps} className={className}>
      <ellipse cx="12" cy="12" rx="6" ry="7" fill="url(#hero-dock-caustic)" />
      <g data-part="waves" fill="none" stroke="#fff" strokeWidth={0.8} strokeLinecap="round">
        <path d="M5.3 6.4a7.4 7.4 0 0 0 0 7.2M18.7 6.4a7.4 7.4 0 0 1 0 7.2" />
        <path d="M3.2 4.8a10.4 10.4 0 0 0 0 10.4M20.8 4.8a10.4 10.4 0 0 1 0 10.4" />
      </g>
      <path d="M7 11.4v.6a5 5 0 0 0 10 0v-.6" fill="none" stroke="url(#hero-dock-glass-back)" strokeWidth={1.1} strokeLinecap="round" />
      <path d="M12 17v3.2M9.2 20.6h5.6" stroke="#fff" strokeOpacity={0.55} strokeWidth={1.1} strokeLinecap="round" />
      <g filter="url(#hero-dock-fringe)">
        <rect x="9" y="3.4" width="6" height="11.4" rx="3" fill="url(#hero-dock-glass)" stroke="url(#hero-dock-rim)" strokeWidth={0.4} />
        <path data-part="grille" d="M9.2 7.6h5.6M9.2 9.4h5.6M9.2 11.2h5.6" stroke="url(#hero-dock-hot)" strokeWidth={0.7} strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function PlaneGlyph({ className }: GlyphProps) {
  const rim = { stroke: "url(#hero-dock-rim)", strokeLinejoin: "round" } as const;
  return (
    <svg {...svgProps} className={className}>
      <ellipse cx="13" cy="15" rx="7" ry="5" fill="url(#hero-dock-caustic)" />
      <path
        data-part="trail"
        d="M2.8 20.2c1.9-.4 3.6-1.1 4.9-2.1"
        fill="none"
        stroke="#fff"
        strokeOpacity={0.6}
        strokeWidth={0.9}
        strokeLinecap="round"
        strokeDasharray="1.1 1.4"
      />
      <g data-part="plane">
        <g filter="url(#hero-dock-fringe)">
          <path d="M20.4 4.2 4.4 11.1l5.3 2.1Z" fill="url(#hero-dock-glass)" strokeWidth={0.4} {...rim} />
          <path d="M20.4 4.2 9.7 13.2l.9 6.2Z" fill="url(#hero-dock-glass-back)" strokeWidth={0.35} {...rim} />
          <path d="M20.4 4.2 10.6 19.4l3.1-2.6 3 1.6Z" fill="url(#hero-dock-glass)" strokeWidth={0.4} {...rim} />
          <path d="M20.4 4.2 13.7 16.8l-3.1 2.6" fill="none" stroke="url(#hero-dock-hot)" strokeWidth={0.6} strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}

export const DOCK_GLYPHS: Record<GlyphName, (props: GlyphProps) => JSX.Element> = {
  nib: NibGlyph,
  layers: LayersGlyph,
  mic: MicGlyph,
  plane: PlaneGlyph,
};
