"use client";

import { memo } from "react";
import { mediaUrl } from "@/lib/config";
import type { MenuItem } from "@/lib/menu";
import { effectivePrice, formatPrice, hasDiscount, hasMedia } from "@/lib/menu";
import { flyToCart } from "@/lib/flyToCart";
import { useItemQty } from "@/lib/cart";
import { FaPlus } from "react-icons/fa6";
interface ItemCardProps {
  item: MenuItem;
  currencySymbol: string;
  onSelect: (item: MenuItem) => void;
  onMedia: (item: MenuItem) => void;
  onAdd: (item: MenuItem) => void;
  /** "compact" = same card, sized to sit two-up on a flipbook page */
  variant?: "card" | "compact";
}

/**
 * Shared menu-item card — used on flipbook pages and in the list view.
 *
 * Memoized: its props (the item, the currency, the handlers) never change once
 * a menu is loaded, so the only thing that should ever re-render a card is its
 * own quantity changing. Everything above it — a page turn, a sheet opening, a
 * different dish being added — must leave it alone.
 */
function ItemCard({
  item,
  currencySymbol,
  onSelect,
  onMedia,
  onAdd,
  variant = "card",
}: ItemCardProps) {
  // Subscribed here rather than passed in: the badge has to update on every
  // add, and a prop would force the whole page (and the book's DOM) to rebuild
  // for it. See lib/cart.tsx#useItemQty.
  const qty = useItemQty(item.id);
  const thumb = item.media?.find((m) => m.type === "image");
  const price = effectivePrice(item);

  if (variant === "compact") {
    return (
      <CompactRow
        item={item}
        thumbUrl={thumb ? mediaUrl(thumb.thumbnail || thumb.url) : null}
        price={price}
        currencySymbol={currencySymbol}
        qty={qty}
        onSelect={onSelect}
        onMedia={onMedia}
        onAdd={onAdd}
      />
    );
  }

  return (
    // A card holds two separate actions — "tell me more" and "add one" — so it
    // cannot itself be a button with buttons inside it (invalid, and a screen
    // reader reads it as one confused control). The card is a plain box; the
    // "details" button is stretched invisibly across it, and the controls that
    // must stay clickable are lifted above it.
    <div className="group relative flex w-full items-stretch gap-3 rounded-xl border border-neutral-200 bg-white/70 p-2.5 text-left transition hover:border-neutral-300 hover:bg-white">
      <button
        type="button"
        onClick={() => onSelect(item)}
        aria-label={`${item.name}, ${formatPrice(currencySymbol, price)}. See details`}
        className="absolute inset-0 z-10 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlightColor"
      />
      {thumb && (
        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-100">
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
          <span className="truncate font-titleFont font-semibold text-titleColor">
            {item.name}
          </span>
          <CompactBadges item={item} size={22} />
        </div>
        {item.shortDesc && (
          <span className="mt-0.5 line-clamp-2 font-descriptionFont text-xs text-disableTextColor">
            {item.shortDesc}
          </span>
        )}
        <div className="mt-auto flex items-center gap-2 pt-1">
          <span className="font-titleFont font-semibold text-titleColor">
            {formatPrice(currencySymbol, price)}
          </span>
          {hasDiscount(item) && (
            <span className="font-titleFont text-xs text-disableTextColor line-through">
              {formatPrice(currencySymbol, item.price)}
            </span>
          )}
          {hasMedia(item) && (
            <button
              type="button"
              aria-label={`View ${item.media?.some((m) => m.type === "video") ? "video" : "photo"} of ${item.name}`}
              onClick={() => onMedia(item)}
              className="relative z-20 ml-1 inline-flex h-6 items-center gap-1 rounded-full bg-neutral-100 px-2 text-xs text-titleColor hover:bg-neutral-200"
            >
              {item.media?.some((m) => m.type === "video") ? "▶" : "📷"}
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        aria-label={`Add ${item.name} to your order`}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          flyToCart({
            x: r.left + r.width / 2,
            y: r.top + r.height / 2,
            label: item.name,
          });
          onAdd(item);
        }}
        className="relative z-20 flex h-9 w-9 flex-shrink-0 items-center justify-center self-center rounded-full border border-highlightColor text-lg text-highlightColor transition after:absolute after:-inset-1 after:content-['']"
      >
        <FaPlus className="text-base" />
        {qty > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-highlightColor px-1 font-titleFont text-[10px] font-bold text-white">
            {qty}
          </span>
        )}
      </button>
    </div>
  );
}

export default memo(ItemCard);

/**
 * The same card, sized to sit two-up on a flipbook page. The paddings and
 * line-heights here are what lib/layout.ts costs a card at when it fills a
 * page — change one without the other and pages over- or under-fill.
 */
function CompactRow({
  item,
  thumbUrl,
  price,
  currencySymbol,
  qty,
  onSelect,
  onMedia,
  onAdd,
}: {
  item: MenuItem;
  thumbUrl: string | null;
  price: number;
  currencySymbol: string;
  qty: number;
  onSelect: (item: MenuItem) => void;
  onMedia: (item: MenuItem) => void;
  onAdd: (item: MenuItem) => void;
}) {
  return (
    // Same structure as the list card: a plain box, a stretched "details"
    // button behind the content, and the real controls above it. The paddings,
    // sizes and line-heights below are what lib/layout.ts costs a card at —
    // this restructure deliberately adds no box that takes up space.
    <div className="group relative flex h-full w-full flex-col rounded-lg border border-neutral-200 bg-white/70 p-2 text-left transition hover:border-neutral-300 hover:bg-white">
      <button
        type="button"
        onClick={() => onSelect(item)}
        aria-label={`${item.name}, ${formatPrice(currencySymbol, price)}. See details`}
        className="absolute inset-0 z-10 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-highlightColor"
      />
      <span className="flex w-full gap-2">
        {thumbUrl && (
          // Decorative here: the photo control is the 📷 button on the price
          // row, and a second way in would only add a tab stop per card.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt=""
            loading="lazy"
            className="h-10 w-10 flex-shrink-0 rounded-md object-cover"
          />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-1">
            <span className="line-clamp-2 min-w-0 font-titleFont text-[11px] font-semibold leading-[14px] text-titleColor">
              {item.name}
            </span>
            <CompactBadges item={item} />
          </span>
          {item.shortDesc && (
            <span className="mt-[1px] line-clamp-2 font-descriptionFont text-[9px] leading-[12px] text-disableTextColor">
              {item.shortDesc}
            </span>
          )}
        </span>
      </span>

      <span className="mt-auto flex w-full items-center gap-1.5 pt-1">
        <span className="font-titleFont text-[11.5px] font-semibold leading-[18px] tabular-nums text-titleColor">
          {formatPrice(currencySymbol, price)}
        </span>
        {hasDiscount(item) && (
          <span className="font-titleFont text-[9px] tabular-nums text-disableTextColor line-through">
            {formatPrice(currencySymbol, item.price)}
          </span>
        )}
        {hasMedia(item) && (
          <button
            type="button"
            aria-label={`View ${item.media?.some((m) => m.type === "video") ? "video" : "photo"} of ${item.name}`}
            onClick={() => onMedia(item)}
            // after:-inset-2 grows the tappable area to ~32 design px without
            // changing the 16px the row is laid out around.
            className="relative z-20 inline-flex h-[16px] items-center after:absolute after:-inset-2 after:content-['']"
          >
            {item.media?.some((m) => m.type === "video") ? "▶" : "📷"}
          </button>
        )}

        <button
          type="button"
          aria-label={`Add ${item.name} to your order`}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            flyToCart({
              x: r.left + r.width / 2,
              y: r.top + r.height / 2,
              label: item.name,
            });
            onAdd(item);
          }}
          // The drawn circle stays 18 design px — enlarging it would re-cost
          // every row in the layout engine. `after:-inset-[7px]` puts a 32
          // design px (≈46 CSS px on a phone, where the page is scaled up)
          // target around it instead, which is what the thumb actually hits.
          className="relative z-20 ml-auto flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full border border-highlightColor text-highlightColor opacity-80 transition after:absolute after:-inset-[7px] after:content-['']"
        >
          <FaPlus className="text-[8px]" />
          {qty > 0 && (
            <span className="absolute -right-1 -top-1 flex h-[13px] min-w-[13px] items-center justify-center rounded-full bg-highlightColor px-[3px] font-titleFont text-[8px] font-bold leading-none text-white">
              {qty}
            </span>
          )}
        </button>
      </span>
    </div>
  );
}

/** hot / nut / veg icons at row scale. */
export function CompactBadges({
  item,
  size = 11,
}: {
  item: { hot?: number; nut?: boolean; veg?: boolean };
  size?: number;
}) {
  const hot = Number(item.hot ?? 0);
  if (!hot && !item.nut && !item.veg) return null;
  const style = { height: size };
  return (
    <span className="flex flex-shrink-0 items-center gap-[1px] self-center">
      {hot > 0 &&
        [...Array(hot)].map((_, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src="/images/hot.png"
            alt="Hot"
            style={style}
            className="object-contain"
          />
        ))}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {item.nut && (
        <img
          src="/images/nut.png"
          alt="Contains nuts"
          style={style}
          className="object-contain"
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {item.veg && (
        <img
          src="/images/veg.png"
          alt="Vegetarian"
          style={style}
          className="object-contain"
        />
      )}
    </span>
  );
}
