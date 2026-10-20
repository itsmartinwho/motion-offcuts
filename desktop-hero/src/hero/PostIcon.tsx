"use client";

import { plateLook } from "./placement";
import { PlateIcon } from "./plate/PlateIcon";
import type { HeroPost } from "./types";
import styles from "./Hero.module.css";

/** What a file shows: the post's own icon, its picture, or — by default —
    the live plate of its lines behind fluted glass. The plate is drawn at
    its 16:10 shape and centred, so the square crops its sides rather than
    squeezing it. */
export function PostIcon({ post, index, asleep, lit }: { post: HeroPost; index: number; asleep: boolean; lit: boolean }) {
  if (post.icon) return <span className={styles.custom}>{post.icon}</span>;
  if (post.image) {
    return <img src={post.image} alt="" decoding="async" className={styles.picture} />;
  }
  const { palette, phase } = plateLook(index, post.palette, post.phase);
  return (
    <span className={styles.plate}>
      <PlateIcon lines={post.lines ?? [post.title]} palette={palette} phase={phase} overlay={post.overlay} asleep={asleep} lit={lit} />
    </span>
  );
}
