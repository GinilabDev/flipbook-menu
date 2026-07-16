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
    // --accent carries the restaurant's theme highlight colour to every
    // accented control below (cards, headings, cart) without prop-drilling it.
    <div
      className="flex h-[100dvh] w-full flex-col bg-slate-100"
      style={{ "--accent": menu.restaurant.highlightColor || "#4f46e5" } as React.CSSProperties}
    >
      {/* Header */}
      <header className="z-30 flex items-center justify-between gap-2 border-b border-black/5 bg-white px-4 py-2.5">
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
              style={{ background: menu.restaurant.brandColor || "#111827" }}
            >
              🍽
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">{menu.restaurant.name}</p>
            {menu.table && (
              <p className="truncate text-xs text-slate-400">{menu.table.name || `Table ${menu.table.id}`}</p>
            )}
          </div>
        </div>

        {/* View toggle */}
        <div className="flex flex-shrink-0 items-center rounded-lg bg-slate-100 p-0.5 text-sm">
          <button
            onClick={() => setView("flip")}
            className={`rounded-md px-3 py-1 transition ${view === "flip" ? "bg-white font-medium text-slate-800 shadow-sm" : "text-slate-500"}`}
          >
            📖 Flipbook
          </button>
          <button
            onClick={() => setView("list")}
            className={`rounded-md px-3 py-1 transition ${view === "list" ? "bg-white font-medium text-slate-800 shadow-sm" : "text-slate-500"}`}
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
