import type { CSSProperties } from "react";
import { FINISHES, PALETTES, type DockGroup, type HeroPost } from "@/hero";

/* The demo's content: invented posts and links. Replace all of it. */

/* Overlays are drawn on a post's live icon, over its glass, on a 16:10
   picture that the icon crops to a square: keep what matters in the middle.
   They are made brighter at rest, so draw them dim. */
const fill: CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%" };

const Rings = (
  <svg viewBox="0 0 160 100" style={fill} fill="none" stroke="#fff">
    <circle cx="80" cy="50" r="34" strokeOpacity={0.18} />
    <circle cx="80" cy="50" r="24" strokeOpacity={0.3} />
    <circle cx="80" cy="50" r="14" strokeOpacity={0.5} />
    <circle cx="80" cy="50" r="3.5" fill="#fff" stroke="none" />
  </svg>
);

const Horizon = (
  <svg viewBox="0 0 160 100" style={fill}>
    <defs>
      <radialGradient id="demo-sun">
        <stop offset="0" stopColor="#fff" stopOpacity={0.9} />
        <stop offset="1" stopColor="#fff" stopOpacity={0} />
      </radialGradient>
    </defs>
    <circle cx="80" cy="56" r="20" fill="url(#demo-sun)" />
    <circle cx="80" cy="56" r="6" fill="#fff" />
    <rect x="30" y="60" width="100" height="40" fill="#000" fillOpacity={0.35} />
    <path d="M30 60h100" stroke="#fff" strokeOpacity={0.55} />
  </svg>
);

const Door = (
  <svg viewBox="0 0 160 100" style={fill}>
    <defs>
      <linearGradient id="demo-door" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity={0.95} />
        <stop offset="1" stopColor="#fff" stopOpacity={0.55} />
      </linearGradient>
      <linearGradient id="demo-spill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity={0.35} />
        <stop offset="1" stopColor="#fff" stopOpacity={0} />
      </linearGradient>
    </defs>
    <rect x="72" y="22" width="16" height="44" fill="url(#demo-door)" />
    <path d="M72 66h16l14 28H58Z" fill="url(#demo-spill)" />
  </svg>
);

const Orbit = (
  <svg viewBox="0 0 160 100" style={fill} fill="none" stroke="#fff">
    <ellipse cx="80" cy="50" rx="36" ry="13" strokeOpacity={0.35} transform="rotate(-18 80 50)" />
    <circle cx="80" cy="50" r="9" fill="#fff" fillOpacity={0.85} stroke="none" />
    <circle cx="111" cy="40" r="2.6" fill="#fff" stroke="none" />
  </svg>
);

const Dune = (
  <svg viewBox="0 0 160 100" style={fill}>
    <path d="M28 86C52 84 64 52 80 50s30 30 52 36Z" fill="#fff" fillOpacity={0.3} />
    <path d="M80 18v68" stroke="#fff" strokeOpacity={0.8} strokeWidth={1.4} />
  </svg>
);

export const POSTS: HeroPost[] = [
  {
    id: "on-slowness",
    title: "On Slowness",
    href: "#on-slowness",
    lines: ["The fastest way through a hard problem", "is to stop running at it"],
    palette: PALETTES.indigo,
    overlay: Rings,
  },
  {
    id: "the-long-middle",
    title: "The Long Middle",
    href: "#the-long-middle",
    lines: ["Beginnings are loud", "endings are louder", "everything else happens in between"],
    palette: PALETTES.ember,
    overlay: Horizon,
  },
  {
    id: "small-tools",
    title: "Small Tools",
    href: "#small-tools",
    lines: ["Every good workshop is mostly", "small tools kept sharp"],
    palette: PALETTES.teal,
  },
  {
    id: "field-guide-to-attention",
    title: "A Field Guide to Attention",
    href: "#field-guide-to-attention",
    lines: ["Attention is the one thing", "you cannot buy back"],
    palette: PALETTES.violet,
    overlay: Orbit,
  },
  {
    id: "what-the-river-knows",
    title: "What the River Knows",
    href: "#what-the-river-knows",
    lines: ["The river does not hurry", "and it gets everywhere first"],
    palette: PALETTES.amber,
  },
  {
    id: "drafts",
    title: "Drafts",
    href: "#drafts",
    lines: ["Nothing I have written", "was written the first time"],
    palette: PALETTES.ochre,
    overlay: Dune,
  },
  {
    id: "night-trains",
    title: "Night Trains",
    href: "#night-trains",
    lines: ["You fall asleep in one country", "and wake up in a sentence"],
    palette: PALETTES.steel,
  },
  {
    id: "the-open-door",
    title: "The Open Door",
    href: "#the-open-door",
    lines: ["Leave one door open", "and see who walks in"],
    palette: PALETTES.green,
    overlay: Door,
  },
  {
    id: "ten-years-of-weekends",
    title: "Ten Years of Weekends",
    href: "#ten-years-of-weekends",
    lines: ["Side projects are where", "the real work hides"],
    palette: PALETTES.sand,
  },
  {
    id: "against-busy",
    title: "Against Busy",
    href: "#against-busy",
    lines: ["Busy is a feeling", "not a measure"],
    palette: PALETTES.plum,
  },
  {
    id: "learning-in-public",
    title: "Learning in Public",
    href: "#learning-in-public",
    lines: ["Write it down badly", "then write it down again"],
    palette: PALETTES.blue,
  },
  {
    id: "maps-and-territories",
    title: "Maps and Territories",
    href: "#maps-and-territories",
    lines: ["Every plan is a map", "every week is the territory"],
    palette: PALETTES.slate,
  },
];

/* Three invented marks for the projects, each on a finish. */
const OrbitMark = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="18" cy="6" r="2.4" fill="currentColor" stroke="none" />
  </svg>
);

const PrismMark = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
    <path d="M12 3.5 21 19.5H3Z" />
    <path d="M12 3.5v16" />
  </svg>
);

const SparkMark = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <circle cx="12" cy="12" r="9.5" />
    <path d="M12 6.5v3M12 14.5v3M6.5 12h3M14.5 12h3M8.1 8.1l2.1 2.1M13.8 13.8l2.1 2.1M15.9 8.1l-2.1 2.1M10.2 13.8l-2.1 2.1" />
  </svg>
);

export const DOCK: DockGroup[] = [
  { items: [{ label: "About", href: "#about", icon: { node: <span>YN</span>, ...FINISHES.bone, round: true } }] },
  {
    folder: "Projects",
    items: [
      { label: "Orbit", href: "https://example.com", external: true, icon: { node: OrbitMark, ...FINISHES.pastel } },
      { label: "Prism", href: "https://example.com", external: true, icon: { node: PrismMark, ...FINISHES.silver } },
      { label: "Spark", href: "https://example.com", external: true, icon: { node: SparkMark, ...FINISHES.ink } },
    ],
  },
  {
    items: [
      { label: "Blog", href: "#blog", icon: { glyph: "nib" } },
      { label: "Work", href: "#work", icon: { glyph: "layers" } },
      { label: "Talks", href: "#talks", icon: { glyph: "mic" } },
    ],
  },
  { items: [{ label: "Contact", href: "#contact", icon: { glyph: "plane" } }] },
];

/* The same dock in the quiet style: line glyphs on faint glass. */
export const DOCK_LINE: DockGroup[] = [
  DOCK[0],
  DOCK[1],
  {
    items: [
      { label: "Blog", href: "#blog", icon: { line: "page" } },
      { label: "Work", href: "#work", icon: { line: "steps" } },
      { label: "Talks", href: "#talks", icon: { line: "news" } },
    ],
  },
  { items: [{ label: "Contact", href: "#contact", icon: { line: "mail" } }] },
];
