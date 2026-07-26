"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import type { LayoutPage } from "@/lib/layout";
import { PAGE_H } from "@/lib/layout";
import type { MenuItem } from "@/lib/menu";
import MenuPage from "@/components/MenuPage";

// react-pageflip touches `window` on import → load client-side only.
const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false });

interface FlipbookViewerProps {
  pages: LayoutPage[];
  currencySymbol: string;
  qtyOf: (itemId: string) => number;
  onSelect: (item: MenuItem) => void;
  onMedia: (item: MenuItem) => void;
  onAdd: (item: MenuItem) => void;
  /** Fired once the stage has been measured and the book is at its real size. */
  onReady?: () => void;
  /** Fired whenever the visible page changes — drives the category picker. */
  onPageChange?: (index: number) => void;
}

/** Imperative controls the parent needs — jumping to a category's page. */
export interface FlipbookHandle {
  goToPage: (index: number) => void;
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
    qtyOf,
    onSelect,
    onMedia,
    onAdd,
    onReady,
    onPageChange,
  },
  ref,
) {
  const bookRef = useRef<any>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const flipAudioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState(0);
  // Where the book *will* be once the turn in flight finishes. The book's own
  // page event only fires when the flip lands, which is far too late to start
  // sliding the closed book open — the slide has to run alongside the turn.
  const [settling, setSettling] = useState(0);
  const [portrait, setPortrait] = useState(false);
  const [dims, setDims] = useState({ width: 380, height: 528 });
  const [measured, setMeasured] = useState(false);

  const total = pages.length;
  const onCover = current <= 0;

  useEffect(() => {
    const check = () => setPortrait(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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

  // ---- Navigation ----
  // A spread covers two pages, so a turn moves the left-hand index by two —
  // except off the cover and onto the back cover, which stand alone.
  const flipNext = useCallback(() => {
    setSettling(current === 0 ? 1 : Math.min(total - 1, current + 2));
    bookRef.current?.pageFlip()?.flipNext();
  }, [current, total]);
  const flipPrev = useCallback(() => {
    setSettling(current <= 1 ? 0 : Math.max(0, current - 2));
    bookRef.current?.pageFlip()?.flipPrev();
  }, [current]);

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
        const landed = pf.getCurrentPageIndex?.() ?? index;
        setCurrent(landed);
        setSettling(landed);
        onPageChange?.(index);
      },
    }),
    [onPageChange],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") flipNext();
      else if (e.key === "ArrowLeft") flipPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipNext, flipPrev]);

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

  const onFlip = useCallback(
    (e: { data: number }) => {
      setCurrent(e.data);
      setSettling(e.data);
      onPageChange?.(e.data);
      playFlipSound();
    },
    [onPageChange, playFlipSound],
  );

  // A page fills the screen, so its shape is the viewport's, not a fixed
  // rectangle. Type is scaled off the page HEIGHT — scaling off the width would
  // blow the text up to poster size on a wide desktop — which leaves the design
  // WIDTH as the variable: a taller-than-wide phone page stays narrow, a wide
  // desktop page simply has more room per column.
  const scale = dims.height / PAGE_H;
  const designWidth = Math.round(dims.width / scale);

  // A closed book is one page wide, not two — so on a spread the covers sit
  // centred on screen and the book slides out from under them as it opens.
  // Driven by `settling` rather than `current` so the slide runs *with* the
  // page turn instead of snapping into place after it.
  const offset = portrait
    ? 0
    : settling <= 0
      ? -dims.width / 2 // front cover: the lone right-hand page
      : settling >= total - 1
        ? dims.width / 2 // back cover: the lone left-hand page
        : 0;

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
            className="relative transition-transform duration-700 ease-in-out"
            style={{
              width: (portrait ? 1 : 2) * dims.width,
              height: dims.height,
              transform: `translateX(${offset}px)`,
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
              {pages.map((p, i) => (
                // The spine shadow marks the page's inner edge. On a spread
                // that alternates — left page, right page. A phone shows one
                // page at a time with the spine always down its left side, so
                // every page there is a "right" page; alternating would flip
                // the shadow to the outer edge on every other turn.
                <Page
                  key={p.key}
                  side={portrait || i % 2 === 0 ? "right" : "left"}
                >
                  {/* Pages are authored PAGE_H tall in design px and scaled to
                      the book, so type keeps its proportions at any size. */}
                  <div
                    style={{
                      width: designWidth,
                      height: PAGE_H,
                      transform: `scale(${scale})`,
                      transformOrigin: "top left",
                    }}
                  >
                    <MenuPage
                      page={p}
                      width={designWidth}
                      currencySymbol={currencySymbol}
                      qtyOf={qtyOf}
                      onSelect={onSelect}
                      onMedia={onMedia}
                      onAdd={onAdd}
                    />
                  </div>
                </Page>
              ))}
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
