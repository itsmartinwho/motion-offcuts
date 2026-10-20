"use client";

import { useCallback, useSyncExternalStore } from "react";

/** A media query as state. False on the server and until hydration, so the
    server's markup is the desktop's; anything that must differ on a phone
    before JS runs is done in CSS instead. */
export function useMedia(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  const snapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

/** Run `fn` when the browser is idle (a timeout stands in where there is no
    requestIdleCallback — Safari). Returns its cancel. */
export function whenIdle(fn: () => void, timeout = 1500, fallbackMs = 120): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(fn, { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(fn, fallbackMs);
  return () => window.clearTimeout(id);
}
