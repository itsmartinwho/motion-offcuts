"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ElementType } from "react";
import { HeroFolder } from "./HeroFolder";
import { FOLDER_SLOT, MID, PHONE_FILES, PHONE_ORDER, PHONE_SLOTS, SPOTLIGHT_ORDER, WIDE, plateLook } from "./placement";
import { PostIcon } from "./PostIcon";
import type { HeroPost } from "./types";
import { useMedia, whenIdle } from "./useMedia";
import styles from "./Hero.module.css";

/* The posts as files on the desktop. A live icon costs (a canvas, a few
   milliseconds to set its type), so they come in after the page has loaded,
   two per idle callback, each slot holding a plain square in the post's
   ground until its picture is there. Every live icon is asleep — one frame
   drawn, then still — except the spotlight's, which wakes one at a time, for
   a few seconds each, in a slow fixed order, so the desktop always has one
   thing quietly moving. Hover and focus engage an icon on their own; nothing
   here runs while the card is off screen. A screen with no hover has
   nothing to engage them with, so there they are lit: every icon rests in
   its engaged look, and the spotlight sets one moving at a time.

   On a phone the desktop is a home screen: the files stand in a staircase
   on the left (PHONE_SLOTS) and the last step is a folder holding the rest
   (HeroFolder). The files that do not fit stay in the markup (data-fold) and
   CSS hides them on a phone; on a wider screen they are all desktop files,
   and the folder is hidden. */

const SPOTLIGHT_MS = 4000;

type FileStyle = CSSProperties & Record<`--${string}`, string | number>;

export function HeroFiles({
  posts,
  loaded,
  near,
  running,
  linkComponent: LinkTag = "a",
}: {
  posts: HeroPost[];
  /** The page has finished loading. */
  loaded: boolean;
  /** The card is on, or close to, the screen. */
  near: boolean;
  /** The card is on screen and the tab is visible. */
  running: boolean;
  linkComponent?: ElementType;
}) {
  const phone = useMedia("(max-width: 700px)");
  const lit = useMedia("(hover: none)");
  const total = Math.min(posts.length, WIDE.length);
  const desk = posts.slice(0, total);
  // On a phone, the files that do not fit the staircase go in the folder.
  const folds = posts.length > PHONE_FILES + 1;
  const folded = folds ? posts.slice(PHONE_FILES) : [];
  const shown = phone && folds ? PHONE_FILES : total;
  const order = useMemo(() => (phone ? PHONE_ORDER : SPOTLIGHT_ORDER).filter((i) => i < shown), [phone, shown]);

  // Mounting: two pictures per idle callback, in the order the spotlight
  // will visit them, so the first one it wakes is the first one that is
  // there. A short timeout: a page running its own frame loop is never idle,
  // and a browser that waits to be idle waits out every timeout.
  const [mounted, setMounted] = useState(0);
  useEffect(() => {
    if (!loaded || !near || mounted >= order.length) return;
    return whenIdle(() => setMounted((n) => Math.min(order.length, n + 2)), 500);
  }, [loaded, near, mounted, order.length]);

  // The spotlight: one awake at a time, only while the card runs.
  const [turn, setTurn] = useState(0);
  useEffect(() => {
    if (!running) return;
    let id = 0;
    const step = () => {
      setTurn((t) => t + 1);
      id = window.setTimeout(step, SPOTLIGHT_MS);
    };
    id = window.setTimeout(step, SPOTLIGHT_MS);
    return () => window.clearTimeout(id);
  }, [running]);
  const awake = running && mounted > 0 ? order[turn % Math.min(mounted, order.length)] : -1;

  const rank = useMemo(() => {
    const byFile = new Map<number, number>();
    order.forEach((file, i) => byFile.set(file, i));
    return byFile;
  }, [order]);

  return (
    <ul className={styles.files} aria-label="Posts">
      {desk.map((post, i) => {
        const look = plateLook(i, post.palette, post.phase);
        const style: FileStyle = {
          "--ground": look.palette.ground.join(" "),
          "--deep": look.palette.deep.join(" "),
          "--edge": look.palette.edge.join(" "),
          "--wash": look.wash,
          "--wx": WIDE[i][0],
          "--wy": WIDE[i][1],
          "--mx": MID[i][0],
          "--my": MID[i][1],
        };
        // A phone's step: with exactly one file too many for the staircase
        // there is no folder, and that file takes the folder's step.
        const step = i < PHONE_FILES ? PHONE_SLOTS[i] : i === PHONE_FILES ? FOLDER_SLOT : null;
        if (step) {
          style["--pc"] = step[0];
          style["--pr"] = step[1];
        }
        const live = (rank.get(i) ?? Infinity) < mounted;
        return (
          <li key={post.id} className={styles.file} style={style} data-fold={folded.includes(post) ? "true" : undefined}>
            <LinkTag href={post.href} className={styles.fileLink}>
              <span className={styles.thumb}>
                {live && <PostIcon post={post} index={i} asleep={awake !== i} lit={lit} />}
              </span>
              <span className={styles.caption}>{post.title}</span>
            </LinkTag>
          </li>
        );
      })}
      {folded.length > 0 && <HeroFolder rest={folded} first={PHONE_FILES} lit={lit} slot={FOLDER_SLOT} linkComponent={LinkTag} />}
    </ul>
  );
}
