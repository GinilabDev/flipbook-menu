"use client";

import { useEffect, useMemo, useState } from "react";
import type { Menu, MenuItem } from "@/lib/menu";
import { buildPages, itemsPerRowFor } from "@/lib/layout";
import { mediaUrl } from "@/lib/config";
import { useCart } from "@/lib/cart";
import FlipbookViewer from "@/components/FlipbookViewer";
import ListView from "@/components/ListView";
import ItemPopup from "@/components/ItemPopup";
import MediaLightbox from "@/components/MediaLightbox";
import CartUI from "@/components/CartUI";

type ViewMode = "flip" | "list";

export default function MenuExperience({ menu }: { menu: Menu }) {
  const { add, qtyOf } = useCart();
  const [portrait, setPortrait] = useState(false);
  const [view, setView] = useState<ViewMode>("flip");
  const [popupItem, setPopupItem] = useState<MenuItem | null>(null);
  const [mediaItem, setMediaItem] = useState<MenuItem | null>(null);

  const sym = menu.restaurant.currencySymbol;

  // Phones show one page at a time, so cards go one-up there. Keep this
  // breakpoint in step with FlipbookViewer's.
  useEffect(() => {
    const check = () => setPortrait(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const pages = useMemo(
    () => buildPages(menu, { itemsPerRow: itemsPerRowFor(portrait) }),
    [menu, portrait],
  );

  const handlers = {
    qtyOf,
    onSelect: (item: MenuItem) => setPopupItem(item),
    onMedia: (item: MenuItem) => setMediaItem(item),
    onAdd: (item: MenuItem) => add(item, 1),
  };

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
            menu.restaurant.highlightColor || menu.restaurant.brandColor || "#f36805",
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
              style={{ background: menu.restaurant.brandColor || "var(--main-color, #f36805)" }}
            >
              🍽
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-titleFont text-sm font-semibold text-titleColor">{menu.restaurant.name}</p>
            {menu.table && (
              <p className="truncate font-descriptionFont text-xs text-disableTextColor">{menu.table.name || `Table ${menu.table.id}`}</p>
            )}
          </div>
        </div>

        {/* View toggle */}
        <div className="flex flex-shrink-0 items-center rounded-lg bg-neutral-100 p-0.5 text-sm">
          <button
            onClick={() => setView("flip")}
            className={`rounded-md px-3 py-1 transition ${view === "flip" ? "bg-white font-medium text-titleColor shadow-sm" : "text-disableTextColor"}`}
          >
            📖 Flipbook
          </button>
          <button
            onClick={() => setView("list")}
            className={`rounded-md px-3 py-1 transition ${view === "list" ? "bg-white font-medium text-titleColor shadow-sm" : "text-disableTextColor"}`}
          >
            ☰ List
          </button>
        </div>
      </header>

      {/* Body */}
      <main className="relative flex-1 overflow-hidden">
        {view === "flip" ? (
          <FlipbookViewer pages={pages} currencySymbol={sym} {...handlers} />
        ) : (
          <div className="h-full overflow-y-auto">
            <ListView menu={menu} {...handlers} />
          </div>
        )}
      </main>

      {/* Overlays */}
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
      {mediaItem && <MediaLightbox item={mediaItem} onClose={() => setMediaItem(null)} />}

      <CartUI restaurant={menu.restaurant} table={menu.table} />
    </div>
  );
}
