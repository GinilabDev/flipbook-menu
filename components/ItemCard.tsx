"use client";

import { memo } from "react";
import { mediaUrl } from "@/lib/config";
import type { MenuItem } from "@/lib/menu";
import { effectivePrice, formatPrice, hasDiscount } from "@/lib/menu";
import { flyToCart } from "@/lib/flyToCart";
import { useItemQty } from "@/lib/cart";
import ImageWithLoader from "@/components/ImageWithLoader";
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

/** What the card shows as its picture, and what a tap on it opens. */
interface Preview {
  /** null = a video we have no still for; drawn as a play tile instead */
  src: string | null;
  isVideo: boolean;
}

/**
 * The one picture a card gets. An image wins over a video, because a still
 * frame sells a dish better than a black tile; a video-only item falls back to
 * its own thumbnail, and to a play tile when it has none. Either way the
 * picture is the only way into the lightbox — there is no separate media
 * button — so a video item must still show *something* tappable.
 */
function previewOf(item: MenuItem): Preview | null {
  const media = item.media ?? [];
  const first = media.find((m) => m.type === "image") ?? media[0];
  if (!first) return null;
  if (first.type === "image")
    return { src: mediaUrl(first.thumbnail || first.url), isVideo: false };
  return {
    src: first.thumbnail ? mediaUrl(first.thumbnail) : null,
    isVideo: true,
  };
}

/**
 * Shared menu-item card — used on flipbook pages and in the list view.
 *
 * Laid out like the tomafood web menu's card: the words on the left, the photo
 * on the right, and the add control floating in the top-right corner over it.
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
  const preview = previewOf(item);
  const price = effectivePrice(item);
  const compact = variant === "compact";

  return (
    // A card holds three separate actions — "tell me more", "show me the
    // photo" and "add one" — so it cannot itself be a button with buttons
    // inside it (invalid, and a screen reader reads it as one confused
    // control). The card is a plain box; the "details" button is stretched
    // invisibly across it, and the controls that must stay clickable are
    // lifted above it.
    <div
      className={
        compact
          ? "group relative grid h-full w-full grid-cols-[1fr_auto] items-start gap-1.5 rounded-lg border border-neutral-200 bg-white/70 p-2 text-left shadow-sm transition hover:border-neutral-300 hover:bg-white"
          : "group relative grid w-full grid-cols-[1fr_auto] items-start gap-2 rounded-[10px] border border-neutral-200 bg-white/70 p-2.5 text-left shadow-sm transition hover:border-neutral-300 hover:bg-white"
      }
    >
      <button
        type="button"
        onClick={() => onSelect(item)}
        aria-label={`${item.name}, ${formatPrice(currencySymbol, price)}. See details`}
        className={`absolute inset-0 z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-highlightColor ${
          compact
            ? "rounded-lg focus-visible:outline-offset-1"
            : "rounded-[10px] focus-visible:outline-offset-2"
        }`}
      />

      {/* LEFT SIDE — title, price, description. Without a photo there is
          nothing under the floating add button, so the words reserve its
          corner themselves. */}
      <div className={`flex min-w-0 flex-col ${preview ? "" : "pr-9"}`}>
        <span className="flex items-start gap-1.5">
          <span
            className={
              compact
                ? "line-clamp-2 min-w-0 font-titleFont text-[11px] font-semibold leading-[14px] text-titleColor"
                : "min-w-0 truncate font-titleFont font-semibold text-titleColor"
            }
          >
            {item.name}
          </span>
          <CompactBadges item={item} size={compact ? 11 : 22} />
        </span>

        <span
          className={`flex items-center gap-1.5 ${compact ? "mt-[1px]" : "mt-1"}`}
        >
          <span
            className={
              compact
                ? "font-titleFont text-[11.5px] font-semibold leading-[16px] tabular-nums text-titleColor"
                : "font-titleFont font-semibold tabular-nums text-titleColor"
            }
          >
            {formatPrice(currencySymbol, price)}
          </span>
          {hasDiscount(item) && (
            <span
              className={`font-titleFont tabular-nums text-disableTextColor line-through ${
                compact ? "text-[9px]" : "text-xs"
              }`}
            >
              {formatPrice(currencySymbol, item.price)}
            </span>
          )}
        </span>

        {/* The description face is a Thin weight, so it needs size and
            contrast to stay readable at card scale — the web menu sets the
            same face at 14px/tracking-wide for exactly this reason. */}
        {item.shortDesc && (
          <span
            className={
              compact
                ? "mt-[1px] line-clamp-2 font-descriptionFont text-[10px] leading-[13px] tracking-wide text-descriptionColor"
                : "mt-1 line-clamp-2 font-descriptionFont text-[13.5px] leading-[18px] tracking-wide text-descriptionColor"
            }
          >
            {item.shortDesc}
          </span>
        )}
      </div>

      {/* RIGHT SIDE — the photo, and the only way into the lightbox. */}
      {preview && (
        <button
          type="button"
          onClick={() => onMedia(item)}
          aria-label={`View ${preview.isVideo ? "video" : "photo"} of ${item.name}`}
          className={`relative z-20 flex flex-shrink-0 items-center justify-center overflow-hidden bg-neutral-100 ${
            compact ? "h-[52px] w-[68px] rounded-md" : "h-24 w-32 rounded-lg"
          }`}
        >
          {preview.src && (
            <ImageWithLoader
              src={preview.src}
              alt=""
              wrapperClassName="h-full w-full"
              className="h-full w-full cursor-zoom-in object-cover transition-transform duration-300 group-hover:scale-105"
              spinnerClassName={
                compact ? "h-4 w-4 border-2" : "h-6 w-6 border-2"
              }
            />
          )}
          {preview.isVideo && (
            <span
              className={`absolute flex items-center justify-center rounded-full bg-black/55 text-white ${
                compact ? "h-5 w-5 text-[8px]" : "h-8 w-8 text-xs"
              }`}
            >
              ▶
            </span>
          )}
        </button>
      )}

      {/* Floating add control — over the photo's corner, the way the web
          menu's stepper sits. The drawn circle stays small so it never
          crowds the picture; the `after` box is the target the thumb
          actually hits (36 design px in compact, which is 45 CSS px at the
          smallest scale a page is ever drawn at — MIN_PAGE_SCALE = 1.25). */}
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
        className={`absolute z-20 flex flex-shrink-0 items-center justify-center rounded-full border border-highlightColor bg-white/90 text-highlightColor shadow-sm transition after:absolute after:content-[''] hover:bg-white ${
          compact
            ? // A phone shows one page where a spread shows two, so a card is
              // twice as wide there and can carry a slightly larger control —
              // the same 36 design px target either way, just drawn bigger.
              "right-[5px] top-[5px] h-[18px] w-[18px] after:-inset-[9px] max-md:h-[21px] max-md:w-[21px] max-md:after:-inset-[8px]"
            : "right-1.5 top-1.5 h-9 w-9 text-lg after:-inset-1"
        }`}
      >
        <FaPlus
          className={compact ? "text-[8px] max-md:text-[9.5px]" : "text-base"}
        />
        {qty > 0 && (
          <span
            className={`absolute flex items-center justify-center rounded-full bg-highlightColor font-titleFont font-bold leading-none text-white ${
              compact
                ? "-right-1 -top-1 h-[13px] min-w-[13px] px-[3px] text-[8px]"
                : "-right-1 -top-1 h-5 min-w-5 px-1 text-[10px]"
            }`}
          >
            {qty}
          </span>
        )}
      </button>
    </div>
  );
}

export default memo(ItemCard);

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
