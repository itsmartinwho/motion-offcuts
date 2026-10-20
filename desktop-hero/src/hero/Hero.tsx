"use client";

import { preload } from "react-dom";
import { Component, useEffect, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
import { HeroDock } from "./HeroDock";
import { HeroFiles } from "./HeroFiles";
import { FIGURE_FIT } from "./placement";
import type { GlassTune, HeroProps } from "./types";
import { whenIdle } from "./useMedia";
import styles from "./Hero.module.css";

/* A personal desktop as a hero. The wallpaper is built in three layers: a
   picture, Paper Design's fluted glass drawn over it (bending its folds),
   and, optionally, a figure — a sharp photograph cut out by a feathered
   mask of its silhouette, scaled into the card's lower right and standing
   on its bottom edge. The glass never touches the figure. The posts lie on
   the wallpaper as files, each with its own live picture, and a dock carries
   the links. On a phone the same desktop is a home screen: the files in a
   staircase on the left and a folder for the ones that do not fit.

   The picture is the no-WebGL fallback and the loading state; the glass
   fades in over it once its picture has decoded, after the page has loaded
   and gone idle. The figure fades in once its picture and its mask have
   both arrived, so it is never seen half-drawn. */

/** The glass's defaults, for a deep blue picture. */
export const GLASS: GlassTune = {
  size: 0.955,
  distortion: 0.35,
  blur: 0.04,
  shadows: 0.3,
  highlights: 0.24,
  edges: 0.06,
  colorShadow: "#020714",
  colorHighlight: "#d8e8ff",
};

type FlutedGlassType = ComponentType<Record<string, unknown>>;

/** A shader that throws (no WebGL 2, a lost context) must leave the picture. */
class Guard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {}
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/* Whether to try the glass at all. Making a context to find out costs as
   much as the glass's own; where WebGL2 exists but a context is refused, the
   boundary round the glass catches it and the picture stays. */
function hasWebGL2() {
  return typeof window.WebGL2RenderingContext === "function";
}

export function Hero({ name, tagline, wallpaper, figure, posts, dock, glass: tune, linkComponent, label, className, style }: HeroProps) {
  const hostRef = useRef<HTMLElement>(null);
  const stillRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [near, setNear] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [visible, setVisible] = useState(true);
  const [Fluted, setFluted] = useState<FlutedGlassType | null>(null);
  const [stillLoaded, setStillLoaded] = useState(false);
  const [maskLoaded, setMaskLoaded] = useState(!figure?.mask);

  // After the page has loaded: the shader (its code, and its picture
  // decoded), and the files.
  useEffect(() => {
    let cancelled = false;
    let cancelIdle = () => {};
    const start = () => {
      if (cancelled) return;
      setLoaded(true);
      cancelIdle = whenIdle(() => {
        if (cancelled || !hasWebGL2()) return;
        const img = new window.Image();
        img.src = wallpaper;
        Promise.all([img.decode(), import("@paper-design/shaders-react")])
          .then(([, mod]) => !cancelled && setFluted(() => mod.FlutedGlass as unknown as FlutedGlassType))
          .catch(() => undefined);
      }, 2500);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      cancelled = true;
      cancelIdle();
      window.removeEventListener("load", start);
    };
  }, [wallpaper]);

  // The figure comes in when both its picture and its mask are there.
  useEffect(() => {
    if (!figure) return;
    let cancelled = false;
    // decode() resolves at once for a picture that has already loaded.
    stillRef.current
      ?.decode()
      .then(() => !cancelled && setStillLoaded(true))
      .catch(() => undefined);
    if (figure.mask) {
      const mask = new window.Image();
      mask.src = figure.mask;
      mask
        .decode()
        .then(() => !cancelled && setMaskLoaded(true))
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [figure]);

  // Near the screen, on it, and the tab visible: nothing below runs otherwise.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const nearObserver = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { rootMargin: "400px 0px" });
    const onObserver = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    nearObserver.observe(host);
    onObserver.observe(host);
    const sync = () => setVisible(document.visibilityState === "visible");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      nearObserver.disconnect();
      onObserver.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  if (figure) {
    preload(figure.src, { as: "image", fetchPriority: "high" });
    if (figure.mask) preload(figure.mask, { as: "image" });
  }
  const g = { ...GLASS, ...tune };
  const figureVars = Object.fromEntries(
    (["wide", "mid", "phone"] as const).flatMap((band) => {
      const fit = { ...FIGURE_FIT[band], ...figure?.[band] };
      return [
        [`--fig-a-${band}`, fit.anchor],
        [`--fig-s-${band}`, fit.scale],
        [`--fig-x-${band}`, fit.x],
      ];
    }),
  ) as CSSProperties;
  if (figure?.mask) (figureVars as Record<string, string>)["--fig-mask"] = `url("${figure.mask}")`;

  return (
    <section ref={hostRef} className={`${styles.hero} ${className ?? ""}`} style={style} aria-label={label ?? name}>
      <div className={styles.wallpaper} style={figureVars} aria-hidden="true">
        <img src={wallpaper} alt="" decoding="async" className={styles.wall} />
        {Fluted && (
          <Guard>
            <div className={styles.glass}>
              <Fluted
                className={styles.shader}
                image={wallpaper}
                fit="cover"
                shape="lines"
                distortionShape="contour"
                size={g.size}
                distortion={g.distortion}
                shift={0}
                angle={0}
                blur={g.blur}
                shadows={g.shadows}
                highlights={g.highlights}
                edges={g.edges}
                stretch={0}
                grainMixer={0}
                grainOverlay={0}
                colorBack="#00000000"
                colorShadow={g.colorShadow}
                colorHighlight={g.colorHighlight}
                speed={0}
                frame={0}
                maxPixelCount={2073600}
              />
            </div>
          </Guard>
        )}
        {figure && (
          <div className={styles.figure}>
            <img
              ref={stillRef}
              src={figure.src}
              alt=""
              decoding="async"
              className={styles.still}
              data-ready={stillLoaded && maskLoaded ? "true" : "false"}
              onLoad={() => setStillLoaded(true)}
            />
          </div>
        )}
        <span className={styles.floor} />
      </div>

      <div className={styles.name}>
        <h1>{name}</h1>
        {tagline && <p>{tagline}</p>}
      </div>

      <HeroFiles posts={posts} loaded={loaded} near={near} running={onScreen && visible} linkComponent={linkComponent} />
      <HeroDock groups={dock} linkComponent={linkComponent} />
    </section>
  );
}
