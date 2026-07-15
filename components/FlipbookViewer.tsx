"use client";

import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { LayoutPage } from "@/lib/layout";
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
  /** page width / height ratio */
  aspect?: number;
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

export default function FlipbookViewer({
  pages,
  currencySymbol,
  qtyOf,
  onSelect,
  onMedia,
  onAdd,
  aspect = 0.72,
}: FlipbookViewerProps) {
  const bookRef = useRef<any>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const flipAudioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [portrait, setPortrait] = useState(false);
  const [dims, setDims] = useState({ width: 380, height: 528 });

  const total = pages.length;
  const onCover = current <= 0;

  useEffect(() => {
    const check = () => setPortrait(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ---- Book sizing ----
  const recomputeSize = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const padX = portrait ? 32 : 140;
    const padY = 88;
    const availW = stage.clientWidth - padX;
    const availH = stage.clientHeight - padY;
    const perRow = portrait ? 1 : 2;
    let pageH = availH;
    let pageW = pageH * aspect;
    if (pageW * perRow > availW) {
      pageW = availW / perRow;
      pageH = pageW / aspect;
    }
    setDims({
      width: Math.max(240, Math.floor(pageW)),
      height: Math.max(320, Math.floor(pageH)),
    });
  }, [aspect, portrait]);

  useEffect(() => {
    recomputeSize();
    const ro = new ResizeObserver(recomputeSize);
    if (stageRef.current) ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, [recomputeSize]);

  // ---- Navigation ----
  const flipNext = () => bookRef.current?.pageFlip()?.flipNext();
  const flipPrev = () => bookRef.current?.pageFlip()?.flipPrev();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") flipNext();
      else if (e.key === "ArrowLeft") flipPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- Flip sound ----
  const playFlipSound = useCallback(() => {
    if (!soundOn || typeof window === "undefined") return;
    try {
      const audio = (flipAudioRef.current ||= new Audio("/flipBook.mp3"));
      audio.currentTime = 0;
      audio.volume = 0.6;
      void audio.play().catch(() => {});
    } catch {
      /* ignore */
    }
  }, [soundOn]);

  const onFlip = useCallback(
    (e: { data: number }) => {
      setCurrent(e.data);
      playFlipSound();
    },
    [playFlipSound],
  );

  // ---- Fullscreen ----
  const toggleFullscreen = async () => {
    const el = rootRef.current;
    if (!el) return;
    if (!document.fullscreenElement)
      await el.requestFullscreen().catch(() => {});
    else await document.exitFullscreen().catch(() => {});
  };
  useEffect(() => {
    const onFsChange = () =>
      setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  return (
    <div
      ref={rootRef}
      className="relative flex h-full w-full flex-col bg-gradient-to-b from-neutral-100 to-neutral-200"
    >
      {/* Toolbar — top-right */}
      <div className="absolute right-4 top-4 z-30 flex items-center gap-2">
        <ToolButton
          label={soundOn ? "Mute" : "Unmute"}
          onClick={() => setSoundOn((s) => !s)}
          active={soundOn}
        >
          {soundOn ? <IconSound /> : <IconSoundOff />}
        </ToolButton>
        <ToolButton label="Fullscreen" onClick={toggleFullscreen}>
          {isFullscreen ? <IconExitFullscreen /> : <IconFullscreen />}
        </ToolButton>
      </div>

      {/* Stage */}
      <div
        ref={stageRef}
        className="flip-stage relative flex flex-1 items-center justify-center overflow-hidden"
      >
        <div
          style={{ transform: `scale(${zoom})` }}
          className="origin-center transition-transform duration-200 ease-out"
        >
          <div
            className="relative"
            style={{
              width: (portrait ? 1 : 2) * dims.width,
              height: dims.height,
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
              maxWidth={1000}
              minHeight={320}
              maxHeight={1400}
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
                <Page key={p.key} side={i % 2 === 0 ? "right" : "left"}>
                  <MenuPage
                    page={p}
                    currencySymbol={currencySymbol}
                    qtyOf={qtyOf}
                    onSelect={onSelect}
                    onMedia={onMedia}
                    onAdd={onAdd}
                  />
                </Page>
              ))}
            </HTMLFlipBook>

            {/* Heyzine-style page arrows: overlaid on the page's inner bottom
                corners (constant size regardless of zoom). */}
            <button
              onClick={flipPrev}
              aria-label="Previous page"
              style={{ transform: `scale(${1 / zoom})` }}
              className={`group absolute bottom-2 left-2 z-20 origin-bottom-left transition sm:bottom-3 sm:left-3 ${onCover ? "pointer-events-none opacity-0" : "opacity-100"}`}
            >
              <span className="hz-arrow" />
            </button>
            <button
              onClick={flipNext}
              disabled={current >= total - 1}
              aria-label="Next page"
              style={{ transform: `scale(${1 / zoom})` }}
              className={`group absolute bottom-2 right-2 z-20 origin-bottom-right transition sm:bottom-3 sm:right-3 ${current >= total - 1 ? "pointer-events-none opacity-0" : "opacity-100"}`}
            >
              <span className="hz-arrow hz-arrow--flip" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- small UI pieces ---------- */

function ToolButton({
  children,
  onClick,
  label,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-md shadow-slate-900/5 backdrop-blur transition ${
        active
          ? "bg-indigo-500 text-white hover:bg-indigo-600"
          : "bg-white/90 text-slate-600 hover:bg-white hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

/* ---------- icons ---------- */

const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const IconFullscreen = () => (
  <svg {...iconProps}>
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3" />
  </svg>
);
const IconExitFullscreen = () => (
  <svg {...iconProps}>
    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3m8 0v-3a2 2 0 0 1 2-2h3" />
  </svg>
);
const IconSound = () => (
  <svg {...iconProps}>
    <path d="M11 5 6 9H3v6h3l5 4V5Z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a9 9 0 0 1 0 12" />
  </svg>
);
const IconSoundOff = () => (
  <svg {...iconProps}>
    <path d="M11 5 6 9H3v6h3l5 4V5Z" />
    <path d="m22 9-6 6m0-6 6 6" />
  </svg>
);
