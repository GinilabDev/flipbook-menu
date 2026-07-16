"use client";

import type { Menu, MenuItem } from "@/lib/menu";
import { formatPrice, fromPrice, groupCategoryItems, orderedCategories } from "@/lib/menu";
import ItemCard, { CompactBadges } from "@/components/ItemCard";

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
          {category.description && (
            <p className="mt-1.5 text-xs italic text-slate-400">{category.description}</p>
          )}

          {groupCategoryItems(menu, category).map((group) => (
            <div key={group.subcategory?.id ?? "_"} className="mt-3">
              {group.subcategory && (
                <div className="mb-2 mt-4 rounded-[10px] border bg-white px-4 py-2 shadow-sm first:mt-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-lg font-bold text-slate-800">
                        {group.subcategory.name}
                      </span>
                      <CompactBadges item={group.subcategory} size={20} />
                    </span>
                    <span className="flex-shrink-0 text-sm text-slate-500">
                      from{" "}
                      <span className="font-semibold text-slate-800">
                        {formatPrice(sym, fromPrice(group.items))}
                      </span>
                    </span>
                  </div>
                  {group.subcategory.description && (
                    <p className="text-sm tracking-wide text-slate-500">
                      {group.subcategory.description}
                    </p>
                  )}
                </div>
              )}
              <div className="flex flex-col gap-2">
                {group.items.map((item) => (
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
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
