"use client";

import { mediaUrl } from "@/lib/config";
import type { MenuItem } from "@/lib/menu";
import { effectivePrice, formatPrice, hasDiscount, hasMedia } from "@/lib/menu";
import { flyToCart } from "@/lib/flyToCart";
import { FaPlus } from "react-icons/fa6";
interface ItemCardProps {
  item: MenuItem;
  currencySymbol: string;
  qty?: number;
  onSelect: (item: MenuItem) => void;
  onMedia: (item: MenuItem) => void;
  onAdd: (item: MenuItem) => void;
}

/** Shared menu-item card — used on flipbook pages and in the list view. */
export default function ItemCard({
  item,
  currencySymbol,
  qty = 0,
  onSelect,
  onMedia,
  onAdd,
}: ItemCardProps) {
  const thumb = item.media?.find((m) => m.type === "image");
  const price = effectivePrice(item);

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="group flex w-full items-stretch gap-3 rounded-xl border border-black/5 bg-white/70 p-2.5 text-left transition hover:border-black/10 hover:bg-white"
    >
      {thumb && (
        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl(thumb.thumbnail || thumb.url)}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start gap-1.5">
          <span className="truncate font-semibold text-slate-800">
            {item.name}
          </span>
          {item.hot &&
            item.hot != 0 &&
            [...Array(Number(item.hot))].map((_, index) => (
              <img
                key={index}
                src="/images/hot.png"
                alt="Hot"
                className="inline h-6  flex-shrink-0 object-contain"
              />
            ))}
          {item.nut && (
            <img
              src="/images/nut.png"
              alt="Contains nuts"
              className="ml-1 inline h-6 flex-shrink-0 object-contain"
            />
          )}
          {item.veg && (
            <img
              src="/images/veg.png"
              alt="Vegetarian"
              className="ml-1 inline h-6  flex-shrink-0 object-contain"
            />
          )}
        </div>
        {item.shortDesc && (
          <span className="mt-0.5 line-clamp-2 text-xs text-slate-500">
            {item.shortDesc}
          </span>
        )}
        <div className="mt-auto flex items-center gap-2 pt-1">
          <span className="font-semibold text-slate-900">
            {formatPrice(currencySymbol, price)}
          </span>
          {hasDiscount(item) && (
            <span className="text-xs text-slate-400 line-through">
              {formatPrice(currencySymbol, item.price)}
            </span>
          )}
          {hasMedia(item) && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="View photo / video"
              onClick={(e) => {
                e.stopPropagation();
                onMedia(item);
              }}
              className="ml-1 inline-flex h-6 items-center gap-1 rounded-full bg-slate-100 px-2 text-xs text-slate-600 hover:bg-slate-200"
            >
              {item.media?.some((m) => m.type === "video") ? "▶" : "📷"}
            </span>
          )}
        </div>
      </div>

      <span
        role="button"
        tabIndex={-1}
        aria-label={`Add ${item.name}`}
        onClick={(e) => {
          e.stopPropagation();
          const r = e.currentTarget.getBoundingClientRect();
          flyToCart({
            x: r.left + r.width / 2,
            y: r.top + r.height / 2,
            label: item.name,
          });
          onAdd(item);
        }}
        className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center self-center rounded-full border text-indigo-600 ring-indigo-600 text-lg transition"
      >
        <FaPlus className="text-base" />
        {qty > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full text-white bg-rose-500 px-1 text-[10px] font-bold">
            {qty}
          </span>
        )}
      </span>
    </button>
  );
}
