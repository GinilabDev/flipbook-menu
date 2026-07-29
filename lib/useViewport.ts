"use client";

import { useSyncExternalStore } from "react";

/**
 * Where a page stops being half a spread and becomes the whole screen. Both the
 * layout engine (how many cards fit in a row) and the viewer (one page or two)
 * turn on this number, and they must never disagree — hence one definition.
 */
export const PORTRAIT_BREAKPOINT = 768;

/**
 * One resize listener for the whole app, shared through `useSyncExternalStore`.
 *
 * Two components used to keep their own listener and their own copy of this
 * boolean. Besides doing the work twice, it meant they could answer differently
 * for a frame — and a viewer showing one page while the layout engine packed
 * rows for two is a broken book.
 *
 * Reads are settled on the next frame rather than on every resize event: a
 * phone rotating or an address bar sliding away fires a burst of them, and each
 * one would otherwise re-flow every page in the book.
 */
let listeners = new Set<() => void>();
let portrait = false;
let frame = 0;
let attached = false;

function measure() {
  const next = window.innerWidth < PORTRAIT_BREAKPOINT;
  if (next === portrait) return;
  portrait = next;
  listeners.forEach((l) => l());
}

function onResize() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    measure();
  });
}

function subscribe(listener: () => void): () => void {
  if (!attached) {
    attached = true;
    portrait = window.innerWidth < PORTRAIT_BREAKPOINT;
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("orientationchange", onResize);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True when the screen shows a single page rather than a spread. */
export function useIsPortrait(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => portrait,
    () => false, // the server has no viewport; the spread is the safe default
  );
}
