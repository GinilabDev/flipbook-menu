"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import type { RenderedPage } from "@/lib/pdf";

// react-pageflip touches `window` on import → load client-side only.
const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false });

interface FlipbookViewerProps {
  pages: RenderedPage[];
  aspect: number;
  title?: string;
  file?: File | null;
  onReset: () => void;
}

/** A single flippable page. react-pageflip requires each page to forward its ref. */
const Page = forwardRef<
  HTMLDivElement,
  { src: string; number: number; side: "left" | "right" }
>(({ src, number, side }, ref) => (
  <div className={`flip-page flip-page--${side}`} ref={ref}>
    <img src={src} alt={`Page ${number}`} draggable={false} />
  </div>
));
Page.displayName = "Page";

export default function FlipbookViewer({
  pages,
  aspect,
  title,
  file,
  onReset,
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
  const [dims, setDims] = useState({ width: 460, height: 650 });

  const total = pages.length;
  const onCover = current <= 0;

  // Single-page (portrait) only on narrow screens; desktop always shows a spread.
  useEffect(() => {
    const check = () => setPortrait(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ---- Book sizing (fits the stage, keeps page aspect ratio) ----
  const recomputeSize = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const padX = portrait ? 40 : 140; // leave room for the corner arrows on desktop
    const padY = 96;
    const availW = stage.clientWidth - padX;
    const availH = stage.clientHeight - padY;

    // Landscape shows two pages side-by-side → total width is 2 * pageWidth.
    const perRow = portrait ? 1 : 2;
    let pageH = availH;
    let pageW = pageH * aspect;
    if (pageW * perRow > availW) {
      pageW = availW / perRow;
      pageH = pageW / aspect;
    }
    // Keep the book a touch smaller than the available area for a nicer margin.
    const factor = 0.82;
    setDims({
      width: Math.max(180, Math.floor(pageW * factor)),
      height: Math.max(250, Math.floor(pageH * factor)),
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

  // ---- Page-flip sound (plays public/flipBook.mp3) ----
  const playFlipSound = useCallback(() => {
    if (!soundOn || typeof window === "undefined") return;
    try {
      const audio = (flipAudioRef.current ||= new Audio("/flipBook.mp3"));
      audio.currentTime = 0;
      audio.volume = 0.6;
      void audio.play().catch(() => {});
    } catch {
      /* audio unavailable — ignore */
    }
  }, [soundOn]);

  const onFlip = useCallback(
    (e: { data: number }) => {
      setCurrent(e.data);
      playFlipSound();
    },
    [playFlipSound],
  );

  // ---- Zoom ----
  const zoomIn = () => setZoom((z) => Math.min(2.5, +(z + 0.25).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)));

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

  // ---- Download original PDF ----
  const download = () => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name || "document.pdf";
    a.click();
    URL.revokeObjectURL(url);
  };

  const counter = useMemo(() => {
    const label =
      current <= 0
        ? `1 / ${total}`
        : `${current + 1}${
            current + 1 < total ? `-${Math.min(current + 2, total)}` : ""
          } / ${total}`;
    return label;
  }, [current, total]);

  return (
    <div
      ref={rootRef}
      className="relative flex h-[100dvh] w-full flex-col bg-gradient-to-b from-neutral-100 to-neutral-200"
    >
      {/* Back to upload */}
      <button
        onClick={onReset}
        className="absolute left-4 top-4 z-30 flex items-center gap-1.5 rounded-xl bg-white/90 px-3 py-2 text-sm font-medium text-slate-700 shadow-md shadow-slate-900/5 backdrop-blur transition hover:bg-white"
      >
        <span className="text-base leading-none">←</span> New PDF
      </button>

      {/* Top-right toolbar */}
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
        <ToolButton label="Download PDF" onClick={download} disabled={!file}>
          <IconDownload />
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
          {/* book-sized wrapper so the arrows can anchor to the page corners */}
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
              minWidth={200}
              maxWidth={1400}
              minHeight={280}
              maxHeight={1900}
              drawShadow
              maxShadowOpacity={0.35}
              showCover
              flippingTime={900}
              showPageCorners
              useMouseEvents
              clickEventForward
              swipeDistance={20}
              usePortrait={portrait}
              mobileScrollSupport
              // className={`shadow-book ${onCover ? "book--cover" : ""}`}
              onFlip={onFlip}
            >
              {pages.map((p, i) => (
                <Page
                  key={i}
                  src={p.src}
                  number={i + 1}
                  side={i % 2 === 0 ? "right" : "left"}
                />
              ))}
            </HTMLFlipBook>

            {/* Page-change buttons centred on the book's bottom outer corners */}
            <button
              onClick={flipPrev}
              aria-label="Previous page"
              style={{ transform: `translate(-45%, 30%) scale(${1 / zoom})` }}
              className={`group absolute bottom-0 -left-7 z-20 transition ${
                onCover ? "pointer-events-none opacity-0" : "opacity-100"
              }`}
            >
              <span className="hz-arrow" />
            </button>
            <button
              onClick={flipNext}
              disabled={current >= total - 1}
              aria-label="Next page"
              style={{ transform: `translate(45%, 30%) scale(${1 / zoom})` }}
              className={`group absolute bottom-0 -right-7 z-20 transition ${current >= total - 1 ? "pointer-events-none opacity-0" : "opacity-100"} `}
            >
              <span className="hz-arrow hz-arrow--flip" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom-center controls: zoom + page counter */}
      <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 -translate-x-1/2">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-white/90 px-2 py-1.5 text-slate-600 shadow-md shadow-slate-900/5 backdrop-blur">
          <MiniButton onClick={zoomOut} label="Zoom out" disabled={zoom <= 1}>
            −
          </MiniButton>
          <span className="w-10 text-center text-xs tabular-nums text-slate-500">
            {Math.round(zoom * 100)}%
          </span>
          <MiniButton onClick={zoomIn} label="Zoom in" disabled={zoom >= 2.5}>
            +
          </MiniButton>
          <div className="mx-1 h-4 w-px bg-slate-200" />
          <span className="px-2 text-xs font-medium tabular-nums text-slate-600">
            {counter}
          </span>
        </div>
      </div>

      {title && (
        <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 truncate text-[11px] text-slate-400">
          {title}
        </span>
      )}
    </div>
  );
}

/* ---------- small UI pieces ---------- */

function ToolButton({
  children,
  onClick,
  label,
  disabled,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-md shadow-slate-900/5 backdrop-blur transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "bg-indigo-500 text-white hover:bg-indigo-600"
          : "bg-white/90 text-slate-600 hover:bg-white hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

function MiniButton({
  children,
  onClick,
  label,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className="flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
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

const IconDownload = () => (
  <svg {...iconProps}>
    <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
);
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
