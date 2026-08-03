"use client";

import { useSyncExternalStore } from "react";
import { itemsPerRowFor } from "@/lib/layout";

/**
 * The narrowest screen that may be given a two-page spread.
 *
 * Width alone cannot decide this, which is what the old `PORTRAIT_BREAKPOINT`
 * got wrong: a tablet held upright clears 768 exactly, so it was handed a
 * spread of two 384px pages — each one *narrower than a phone's single page* —
 * and then two cards were packed into that, leaving about twenty pixels for a
 * dish name. See `computeLayout` for what actually decides it.
 */
export const SPREAD_MIN_WIDTH = 768;

/**
 * The app chrome standing above the book. Used only to estimate the stage's
 * height before it exists, because cards-per-row depends on it (a short screen
 * draws the page at a smaller scale, which makes it wider in design px). The
 * real measurement still drives the drawing — see FlipbookViewer#recomputeSize.
 */
const HEADER_HEIGHT = 61;

export interface BookLayout {
  /** One page per turn, rather than a two-page spread. */
  singlePage: boolean;
  /** Item cards per row on a section page. */
  itemsPerRow: number;
}

/** The server has no viewport to ask; the spread is the safe default. */
const SERVER_LAYOUT: BookLayout = { singlePage: false, itemsPerRow: 2 };

/**
 * How the book should be laid out on a screen of this size.
 *
 * ORIENTATION decides the spread, not width. A spread wants a landscape window:
 * two pages side by side in a portrait one are two tall slivers, whatever the
 * device is called. So a tablet held upright reads one category per turn —
 * like a phone, but on a page wide enough to carry two cards — and the same
 * tablet turned on its side gets the real book, two categories at a time.
 *
 * Cards per row then follows from how wide that page actually comes out, so the
 * two answers can never disagree: a page is only given two-up cards when it has
 * the room the card was designed for.
 */
function computeLayout(width: number, height: number): BookLayout {
  const singlePage = width < SPREAD_MIN_WIDTH || height >= width;
  return {
    singlePage,
    itemsPerRow: itemsPerRowFor(
      width / (singlePage ? 1 : 2),
      Math.max(1, height - HEADER_HEIGHT),
    ),
  };
}

/**
 * One resize listener for the whole app, shared through `useSyncExternalStore`.
 *
 * Two components used to keep their own listener and their own copy of this
 * answer. Besides doing the work twice, it meant they could disagree for a
 * frame — and a viewer showing one page while the layout engine packed rows for
 * two is a broken book.
 *
 * What is published is the *derived* layout, never the raw size. A phone's
 * address bar sliding away changes the height by 60px on every scroll, and
 * republishing that would re-flow every page in the book for a change that
 * moves neither of the two numbers anything depends on. Reads are also settled
 * on the next frame, so a rotation's burst of events costs one recompute.
 */
const listeners = new Set<() => void>();
let snapshot: BookLayout = SERVER_LAYOUT;
let frame = 0;
let attached = false;

function measure() {
  const next = computeLayout(window.innerWidth, window.innerHeight);
  if (
    next.singlePage === snapshot.singlePage &&
    next.itemsPerRow === snapshot.itemsPerRow
  ) {
    return;
  }
  snapshot = next;
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
    snapshot = computeLayout(window.innerWidth, window.innerHeight);
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("orientationchange", onResize);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** How the book is laid out right now: one page or two, and cards per row. */
export function useBookLayout(): BookLayout {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => SERVER_LAYOUT,
  );
}

/** True when the book shows a single page rather than a spread. */
export function useIsSinglePage(): boolean {
  return useBookLayout().singlePage;
}
