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
import type { Hotspot, MenuItem } from "@/lib/menu";
import { useCart } from "@/lib/cart";
import CartUI from "@/components/CartUI";

// react-pageflip touches `window` on import → load client-side only.
const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false });

interface FlipbookViewerProps {
  pages: RenderedPage[];
  aspect: number;
  title?: string;
  /** original PDF URL, used by the download button */
  pdfUrl?: string;
  onReset: () => void;
  /** hotspots grouped by 1-based page number */
  hotspotsByPage: Record<number, Hotspot[]>;
  itemsById: Record<string, MenuItem>;
  currencySymbol: string;
}

/** A single flippable page with its clickable item hotspots overlaid. */
const Page = forwardRef<
  HTMLDivElement,
  {
    src: string;
    number: number;
    side: "left" | "right";
    hotspots: Hotspot[];
    showHotspots: boolean;
    onSelect: (itemId: string) => void;
  }
>(({ src, number, side, hotspots, showHotspots, onSelect }, ref) => (
  <div className={`flip-page flip-page--${side}`} ref={ref}>
    <img src={src} alt={`Page ${number}`} draggable={false} />
    {/* Item hotspots — positioned as a fraction of the page box. */}
    {hotspots.map((h) => (
      <button
        key={h.id}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(h.itemId);
        }}
        aria-label="Add item to cart"
        className={`hotspot ${showHotspots ? "hotspot--visible" : ""}`}
        style={{
          left: `${h.rect.x * 100}%`,
          top: `${h.rect.y * 100}%`,
          width: `${h.rect.w * 100}%`,
          height: `${h.rect.h * 100}%`,
        }}
      />
    ))}
  </div>
));
Page.displayName = "Page";

export default function FlipbookViewer({
  pages,
  aspect,
  title,
  pdfUrl,
  onReset,
  hotspotsByPage,
  itemsById,
  currencySymbol,
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
  const [showHotspots, setShowHotspots] = useState(false);
  const [activeItem, setActiveItem] = useState<MenuItem | null>(null);

  const { add } = useCart();

  const total = pages.length;
  const onCover = current <= 0;
  const hotspotCount = useMemo(
    () => Object.values(hotspotsByPage).reduce((n, hs) => n + hs.length, 0),
    [hotspotsByPage]
  );

  const selectItem = useCallback(
    (itemId: string) => {
      const item = itemsById[itemId];
      if (item) setActiveItem(item);
    },
    [itemsById]
  );

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
      else if (e.key === "Escape") setActiveItem(null);
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
    [playFlipSound]
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

  // ---- Download / open original PDF ----
  const download = () => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `${title || "menu"}.pdf`;
    a.target = "_blank";
    a.rel = "noopener";
    a.click();
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
          label={showHotspots ? "Hide item areas" : "Show item areas"}
          onClick={() => setShowHotspots((s) => !s)}
          active={showHotspots}
        >
          <IconTag />
        </ToolButton>
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
        <ToolButton label="Download PDF" onClick={download} disabled={!pdfUrl}>
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
              showPageCorners={false}
              useMouseEvents={false}
              clickEventForward={false}
              swipeDistance={20}
              usePortrait={portrait}
              mobileScrollSupport
              onFlip={onFlip}
            >
              {pages.map((p, i) => (
                <Page
                  key={i}
                  src={p.src}
                  number={i + 1}
                  side={i % 2 === 0 ? "right" : "left"}
                  hotspots={hotspotsByPage[i + 1] ?? []}
                  showHotspots={showHotspots}
                  onSelect={selectItem}
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
          {title} · {hotspotCount} items detected
        </span>
      )}

      {/* Item popup */}
      {activeItem && (
        <ItemPopup
          item={activeItem}
          currencySymbol={currencySymbol}
          onClose={() => setActiveItem(null)}
          onAdd={(qty) => {
            add(activeItem, qty);
            setActiveItem(null);
          }}
        />
      )}

      {/* Cart */}
      <CartUI currencySymbol={currencySymbol} />
    </div>
  );
}

/* ---------- item popup ---------- */

function ItemPopup({
  item,
  currencySymbol,
  onClose,
  onAdd,
}: {
  item: MenuItem;
  currencySymbol: string;
  onClose: () => void;
  onAdd: (qty: number) => void;
}) {
  const [qty, setQty] = useState(1);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm rounded-t-2xl bg-white p-5 text-slate-800 shadow-2xl sm:rounded-2xl">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
        >
          ✕
        </button>
        <h3 className="pr-8 text-lg font-semibold">{item.name}</h3>
        {item.description && (
          <p className="mt-1 text-sm text-slate-500">{item.description}</p>
        )}
        <p className="mt-2 text-xl font-bold text-indigo-600">
          {currencySymbol}
          {item.price.toFixed(2)}
        </p>

        <div className="mt-5 flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-slate-200">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="flex h-10 w-10 items-center justify-center text-xl text-slate-600 hover:bg-slate-50"
            >
              −
            </button>
            <span className="w-8 text-center tabular-nums">{qty}</span>
            <button
              onClick={() => setQty((q) => q + 1)}
              className="flex h-10 w-10 items-center justify-center text-xl text-slate-600 hover:bg-slate-50"
            >
              +
            </button>
          </div>
          <button
            onClick={() => onAdd(qty)}
            className="flex-1 rounded-xl bg-indigo-600 py-3 font-medium text-white transition hover:bg-indigo-500"
          >
            Add · {currencySymbol}
            {(item.price * qty).toFixed(2)}
          </button>
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
const IconTag = () => (
  <svg {...iconProps}>
    <path d="M20.59 13.41 12 22l-9-9V3h10l7.59 7.59a2 2 0 0 1 0 2.82Z" />
    <circle cx="7.5" cy="7.5" r="1.5" />
  </svg>
);
