import styles from "./Hero.module.css";

/**
 * The glass the dock and the folders are made of: a backdrop blur with a
 * lift in colour, a tint, a corner-lit rim and an inner shine. The host owns
 * the radius; each layer inherits it, so they stay clipped to one object.
 * Nothing between the host and the page behind it may set a filter, an
 * opacity or a mask, or the blur has nothing to blur.
 */
export function GlassLayers() {
  return (
    <>
      <span className={`${styles.glassLayer} ${styles.glassEffect}`} aria-hidden="true" />
      <span className={`${styles.glassLayer} ${styles.glassOutline}`} aria-hidden="true" />
      <span className={`${styles.glassLayer} ${styles.glassTint}`} aria-hidden="true" />
      <span className={`${styles.glassLayer} ${styles.glassShine}`} aria-hidden="true" />
    </>
  );
}
