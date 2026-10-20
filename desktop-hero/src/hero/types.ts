import type { CSSProperties, ElementType, ReactNode } from "react";

/** An sRGB colour as three 0–255 channels. */
export type RGB = readonly [number, number, number];

/**
 * The colours of a post's live icon: the essay-plate look (see PlateIcon).
 * `ground` is the darkest note, `deep` the tint it lifts toward from the top
 * left, `ink` the out-of-focus type, `edge` the in-focus type and the flutes'
 * highlight. Pick from PALETTES or make your own.
 */
export interface PlatePalette {
  ground: RGB;
  deep: RGB;
  ink: RGB;
  edge: RGB;
}

/** A post on the desktop: a file icon with its title under it. */
export interface HeroPost {
  /** Unique and stable (a slug). */
  id: string;
  title: string;
  href: string;
  /**
   * The lines set behind the icon's fluted glass — a post's opening lines
   * read well. Defaults to the title.
   */
  lines?: string[];
  /** The live icon's colours. Defaults to a palette picked by position. */
  palette?: PlatePalette;
  /**
   * Where on the engaged colour curve the icon's wash sits (any number; the
   * curve repeats every 2π or so). Defaults to one picked by position.
   */
  phase?: number;
  /** Something drawn on the live icon's glass: an SVG, an animation. */
  overlay?: ReactNode;
  /** A picture instead of the live icon (any square-ish image). */
  image?: string;
  /** Anything instead of the live icon. Wins over `image`. */
  icon?: ReactNode;
}

/** The dock's built-in liquid-glass glyphs (DockGlyphs). */
export type GlyphName = "nib" | "layers" | "mic" | "plane";

/** The dock's built-in line glyphs (LineGlyphs): the quiet style. */
export type LineGlyphName = "page" | "steps" | "news" | "mail";

/** The built-in tile grounds: a colour run, ultramarine to coral. */
export type GroundName = "ultramarine" | "violet" | "magenta" | "coral";

export type DockIcon =
  /** A liquid-glass glyph on a coloured, fluted ground. */
  | { glyph: GlyphName; ground?: GroundName }
  /** A line glyph on faint glass, in `color` (white by default): quieter. */
  | { line: LineGlyphName; color?: string }
  /** A picture filling the tile; `round` for a coin or an avatar. */
  | { image: string; round?: boolean }
  /** Your own mark (an SVG, a letter) on any background, in `color`. */
  | { node: ReactNode; background?: string; color?: string; round?: boolean };

export interface DockItem {
  label: string;
  href: string;
  /** Opens in a new tab. */
  external?: boolean;
  icon: DockIcon;
}

export interface DockGroup {
  items: DockItem[];
  /**
   * On a phone, show this group as one folder with this name: the tile holds
   * the items small, and a tap opens them full size, named.
   */
  folder?: string;
}

/** The fluted glass over the wallpaper (Paper's FlutedGlass shader). */
export interface GlassTune {
  size: number;
  distortion: number;
  blur: number;
  shadows: number;
  highlights: number;
  edges: number;
  /** The glass's shading and light. */
  colorShadow: string;
  colorHighlight: string;
}

/** Where the figure's box stands in one band of the card. */
export interface FigureFit {
  /**
   * The point of the picture kept in view as it is covered into the card
   * (CSS object-position, applied to the picture and its mask alike).
   */
  anchor: string;
  /** The box's size as a share of the card's: below 1 it stands smaller. */
  scale: number;
  /** The point across the card that stays put as it scales (0 left, 1 right). */
  x: number;
}

/**
 * A figure cut out and standing on the wallpaper, in front of the glass:
 * either a photograph and a mask of its silhouette (white on transparent, the
 * same shape as the photograph: scripts/build-figure.mjs makes both), or a
 * picture that is already cut out (transparent around the figure), with no
 * mask.
 */
export interface HeroFigure {
  src: string;
  mask?: string;
  /** Fits for the 2:1 band (≥901px), the 4:3 band (701–900px) and a phone. */
  wide?: Partial<FigureFit>;
  mid?: Partial<FigureFit>;
  phone?: Partial<FigureFit>;
}

export interface HeroProps {
  /** The name in the top left (an h1). */
  name: string;
  /** The line under it. */
  tagline?: string;
  /** The wallpaper the glass bends: a photograph or a texture, ≥1400px wide. */
  wallpaper: string;
  figure?: HeroFigure;
  posts: HeroPost[];
  dock: DockGroup[];
  /** Tune the fluted glass. */
  glass?: Partial<GlassTune>;
  /**
   * The component internal links render with — pass Next.js's `Link` or your
   * router's. Defaults to a plain `<a>`.
   */
  linkComponent?: ElementType;
  /** The section's accessible name. Defaults to `name`. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}
