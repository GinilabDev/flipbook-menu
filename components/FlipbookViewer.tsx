"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import dynamic from "next/dynamic";
import type { LayoutPage } from "@/lib/layout";
import { PAGE_H } from "@/lib/layout";
import type { MenuItem } from "@/lib/menu";
import { useIsPortrait } from "@/lib/useViewport";
import MenuPage from "@/components/MenuPage";

// react-pageflip touches `window` on import → load client-side only.
const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false });

interface FlipbookViewerProps {
  pages: LayoutPage[];
  currencySymbol: string;
  onSelect: (item: MenuItem) => void;
  onMedia: (item: MenuItem) => void;
  onAdd: (item: MenuItem) => void;
  /** Fired once the stage has been measured and the book is at its real size. */
  onReady?: () => void;
  /** Fired whenever the visible page changes — drives the category picker. */
  onPageChange?: (index: number) => void;
  /** False while an overlay is open, so its typing doesn't turn pages. */
  keyboardNav?: boolean;
}

/** Imperative controls the parent needs — jumping to a category's page. */
export interface FlipbookHandle {
  goToPage: (index: number) => void;
}

/**
 * Which pages are close enough to the reader to be worth building.
 *
 * This cannot be a prop. The page in view changes on every turn, and handing the
 * book a freshly-built children array is precisely what makes react-pageflip
 * tear its DOM down mid-flip (see `bookPages`). So the current page is published
 * as a store instead: pages subscribe to it, the array never changes, and only
 * the two or three pages crossing the boundary re-render.
 */
interface NearStore {
  subscribe: (listener: () => void) => () => void;
  isNear: (index: number) => boolean;
  set: (current: number, settling: number, buffer: number) => void;
}

function createNearStore(): NearStore {
  const listeners = new Set<() => void>();
  let current = 0;
  let settling = 0;
  let buffer = 3;
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    isNear(index) {
      return (
        Math.abs(index - current) <= buffer || Math.abs(index - settling) <= buffer
      );
    },
    set(nextCurrent, nextSettling, nextBuffer) {
      if (
        nextCurrent === current &&
        nextSettling === settling &&
        nextBuffer === buffer
      ) {
        return;
      }
      current = nextCurrent;
      settling = nextSettling;
      buffer = nextBuffer;
      listeners.forEach((l) => l());
    },
  };
}

/** A page that builds its contents only once the reader is near it. */
function LazyPage({
  store,
  index,
  ...pageProps
}: { store: NearStore; index: number } & React.ComponentProps<typeof MenuPage>) {
  const near = useSyncExternalStore(
    store.subscribe,
    () => store.isNear(index),
    () => true,
  );
  return <MenuPage {...pageProps} deferred={!near} />;
}

/** A single flippable page wrapping a rendered MenuPage. */
const Page = forwardRef<
  HTMLDivElement,
  { side: "left" | "right"; children: React.ReactNode }
>(({ side, children }, ref) => (
  <div className={`flip-page flip-page--${side}`} ref={ref}>
    {children}
  </div>
));
Page.displayName = "Page";

const FlipbookViewer = forwardRef<FlipbookHandle, FlipbookViewerProps>(function FlipbookViewer(
  {
    pages,
    currencySymbol,
    onSelect,
    onMedia,
    onAdd,
    onReady,
    onPageChange,
    keyboardNav = true,
  },
  ref,
) {
  const bookRef = useRef<any>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const flipAudioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState(0);
  // `current` again, readable from a handler without making that handler depend
  // on it — see `slideTo` for why nothing may set state while a turn is running.
  const currentRef = useRef(0);
  // Where the book *will* sit once the turn in flight lands.
  const slideRefIdx = useRef(0);
  const portrait = useIsPortrait();
  const [dims, setDims] = useState({ width: 380, height: 528 });
  const [measured, setMeasured] = useState(false);
  const nearStore = useMemo(createNearStore, []);

  const total = pages.length;
  const onCover = current <= 0;

  // ---- Book sizing ----
  // The book IS the screen: no margin, no letterboxing. That means the page's
  // aspect is whatever the viewport gives us, so a page can't be a fixed
  // design-space rectangle any more — see `scale`/`designWidth` below.
  const recomputeSize = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const perRow = portrait ? 1 : 2;
    setDims({
      width: Math.max(240, Math.floor(stage.clientWidth / perRow)),
      height: Math.max(320, Math.floor(stage.clientHeight)),
    });
    setMeasured(true);
  }, [portrait]);

  useEffect(() => {
    recomputeSize();
    const ro = new ResizeObserver(recomputeSize);
    if (stageRef.current) ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, [recomputeSize]);

  // The book only reaches its final size after the stage is measured and
  // react-pageflip has laid the pages out — one frame later. Announcing that is
  // what lets the parent drop its skeleton without showing the resize snap.
  useEffect(() => {
    if (!measured) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => onReady?.());
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [measured, onReady]);

  // ---- Sliding the closed book ----
  // A closed book is one page wide, not two, so on a spread the covers sit
  // centred on screen and the book slides out from under them as it opens.
  const offsetFor = useCallback(
    (idx: number) => {
      if (portrait) return 0;
      if (idx <= 0) return -dims.width / 2; // front cover: lone right-hand page
      if (idx >= total - 1) return dims.width / 2; // back cover: lone left page
      return 0;
    },
    [portrait, dims.width, total],
  );

  /**
   * Slide the book to where page `idx` wants it — by writing the style, NOT by
   * setting state.
   *
   * This has to happen the moment a turn starts (the book's own page event only
   * fires when the turn lands, far too late to slide the cover open with it),
   * and a re-render at that moment is exactly what must not happen: see
   * `bookPages` below for what react-pageflip does to a turn in flight.
   */
  const slideTo = useCallback(
    (idx: number) => {
      slideRefIdx.current = idx;
      const el = slideRef.current;
      if (el) el.style.transform = `translateX(${offsetFor(idx)}px)`;
      // A turn starts here, so this is where the destination page has to be
      // told to build itself. Notifying the store re-renders only the pages
      // whose answer changed — the viewer itself does not re-render, which is
      // the whole point of writing the transform above by hand.
      nearStore.set(currentRef.current, idx, portrait ? 2 : 3);
    },
    [offsetFor, nearStore, portrait],
  );

  // Re-assert it whenever the answer changes — a resize, or a rotate. That also
  // re-states the reading position, whose runway differs between a phone and a
  // spread.
  useEffect(() => slideTo(slideRefIdx.current), [slideTo]);

  // ---- Navigation ----
  // A spread covers two pages, so a turn moves the left-hand index by two —
  // except off the cover and onto the back cover, which stand alone.
  const flipNext = useCallback(() => {
    const at = currentRef.current;
    slideTo(at === 0 ? 1 : Math.min(total - 1, at + 2));
    bookRef.current?.pageFlip()?.flipNext();
  }, [slideTo, total]);
  const flipPrev = useCallback(() => {
    const at = currentRef.current;
    slideTo(at <= 1 ? 0 : Math.max(0, at - 2));
    bookRef.current?.pageFlip()?.flipPrev();
  }, [slideTo]);

  /** The one place page position lands in React state — never mid-turn. */
  const settleAt = useCallback(
    (index: number) => {
      currentRef.current = index;
      setCurrent(index);
      slideTo(index);
    },
    [slideTo],
  );

  // A category jump moves the reader without a turn, so `slideTo` alone would
  // leave the store believing they are still where they were.
  useEffect(() => {
    nearStore.set(current, slideRefIdx.current, portrait ? 2 : 3);
  }, [nearStore, current, portrait]);

  // Jumping to a category's page.
  //
  // Deliberately `turnToPage` (an instant jump) rather than `flip` (animated):
  // page-flip's `flip` walks one spread at a time off a stale page index, so a
  // jump across the book lands a single page away from where it was asked to
  // go. `turnToPage` renders the target spread outright and always lands right.
  //
  // `turnToPage` fires the book's own page event with the LEFT page of the
  // spread it lands on, so the requested index is re-announced afterwards —
  // otherwise picking the right-hand page of a spread would highlight its
  // neighbour in the category picker.
  useImperativeHandle(
    ref,
    () => ({
      goToPage(index: number) {
        const pf = bookRef.current?.pageFlip?.();
        if (!pf) return;
        pf.turnToPage(index);
        settleAt(pf.getCurrentPageIndex?.() ?? index);
        onPageChange?.(index);
      },
    }),
    [onPageChange, settleAt],
  );

  useEffect(() => {
    if (!keyboardNav) return;
    const onKey = (e: KeyboardEvent) => {
      // Arrow keys belong to whatever the customer is typing in. Checked as
      // well as `keyboardNav` because any future input on the page — a table
      // note, a quantity box — would otherwise turn pages as it is filled in.
      const el = e.target as HTMLElement | null;
      if (el?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName ?? "")) {
        return;
      }
      if (e.key === "ArrowRight") flipNext();
      else if (e.key === "ArrowLeft") flipPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipNext, flipPrev, keyboardNav]);

  // ---- Flip sound ----
  const playFlipSound = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const audio = (flipAudioRef.current ||= new Audio("/flipBook.mp3"));
      audio.currentTime = 0;
      audio.volume = 0.6;
      void audio.play().catch(() => {});
    } catch {
      /* ignore */
    }
  }, []);

  // page-flip registers its 'flip' listener once, when the pages are loaded, so
  // the callback it holds must not go stale. Keep the identity fixed and read
  // the live implementation through a ref.
  const onFlipImpl = useCallback(
    (e: { data: number }) => {
      settleAt(e.data);
      onPageChange?.(e.data);
      playFlipSound();
    },
    [onPageChange, playFlipSound, settleAt],
  );
  const onFlipRef = useRef(onFlipImpl);
  onFlipRef.current = onFlipImpl;
  const onFlip = useCallback((e: { data: number }) => onFlipRef.current(e), []);

  // A page fills the screen, so its shape is the viewport's, not a fixed
  // rectangle. Type is scaled off the page HEIGHT — scaling off the width would
  // blow the text up to poster size on a wide desktop — which leaves the design
  // WIDTH as the variable: a taller-than-wide phone page stays narrow, a wide
  // desktop page simply has more room per column.
  const scale = dims.height / PAGE_H;
  const designWidth = Math.round(dims.width / scale);

  // The book's pages, built ONCE per (pages, size, handlers) — never per flip.
  //
  // react-pageflip watches `children` by identity: hand it a freshly-built array
  // and it destroys the page collection, reloads the renderer and re-shows the
  // current page (page-flip's `updateFromHtml`). Doing that while a turn is in
  // flight snaps the half-turned page back and restarts it — the cover appearing
  // to open, close, then open again. So this array must survive the state
  // changes a flip causes (`current`, `settling`) and every re-render of the
  // parent. It legitimately rebuilds when the book itself changes: new menu
  // pages, or a new size after a resize/rotate.
  //
  // Item quantities deliberately do NOT appear here — each card subscribes to
  // the cart itself (lib/cart.tsx#useItemQty), so adding an item repaints one
  // badge instead of rebuilding the whole book.
  const bookPages = useMemo(
    () =>
      pages.map((p, i) => (
        // The spine shadow marks the page's inner edge. On a spread that
        // alternates — left page, right page. A phone shows one page at a time
        // with the spine always down its left side, so every page there is a
        // "right" page; alternating would flip the shadow to the outer edge on
        // every other turn.
        <Page key={p.key} side={portrait || i % 2 === 0 ? "right" : "left"}>
          {/* Pages are authored PAGE_H tall in design px and scaled to the
              book, so type keeps its proportions at any size. */}
          <div
            style={{
              width: designWidth,
              height: PAGE_H,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <LazyPage
              store={nearStore}
              index={i}
              page={p}
              width={designWidth}
              currencySymbol={currencySymbol}
              onSelect={onSelect}
              onMedia={onMedia}
              onAdd={onAdd}
            />
          </div>
        </Page>
      )),
    [
      pages,
      portrait,
      designWidth,
      scale,
      currencySymbol,
      onSelect,
      onMedia,
      onAdd,
      nearStore,
    ],
  );

  return (
    <div className="relative flex h-full w-full flex-col bg-neutral-200">
      {/* Stage */}
      <div
        ref={stageRef}
        className="flip-stage relative flex flex-1 items-center justify-center overflow-hidden"
      >
        <div
          className={`transition-opacity duration-200 ease-out ${measured ? "opacity-100" : "opacity-0"}`}
        >
          <div
            ref={slideRef}
            className="relative transition-transform duration-700 ease-in-out"
            style={{
              width: (portrait ? 1 : 2) * dims.width,
              height: dims.height,
              // Read from the ref so a re-render mid-turn re-states where the
              // book is *going*, not where it was when the turn began.
              transform: `translateX(${offsetFor(slideRefIdx.current)}px)`,
            }}
          >
            {/* @ts-expect-error react-pageflip types are loose under dynamic import */}
            <HTMLFlipBook
              key={portrait ? "portrait" : "landscape"}
              ref={bookRef}
              width={dims.width}
              height={dims.height}
              size="fixed"
              minWidth={240}
              maxWidth={3000}
              minHeight={320}
              maxHeight={3000}
              drawShadow
              maxShadowOpacity={0.3}
              showCover
              flippingTime={800}
              showPageCorners={false}
              useMouseEvents={false}
              clickEventForward={false}
              swipeDistance={20}
              usePortrait={portrait}
              mobileScrollSupport
              onFlip={onFlip}
            >
              {bookPages}
            </HTMLFlipBook>

            {/* Heyzine-style page arrows, overlaid on the page's inner bottom
                corners. */}
            <button
              onClick={flipPrev}
              aria-label="Previous page"
              className={`group absolute bottom-2 left-2 z-20 transition sm:bottom-3 sm:left-3 ${onCover ? "pointer-events-none opacity-0" : "opacity-100"}`}
            >
              <span className="hz-arrow" />
            </button>
            <button
              onClick={flipNext}
              disabled={current >= total - 1}
              aria-label="Next page"
              className={`group absolute bottom-2 right-2 z-20 transition sm:bottom-3 sm:right-3 ${current >= total - 1 ? "pointer-events-none opacity-0" : "opacity-100"}`}
            >
              <span className="hz-arrow hz-arrow--flip" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default FlipbookViewer;
