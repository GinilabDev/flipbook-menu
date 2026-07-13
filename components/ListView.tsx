"use client";

import type { Menu, MenuItem } from "@/lib/menu";
import { itemsByCategory, orderedCategories } from "@/lib/menu";
import ItemCard from "@/components/ItemCard";

interface ListViewProps {
  menu: Menu;
  qtyOf: (itemId: string) => number;
  onSelect: (item: MenuItem) => void;
  onMedia: (item: MenuItem) => void;
  onAdd: (item: MenuItem) => void;
}

/** Fast scrollable alternative to the flipbook (mobile-friendly). */
export default function ListView({
  menu,
  qtyOf,
  onSelect,
  onMedia,
  onAdd,
}: ListViewProps) {
  const cats = orderedCategories(menu);
  const byCat = itemsByCategory(menu);
  const sym = menu.restaurant.currencySymbol;

  return (
    <div className="mx-auto w-full max-w-2xl px-3 pb-28 pt-4">
      {cats.map((category) => (
        <section key={category.id} className="mb-6">
          <h2
            className="sticky top-0 z-10 -mx-3 border-b-2 bg-white/95 px-3 py-2 text-lg font-bold text-slate-800 backdrop-blur"
            style={{ borderColor: category.color || "#e5e7eb" }}
          >
            {category.name}
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {(byCat[category.id] ?? []).map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                currencySymbol={sym}
                qty={qtyOf(item.id)}
                onSelect={onSelect}
                onMedia={onMedia}
                onAdd={onAdd}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
