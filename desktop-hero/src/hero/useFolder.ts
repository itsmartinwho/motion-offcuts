"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";

/* An iOS folder's open and close, shared by the posts' "More" folder
   (HeroFolder) and the dock's group folders (DockFolder). The tile is a
   button; tapping it opens a frosted panel over the hero that grows out of
   the tile (transform and opacity, nothing else). It closes on a tap
   outside, on Escape, on the tile again (the panel may cover the tile, so a
   tap on the panel where the tile is counts as the tile's), or when the
   screen grows past a phone's; focus goes into the panel on open and back
   to the tile on close. The host portals the panel into `hero`. */

/** Matches the transition in Hero.module.css (.folderPanel). */
const CLOSE_MS = 320;

export type FolderPhase = "closed" | "enter" | "open" | "exit";

export function useFolder() {
  const tileRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<FolderPhase>("closed");
  const [hero, setHero] = useState<HTMLElement | null>(null);
  const id = useId();
  const open = phase === "enter" || phase === "open";

  const close = useCallback(() => {
    setPhase((p) => (p === "enter" || p === "open" ? "exit" : p));
  }, []);

  const toggle = () => {
    if (open) {
      close();
      return;
    }
    setHero(tileRef.current?.closest("section") ?? null);
    setPhase("enter");
  };

  // Entering: grow the panel out of the tile. Its origin is the tile's
  // centre, read once the panel is laid out and before it is painted.
  useLayoutEffect(() => {
    if (phase !== "enter") return;
    const panel = panelRef.current;
    const tile = tileRef.current;
    if (!panel || !tile) return;
    const p = panel.getBoundingClientRect();
    const t = tile.getBoundingClientRect();
    panel.style.setProperty("--ox", `${t.left + t.width / 2 - p.left}px`);
    panel.style.setProperty("--oy", `${t.top + t.height / 2 - p.top}px`);
    panel.focus({ preventScroll: true });
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setPhase((current) => (current === "enter" ? "open" : current)));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [phase]);

  // Leaving: when the panel has gone, unmount it and hand focus back.
  useEffect(() => {
    if (phase !== "exit") return;
    const timer = window.setTimeout(() => {
      setPhase("closed");
      tileRef.current?.focus({ preventScroll: true });
    }, CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // Escape closes it, wherever focus is.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Back on a wider screen there is no folder.
  useEffect(() => {
    const list = window.matchMedia("(max-width: 700px)");
    const onChange = () => {
      if (!list.matches) setPhase("closed");
    };
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, []);

  // Tab stays in the panel while it is open.
  const trap = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const links = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("a[href]"));
    if (links.length === 0) return;
    const first = links[0];
    const last = links[links.length - 1];
    const at = document.activeElement;
    if (e.shiftKey && (at === first || at === e.currentTarget)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && at === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // A tap where the tile is (on the panel, and not on a link) is the tile's:
  // it closes the folder.
  const tapTile = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("a")) return;
    const t = tileRef.current?.getBoundingClientRect();
    if (t && e.clientX >= t.left && e.clientX <= t.right && e.clientY >= t.top && e.clientY <= t.bottom) close();
  };

  return { tileRef, panelRef, phase, hero, id, open, toggle, close, trap, tapTile };
}
