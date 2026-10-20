"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { PlatePalette } from "../types";
import { FLUTES, mountPlate, wakePlates } from "./glass";
import styles from "./PlateIcon.module.css";

type PlateStyle = CSSProperties & Record<`--${string}`, string | number>;

/**
 * A post's live icon: its lines behind fluted glass, and on the glass an
 * optional overlay (a mark, a diagram).
 *
 * Back to front: the ground (CSS, so the icon is never blank), the type
 * (canvas — see glass.ts), the flutes' shading, a scrim to seat the
 * overlay, the engaged colour wash and its grain — both held at zero until
 * the icon is engaged — and the overlay, on top of all of it.
 *
 * At rest the type steps back, the ground is lifted under a veil of white
 * and the overlay is brought up, so the small picture reads luminous.
 * Engaged (hover, focus) the lines come through in focus and the colour
 * washes in. `lit` makes the engaged look the resting one (a screen with no
 * hover). `asleep` holds the icon on one drawn frame until it is woken.
 */
export function PlateIcon({
  lines,
  palette,
  phase,
  overlay,
  asleep,
  lit,
}: {
  lines: string[];
  palette: PlatePalette;
  phase: number;
  overlay?: ReactNode;
  asleep?: boolean;
  lit?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Re-mounted only when what it shows changes, not when a parent passes
  // equal arrays anew.
  const look = JSON.stringify([lines, palette, phase]);
  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const [quotes, ramp, at] = JSON.parse(look) as [string[], PlatePalette, number];
    if (!host || !canvas || quotes.length === 0) return;
    return mountPlate({ host, canvas, quotes, ramp, phase: at, lit });
  }, [look, lit]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.dataset.asleep = asleep ? "true" : "false";
    if (!asleep) wakePlates();
  }, [asleep]);

  const style: PlateStyle = {
    "--ground": palette.ground.join(" "),
    "--deep": palette.deep.join(" "),
    "--edge": palette.edge.join(" "),
    "--flutes": FLUTES,
  };

  return (
    <div ref={hostRef} className={styles.plate} style={style} data-lit={lit ? "" : undefined} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.glass} />
      <span className={styles.flutes} />
      <span className={styles.scrim} />
      <span className={styles.wash} />
      <span className={styles.grain} />
      {overlay ?? <span className={styles.glow} />}
    </div>
  );
}
