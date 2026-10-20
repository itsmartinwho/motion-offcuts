"use client";

import type { CSSProperties, ElementType } from "react";
import { createPortal } from "react-dom";
import { GlassLayers } from "./GlassLayers";
import { FOLDER_MAX, plateLook, type Slot } from "./placement";
import { PostIcon } from "./PostIcon";
import type { HeroPost } from "./types";
import { useFolder } from "./useFolder";
import styles from "./Hero.module.css";

/* The posts' folder: on a phone the home screen has room for nine posts and
   a folder, as iOS does, and the folder holds the rest. The tile is a
   frosted squircle with a 3 x 3 mini-grid — each post's ground as a tiny
   square, not a live picture. Tapping it opens the folder the iOS way
   (useFolder): a frosted panel over the hero that scales up from the tile,
   with the label and the posts' icons — asleep, mounted only while it is
   open. */

type ColourStyle = CSSProperties & Record<`--${string}`, string | number>;

export function HeroFolder({
  rest,
  first,
  lit,
  slot,
  linkComponent: LinkTag = "a",
}: {
  rest: HeroPost[];
  /** The index of the first of `rest` among all the posts. */
  first: number;
  lit: boolean;
  slot: Slot;
  linkComponent?: ElementType;
}) {
  const { tileRef, panelRef, phase, hero, id, open, toggle, close, trap, tapTile } = useFolder();
  const cells = rest.slice(0, FOLDER_MAX);
  const colours = (post: HeroPost, i: number): ColourStyle => {
    const look = plateLook(first + i, post.palette, post.phase);
    return {
      "--ground": look.palette.ground.join(" "),
      "--deep": look.palette.deep.join(" "),
      "--edge": look.palette.edge.join(" "),
      "--wash": look.wash,
    };
  };

  return (
    <>
      <li className={`${styles.file} ${styles.folder}`} style={{ "--pc": slot[0], "--pr": slot[1] } as ColourStyle}>
        <button
          ref={tileRef}
          type="button"
          className={`${styles.fileLink} ${styles.folderButton}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          aria-label="More posts"
          onClick={toggle}
        >
          <span className={`${styles.thumb} ${styles.folderThumb}`} data-open={open ? "true" : "false"}>
            <span className={styles.folderMini} aria-hidden="true">
              {cells.map((post, i) => (
                <span key={post.id} style={colours(post, i)} />
              ))}
            </span>
          </span>
          <span className={styles.caption}>More</span>
        </button>
      </li>

      {phase !== "closed" &&
        hero &&
        createPortal(
          <div className={styles.folderLayer} data-phase={phase}>
            <button type="button" className={styles.folderScrim} tabIndex={-1} aria-label="Close" onClick={close} />
            <div
              ref={panelRef}
              id={id}
              role="dialog"
              aria-modal="true"
              aria-label="More"
              tabIndex={-1}
              className={styles.folderPanel}
              onKeyDown={trap}
              onClick={tapTile}
            >
              <div className={styles.folderGlass} aria-hidden="true">
                <GlassLayers />
              </div>
              <p className={styles.folderLabel}>More</p>
              <ul className={styles.folderGrid}>
                {cells.map((post, i) => (
                  <li key={post.id}>
                    <LinkTag href={post.href} className={styles.fileLink} style={colours(post, i)}>
                      <span className={styles.thumb}>
                        <PostIcon post={post} index={first + i} asleep lit={lit} />
                      </span>
                      <span className={styles.caption}>{post.title}</span>
                    </LinkTag>
                  </li>
                ))}
              </ul>
            </div>
          </div>,
          hero,
        )}
    </>
  );
}
