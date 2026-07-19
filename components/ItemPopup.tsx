"use client";

import { useState } from "react";
import { mediaUrl } from "@/lib/config";
import type { MenuItem } from "@/lib/menu";
import { effectivePrice, formatPrice, hasDiscount, hasMedia } from "@/lib/menu";
import { flyToCart } from "@/lib/flyToCart";

interface ItemPopupProps {
  item: MenuItem;
  currencySymbol: string;
  onClose: () => void;
  onAdd: (item: MenuItem, qty: number) => void;
  onMedia: (item: MenuItem) => void;
}

/** Detail + quantity picker shown when an item card is tapped. */
export default function ItemPopup({
  item,
  currencySymbol,
  onClose,
  onAdd,
  onMedia,
}: ItemPopupProps) {
  const [qty, setQty] = useState(1);
  const price = effectivePrice(item);
  const thumb = item.media?.find((m) => m.type === "image");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-t-2xl bg-white p-5 text-titleColor shadow-2xl sm:rounded-2xl">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-disableTextColor hover:bg-neutral-100"
        >
          ✕
        </button>

        {thumb && (
          <div
            className="mb-3 -mx-5 -mt-5 h-40 cursor-pointer overflow-hidden rounded-t-2xl bg-neutral-100"
            onClick={() => hasMedia(item) && onMedia(item)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaUrl(thumb.url)} alt={item.name} className="h-full w-full object-cover" />
          </div>
        )}

        <h3 className="pr-8 font-titleFont text-lg font-semibold">{item.name}</h3>
        {(item.longDesc || item.shortDesc) && (
          <p className="mt-1 font-descriptionFont text-sm text-descriptionColor">
            {item.longDesc || item.shortDesc}
          </p>
        )}

        <div className="mt-2 flex items-center gap-2">
          <span className="font-titleFont text-xl font-bold text-highlightColor">
            {formatPrice(currencySymbol, price)}
          </span>
          {hasDiscount(item) && (
            <span className="font-titleFont text-sm text-disableTextColor line-through">
              {formatPrice(currencySymbol, item.price)}
            </span>
          )}
          {hasMedia(item) && (
            <button
              onClick={() => onMedia(item)}
              className="ml-auto rounded-full bg-neutral-100 px-3 py-1 font-descriptionFont text-xs text-titleColor hover:bg-neutral-200"
            >
              {item.media?.some((m) => m.type === "video") ? "▶ Video" : "📷 Photos"}
            </button>
          )}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-neutral-200 bg-neutral-100">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="flex h-10 w-10 items-center justify-center rounded-l-lg text-xl text-titleColor hover:bg-neutral-200"
            >
              −
            </button>
            <span className="w-8 text-center font-titleFont tabular-nums text-titleColor">
              {qty}
            </span>
            <button
              onClick={() => setQty((q) => q + 1)}
              className="flex h-10 w-10 items-center justify-center rounded-r-lg text-xl text-titleColor hover:bg-neutral-200"
            >
              +
            </button>
          </div>
          <button
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              flyToCart({
                x: r.left + r.width / 2,
                y: r.top + r.height / 2,
                label: item.name,
              });
              onAdd(item, qty);
            }}
            className="flex-1 rounded-xl bg-highlightColor py-3 font-titleFont font-medium text-white transition hover:opacity-90"
          >
            Add · {formatPrice(currencySymbol, price * qty)}
          </button>
        </div>
      </div>
    </div>
  );
}
