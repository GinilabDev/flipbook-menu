"use client";

import { useState } from "react";
import { FaFacebookF, FaGoogle, FaInstagram } from "react-icons/fa6";
import type { LayoutPage, PageBlock } from "@/lib/layout";
import { HEADER_H, PAGE_H, PAGE_W } from "@/lib/layout";
import type { MenuItem, Restaurant } from "@/lib/menu";
import { formatPrice } from "@/lib/menu";
import { mediaUrl } from "@/lib/config";
import ItemCard, { CompactBadges } from "@/components/ItemCard";

interface MenuPageProps {
  page: LayoutPage;
  currencySymbol: string;
  qtyOf: (itemId: string) => number;
  onSelect: (item: MenuItem) => void;
  onMedia: (item: MenuItem) => void;
  onAdd: (item: MenuItem) => void;
}

interface SectionBodyProps extends Omit<MenuPageProps, "page"> {
  blocks: PageBlock[];
  itemsPerRow: number;
}

/**
 * One flipbook page (cover / section / back / blank), drawn in the fixed
 * PAGE_W × PAGE_H design space that FlipbookViewer scales to fit the screen.
 */
export default function MenuPage({
  page,
  currencySymbol,
  qtyOf,
  onSelect,
  onMedia,
  onAdd,
}: MenuPageProps) {
  if (page.kind === "cover") {
    const r = page.restaurant;
    const bg = r.brandColor || "#111827";
    const fg = readableOn(bg);
    return (
      <Sheet
        className="items-center justify-center gap-4 p-8 text-center"
        style={{ background: bg, color: fg }}
      >
        <Logo restaurant={r} className="max-h-24 max-w-[210px]" />
        <h1 className="text-3xl font-bold tracking-tight">{r.name}</h1>
        <span
          className="h-[3px] w-14 rounded-full"
          style={{ background: r.highlightColor || fg, opacity: 0.9 }}
        />
        {r.address && (
          <p className="text-[13px] leading-5 opacity-80">
            {r.address.line1}
            {r.address.line1 && <br />}
            {[r.address.city, r.address.county, r.address.postcode].filter(Boolean).join(", ")}
          </p>
        )}
        {r.phone && <p className="text-[13px] font-medium opacity-90">{r.phone}</p>}
        <p className="mt-5 text-sm opacity-75">Tap any item to add it to your order</p>
        <p className="text-xs opacity-55">Swipe or use the arrows to browse →</p>
      </Sheet>
    );
  }

  if (page.kind === "back") {
    const r = page.restaurant;
    const bg = r.brandColor || "#111827";
    const fg = readableOn(bg);
    const links = [
      { key: "facebook", href: r.social?.facebook, label: "Facebook", icon: <FaFacebookF /> },
      { key: "instagram", href: r.social?.instagram, label: "Instagram", icon: <FaInstagram /> },
      { key: "google", href: r.social?.google, label: "Google", icon: <FaGoogle /> },
    ].filter((l) => l.href);

    return (
      <Sheet
        className="items-center justify-center gap-3 p-8 text-center"
        style={{ background: bg, color: fg }}
      >
        <Logo restaurant={r} className="max-h-16 max-w-[170px]" />
        <p className="text-xl font-semibold">Thank you!</p>
        <span
          className="h-[3px] w-10 rounded-full"
          style={{ background: r.highlightColor || fg, opacity: 0.9 }}
        />
        {r.address?.full && (
          <p className="max-w-[80%] text-[12px] leading-5 opacity-80">{r.address.full}</p>
        )}
        {r.phone && <p className="text-[13px] font-medium opacity-90">{r.phone}</p>}
        {r.email && <p className="text-[11px] opacity-70">{r.email}</p>}

        {links.length > 0 && (
          <div className="mt-4 flex items-center gap-3">
            {links.map((l) => (
              <a
                key={l.key}
                href={l.href}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={l.label}
                title={l.label}
                className="flex h-10 w-10 items-center justify-center rounded-full text-[15px] transition hover:scale-110"
                style={{ background: r.highlightColor || "rgba(255,255,255,.18)", color: readableOn(r.highlightColor || bg) }}
              >
                {l.icon}
              </a>
            ))}
          </div>
        )}
      </Sheet>
    );
  }

  if (page.kind === "blank") {
    return <Sheet className="bg-white" />;
  }

  const { category, blocks, itemsPerRow, continued, part, partCount } = page;
  // Online categories carry no colour of their own, so fall back to the
  // restaurant's theme accent rather than a hard-coded slate.
  const accent = category.color || "var(--accent)";

  return (
    <Sheet className="bg-white">
      {/* Section header — fixed height, matching HEADER_H in lib/layout.ts. */}
      <div
        className="flex flex-shrink-0 flex-col justify-end px-4 pb-2 pt-3.5"
        style={{ height: HEADER_H }}
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="truncate text-[17px] font-bold uppercase tracking-wide text-slate-800">
            {category.name}
            {continued && (
              <span className="ml-1 text-[11px] font-normal normal-case tracking-normal text-slate-400">
                (cont.)
              </span>
            )}
          </h2>
          {partCount > 1 && (
            <span className="flex-shrink-0 text-[10px] tabular-nums text-slate-300">
              {part}/{partCount}
            </span>
          )}
        </div>
        {category.description && !continued && (
          <p className="mt-0.5 line-clamp-1 text-[9.5px] italic leading-[12px] text-slate-400">
            {category.description}
          </p>
        )}
        <div
          className="mt-1.5 h-[2px] rounded-full"
          style={{ background: accent, opacity: 0.85 }}
        />
      </div>

      <SectionBody
        blocks={blocks}
        itemsPerRow={itemsPerRow}
        currencySymbol={currencySymbol}
        qtyOf={qtyOf}
        onSelect={onSelect}
        onMedia={onMedia}
        onAdd={onAdd}
      />
    </Sheet>
  );
}

/**
 * The page's block stack. Subcategories start collapsed and open on click, the
 * way the tomafood web menu does — so an open one can make the content taller
 * than the fixed page, and the stack scrolls.
 */
function SectionBody({
  blocks,
  itemsPerRow,
  currencySymbol,
  qtyOf,
  onSelect,
  onMedia,
  onAdd,
}: SectionBodyProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const grid = (items: MenuItem[]) => (
    <div
      className="grid items-stretch gap-1.5"
      style={{ gridTemplateColumns: `repeat(${itemsPerRow}, minmax(0, 1fr))` }}
    >
      {items.map((item) => (
        <ItemCard
          key={item.id}
          variant="compact"
          item={item}
          currencySymbol={currencySymbol}
          qty={qtyOf(item.id)}
          onSelect={onSelect}
          onMedia={onMedia}
          onAdd={onAdd}
        />
      ))}
    </div>
  );

  return (
    // pb clears the viewer's flip arrows; keep it at FOOTER_H.
    <div
      data-col
      className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain px-2.5 pb-[46px]"
    >
      {blocks.map((block) => {
        if (block.kind === "row") return <div key={block.key}>{grid(block.items)}</div>;

        const open = expandedId === block.subcategory.id;
        return (
          <div key={block.key}>
            <SubcategoryHead
              name={block.subcategory.name}
              description={block.subcategory.description}
              badges={block.subcategory}
              fromPrice={block.fromPrice}
              currencySymbol={currencySymbol}
              count={block.items.length}
              open={open}
              onToggle={() =>
                setExpandedId((id) => (id === block.subcategory.id ? null : block.subcategory.id))
              }
            />
            {open && <div className="mt-1.5">{grid(block.items)}</div>}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Restaurant logo on a light panel. Admin logos are artwork on a transparent
 * background (usually dark ink), so dropping one straight onto a brand colour
 * can render it invisible — the panel keeps it legible whatever the colour is.
 */
function Logo({ restaurant, className = "" }: { restaurant: Restaurant; className?: string }) {
  if (!restaurant.logoUrl) {
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/15 text-3xl">
        🍽
      </div>
    );
  }
  return (
    <span className="rounded-xl bg-white/95 px-3 py-2 shadow-lg shadow-black/10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mediaUrl(restaurant.logoUrl)}
        alt={restaurant.name}
        className={`object-contain ${className}`}
      />
    </span>
  );
}

/**
 * Black or white, whichever stays readable on `hex`. Brand colours come from
 * whatever theme the restaurant picked — some are near-black, some near-white —
 * so the text colour can't be hard-coded. Standard sRGB relative luminance.
 */
function readableOn(hex: string): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const channel = (i: number) => {
    const v = parseInt(h.slice(i * 2, i * 2 + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
  return luminance > 0.45 ? "#111827" : "#ffffff";
}

/** Fixed-size page canvas. */
function Sheet({
  children,
  className = "",
  style,
}: {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`flex flex-col overflow-hidden ${className}`}
      style={{ width: PAGE_W, height: PAGE_H, ...style }}
    >
      {children}
    </div>
  );
}

/**
 * Subcategory heading, mirroring the tomafood web menu: name, "from £x" for the
 * cheapest item under it, the description underneath — and click to open.
 */
function SubcategoryHead({
  name,
  description,
  badges,
  fromPrice,
  currencySymbol,
  count,
  open,
  onToggle,
}: {
  name: string;
  description?: string;
  badges: { hot?: number; nut?: boolean; veg?: boolean };
  fromPrice: number;
  currencySymbol: string;
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={`${name}, ${count} item${count === 1 ? "" : "s"}`}
      style={open ? { borderColor: "var(--accent)", background: "color-mix(in srgb, var(--accent) 8%, white)" } : undefined}
      className={`w-full rounded-lg border px-2.5 py-1.5 text-left shadow-sm transition ${
        open ? "" : "border-black/5 bg-white hover:border-black/10 hover:bg-slate-50"
      }`}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1">
          <span className="truncate text-[12.5px] font-bold text-slate-800">{name}</span>
          <CompactBadges item={badges} size={13} />
          <span className="flex-shrink-0 text-[9px] tabular-nums text-slate-400">({count})</span>
        </span>
        <span className="flex flex-shrink-0 items-center gap-1 text-[9px] text-slate-500">
          from{" "}
          <span className="text-[11.5px] font-semibold tabular-nums text-slate-800">
            {formatPrice(currencySymbol, fromPrice)}
          </span>
          <Chevron open={open} />
        </span>
      </div>
      {description && (
        <p className="line-clamp-2 text-[9px] leading-[11px] tracking-wide text-slate-500">
          {description}
        </p>
      )}
    </button>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={open ? { color: "var(--accent)" } : undefined}
      className={`transition-transform ${open ? "rotate-180" : "text-slate-400"}`}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
