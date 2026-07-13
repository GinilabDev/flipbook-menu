"use client";

import type { LayoutPage } from "@/lib/layout";
import type { MenuItem } from "@/lib/menu";
import ItemCard from "@/components/ItemCard";

interface MenuPageProps {
  page: LayoutPage;
  currencySymbol: string;
  qtyOf: (itemId: string) => number;
  onSelect: (item: MenuItem) => void;
  onMedia: (item: MenuItem) => void;
  onAdd: (item: MenuItem) => void;
}

/** Renders one flipbook page from layout data (cover / section / back / blank). */
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
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-4 p-8 text-center"
        style={{ background: r.brandColor || "#111827", color: "#fff" }}
      >
        {r.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.logoUrl} alt={r.name} className="max-h-28 max-w-[70%] object-contain" />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/15 text-4xl">
            🍽
          </div>
        )}
        <h1 className="text-3xl font-bold tracking-tight">{r.name}</h1>
        <p className="text-sm opacity-80">Tap any item to add it to your order</p>
        <p className="mt-6 text-xs opacity-60">Swipe or use the arrows to browse →</p>
      </div>
    );
  }

  if (page.kind === "back") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-slate-50 p-8 text-center text-slate-500">
        <div className="text-4xl">🙏</div>
        <p className="text-lg font-medium text-slate-700">Thank you!</p>
        <p className="text-sm">{page.restaurant.name}</p>
      </div>
    );
  }

  if (page.kind === "blank") {
    return <div className="h-full w-full bg-white" />;
  }

  // section
  const { category, items, continued, part, partCount } = page;
  return (
    <div className="flex h-full w-full flex-col bg-white">
      <div
        className="flex items-baseline justify-between border-b-2 px-4 py-3"
        style={{ borderColor: category.color || "#e5e7eb" }}
      >
        <h2 className="text-lg font-bold text-slate-800">
          {category.name}
          {continued && <span className="ml-1 text-sm font-normal text-slate-400">(cont.)</span>}
        </h2>
        {partCount > 1 && (
          <span className="text-xs text-slate-400">
            {part}/{partCount}
          </span>
        )}
      </div>
      {category.description && !continued && (
        <p className="px-4 pt-2 text-xs italic text-slate-400">{category.description}</p>
      )}
      <div className="flex flex-1 flex-col gap-2 overflow-hidden p-3">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            currencySymbol={currencySymbol}
            qty={qtyOf(item.id)}
            onSelect={onSelect}
            onMedia={onMedia}
            onAdd={onAdd}
          />
        ))}
      </div>
    </div>
  );
}
