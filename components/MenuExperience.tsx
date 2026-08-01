"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Menu, MenuItem } from "@/lib/menu";
import {
  buildPages,
  categoryIdAtPage,
  itemsPerRowFor,
  pageIndexOfCategory,
} from "@/lib/layout";
import { mediaUrl } from "@/lib/config";
import { useCartActions } from "@/lib/cart";
import { useIsPortrait } from "@/lib/useViewport";
import type { FlipbookHandle } from "@/components/FlipbookViewer";
import FlipbookViewer from "@/components/FlipbookViewer";
import CategoryModal from "@/components/CategoryModal";
import SearchOverlay from "@/components/SearchOverlay";
import ListView from "@/components/ListView";
import ItemPopup from "@/components/ItemPopup";
import MediaLightbox from "@/components/MediaLightbox";
import CartUI from "@/components/CartUI";
import ViewSkeleton from "@/components/ViewSkeleton";

type ViewMode = "flip" | "list";

/** Keep the skeleton up at least this long so a fast switch doesn't flash. */
const MIN_SKELETON_MS = 320;
/** Give up waiting on the flipbook after this and show it regardless. */
const SKELETON_TIMEOUT_MS = 2500;

export default function MenuExperience({ menu }: { menu: Menu }) {
  const { add } = useCartActions();
  const portrait = useIsPortrait();
  const [view, setView] = useState<ViewMode>("flip");
  const [popupItem, setPopupItem] = useState<MenuItem | null>(null);
  const [mediaItem, setMediaItem] = useState<MenuItem | null>(null);
  const [skeleton, setSkeleton] = useState<"on" | "fading" | "off">("on");
  const [catOpen, setCatOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const bookRef = useRef<FlipbookHandle>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const bootStartedAt = useRef(0);
  const skeletonDone = useRef(false);
  const timers = useRef<number[]>([]);

  const sym = menu.restaurant.currencySymbol;

  const pages = useMemo(
    () => buildPages(menu, { itemsPerRow: itemsPerRowFor(portrait) }),
    [menu, portrait],
  );

  // ---- Categories ----
  // Every category owns exactly one page, so the picker is just the book's
  // section pages in order — empty categories never made a page to begin with.
  const entries = useMemo(
    () =>
      pages.flatMap((p) =>
        p.kind === "section"
          ? [{ category: p.category, count: p.itemCount }]
          : [],
      ),
    [pages],
  );

  /** Jump to a category: turn the book to its page, or scroll the list to it. */
  const goToCategory = useCallback(
    (categoryId: string) => {
      setActiveCategoryId(categoryId);

      if (view === "flip") {
        const index = pageIndexOfCategory(pages, categoryId);
        if (index >= 0) bookRef.current?.goToPage(index);
        return;
      }

      const container = listRef.current;
      const target = Array.from(
        container?.querySelectorAll<HTMLElement>("[data-cat-id]") ?? [],
      ).find((el) => el.dataset.catId === categoryId);
      if (!container || !target) return;
      container.scrollTo({
        top:
          container.scrollTop +
          target.getBoundingClientRect().top -
          container.getBoundingClientRect().top,
        behavior: "smooth",
      });
    },
    [pages, view],
  );

  // In the book, the visible page *is* the category. A landscape spread shows
  // two, and its left one can be the cover or the blank filler — so fall
  // through to the right page there, but never on a phone's single page.
  const handlePageChange = useCallback(
    (index: number) =>
      setActiveCategoryId(
        categoryIdAtPage(pages, index) ??
          (portrait ? null : categoryIdAtPage(pages, index + 1)),
      ),
    [pages, portrait],
  );

  // In the list, whichever section heading has passed the top of the viewport.
  useEffect(() => {
    if (view !== "list") return;
    const container = listRef.current;
    if (!container) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const top = container.getBoundingClientRect().top;
      let seen: string | null = null;
      for (const el of Array.from(
        container.querySelectorAll<HTMLElement>("[data-cat-id]"),
      )) {
        if (el.getBoundingClientRect().top - top > 8) break;
        seen = el.dataset.catId ?? null;
      }
      setActiveCategoryId(seen ?? entries[0]?.category.id ?? null);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [view, entries]);

  // ---- View-switch skeleton ----
  // Swapping views tears down one tree and mounts another; the flipbook in
  // particular loads react-pageflip client-side and only settles once its stage
  // is measured, which reads as a broken half-drawn book. Cover that with a
  // placeholder until the incoming view says it's ready.
  const endSkeleton = useCallback(() => {
    if (skeletonDone.current) return;
    skeletonDone.current = true;
    const wait = Math.max(
      0,
      MIN_SKELETON_MS - (performance.now() - bootStartedAt.current),
    );
    timers.current.push(
      window.setTimeout(() => {
        setSkeleton("fading");
        timers.current.push(window.setTimeout(() => setSkeleton("off"), 300));
      }, wait),
    );
  }, []);

  useEffect(() => {
    const pending = timers.current;
    bootStartedAt.current = performance.now();
    skeletonDone.current = false;
    setSkeleton("on");
    // The list renders synchronously, so it only owes the minimum beat; the
    // flipbook reports back through onReady (with a timeout as a safety net).
    if (view === "list") endSkeleton();
    else pending.push(window.setTimeout(endSkeleton, SKELETON_TIMEOUT_MS));
    return () => {
      pending.forEach(clearTimeout);
      timers.current = [];
    };
  }, [view, endSkeleton]);

  // Stable for the life of the page. These reach the flipbook's page elements,
  // and react-pageflip rebuilds the book's DOM whenever those elements change
  // identity — so a new handler object on every render would tear the book down
  // mid-flip. `add` comes from the actions context precisely because it doesn't
  // change when the cart does. See components/FlipbookViewer.tsx#bookPages.
  /** Any sheet that takes over the screen — and with it, the keyboard. */
  const overlayOpen =
    searchOpen || catOpen || cartOpen || !!popupItem || !!mediaItem;

  const handlers = useMemo(
    () => ({
      onSelect: (item: MenuItem) => setPopupItem(item),
      onMedia: (item: MenuItem) => setMediaItem(item),
      onAdd: (item: MenuItem) => add(item, 1),
    }),
    [add],
  );

  return (
    // --main-color carries the restaurant's theme highlight colour to every
    // accented control below (cards, headings, cart) without prop-drilling it.
    // It also drives the `highlightColor` Tailwind token, so `bg-highlightColor`
    // and friends follow each restaurant's brand automatically.
    <div
      className="flex h-[100dvh] w-full flex-col bg-neutral-200 font-titleFont"
      style={
        {
          "--main-color":
            menu.restaurant.highlightColor ||
            menu.restaurant.brandColor ||
            "#f36805",
        } as React.CSSProperties
      }
    >
      {/* Header */}
      <header className="z-30 flex items-center justify-between gap-2 border-b border-neutral-200 bg-white px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {menu.restaurant.logoUrl ? (
            // Wordmark logos are wide — let it keep its aspect instead of
            // squashing it into a square.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaUrl(menu.restaurant.logoUrl)}
              alt=""
              className="h-8 w-auto max-w-[130px] flex-shrink-0 object-contain object-left"
            />
          ) : (
            <span
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-white"
              style={{
                background:
                  menu.restaurant.brandColor || "var(--main-color, #f36805)",
              }}
            >
              🍽
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-titleFont text-sm font-semibold text-titleColor">
              {menu.restaurant.name}
            </p>
            {menu.table && (
              <p className="truncate font-descriptionFont text-xs text-disableTextColor">
                {menu.table.name || `Table ${menu.table.id}`}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          {/* Search — the only practical way through a 600-dish menu */}
          <button
            onClick={() => setSearchOpen(true)}
            aria-label="Search the menu"
            aria-haspopup="dialog"
            title="Search"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 bg-white text-titleColor shadow-sm transition hover:bg-neutral-100 active:scale-95"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </button>

          {/* Categories — the menu's table of contents */}
          <button
            onClick={() => setCatOpen(true)}
            aria-label="Browse categories"
            aria-haspopup="dialog"
            title="Categories"
            disabled={entries.length === 0}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 bg-white text-titleColor shadow-sm transition hover:bg-neutral-100 active:scale-95 disabled:opacity-40"
          >
            {/* category icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 16 16"
              width="20"
              height="20"
              className="c-pieIcon c-pieIcon--list"
            >
              <path d="M2.313 11.938a1.312 1.312 0 1 0 0-2.625 1.312 1.312 0 0 0 0 2.624Z"></path>
              <path d="M14.125 4.719h-8.75V6.03h8.348l.402-1.312Z"></path>
              <path d="M2.313 6.688a1.313 1.313 0 1 0 0-2.626 1.313 1.313 0 0 0 0 2.625Z"></path>
              <path d="M12.506 9.969H5.375v1.312h6.729l.402-1.312Z"></path>
            </svg>
          </button>

          {/* View toggle — icon only, showing the view it switches *to* */}
          <button
            onClick={() => setView(view === "flip" ? "list" : "flip")}
            aria-label={
              view === "flip"
                ? "Switch to list view"
                : "Switch to flipbook view"
            }
            title={view === "flip" ? "List view" : "Flipbook view"}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white shadow-sm transition active:scale-95"
            style={{ background: "var(--main-color, #f36805)" }}
          >
            {view === "flip" ? (
              // List icon
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
              </svg>
            ) : (
              // Open book icon
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M12 6.5C10.5 5.2 8.4 4.5 6 4.5H3v14h3c2.4 0 4.5.7 6 2 1.5-1.3 3.6-2 6-2h3v-14h-3c-2.4 0-4.5.7-6 2z" />
                <path d="M12 6.5v14" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Body */}
      <main className="relative flex-1 overflow-hidden">
        {view === "flip" ? (
          <FlipbookViewer
            ref={bookRef}
            pages={pages}
            currencySymbol={sym}
            onReady={endSkeleton}
            onPageChange={handlePageChange}
            // An overlay owns the keyboard while it is open — otherwise the
            // arrow keys that move the caret in the search box also turn pages
            // in the book behind it.
            keyboardNav={!overlayOpen}
            {...handlers}
          />
        ) : (
          <div ref={listRef} className="h-full overflow-y-auto">
            <ListView menu={menu} {...handlers} />
          </div>
        )}

        {skeleton !== "off" && (
          <div
            aria-hidden
            className={`absolute inset-0 z-20 overflow-hidden bg-neutral-200 transition-opacity duration-300 ${
              skeleton === "on"
                ? "opacity-100"
                : "pointer-events-none opacity-0"
            }`}
          >
            <ViewSkeleton
              mode={view}
              portrait={portrait}
              restaurant={menu.restaurant}
            />
          </div>
        )}
      </main>

      {/* Overlays */}
      <SearchOverlay
        open={searchOpen}
        menu={menu}
        onClose={() => setSearchOpen(false)}
        onGoToCategory={goToCategory}
        escapeEnabled={!popupItem && !mediaItem}
        {...handlers}
      />
      <CategoryModal
        open={catOpen}
        entries={entries}
        activeCategoryId={activeCategoryId}
        onSelect={goToCategory}
        onClose={() => setCatOpen(false)}
      />
      {popupItem && (
        <ItemPopup
          item={popupItem}
          currencySymbol={sym}
          onClose={() => setPopupItem(null)}
          onAdd={(item, qty) => {
            add(item, qty);
            setPopupItem(null);
          }}
          onMedia={(item) => {
            setPopupItem(null);
            setMediaItem(item);
          }}
        />
      )}
      {mediaItem && (
        <MediaLightbox item={mediaItem} onClose={() => setMediaItem(null)} />
      )}

      <CartUI
        restaurant={menu.restaurant}
        table={menu.table}
        onOpenChange={setCartOpen}
      />
    </div>
  );
}
