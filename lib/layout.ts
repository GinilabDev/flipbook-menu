// ---------------------------------------------------------------------------
// Layout engine — turns menu data into fixed-slot flipbook pages.
//   • page 0        = cover
//   • each category = starts on a new page (section header), N items per page,
//                     overflow spills to "continued" pages
//   • last page     = back cover
// Page count is padded to stay even so react-pageflip pairs spreads cleanly.
// ---------------------------------------------------------------------------

import type { Category, Menu, MenuItem, Restaurant } from "@/lib/menu";
import { itemsByCategory, orderedCategories } from "@/lib/menu";

export type LayoutPage =
  | { kind: "cover"; key: string; restaurant: Restaurant }
  | {
      kind: "section";
      key: string;
      category: Category;
      items: MenuItem[];
      /** true for the 2nd+ page of a long category */
      continued: boolean;
      part: number;
      partCount: number;
    }
  | { kind: "back"; key: string; restaurant: Restaurant }
  | { kind: "blank"; key: string };

export interface LayoutOptions {
  /** max item cards per page */
  itemsPerPage: number;
}

function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function buildPages(menu: Menu, opts: LayoutOptions): LayoutPage[] {
  const { itemsPerPage } = opts;
  const byCat = itemsByCategory(menu);
  const cats = orderedCategories(menu);

  const pages: LayoutPage[] = [
    { kind: "cover", key: "cover", restaurant: menu.restaurant },
  ];

  for (const category of cats) {
    const items = byCat[category.id] ?? [];
    const parts = chunk(items, itemsPerPage);
    parts.forEach((part, i) => {
      pages.push({
        kind: "section",
        key: `sec-${category.id}-${i}`,
        category,
        items: part,
        continued: i > 0,
        part: i + 1,
        partCount: parts.length,
      });
    });
  }

  pages.push({ kind: "back", key: "back", restaurant: menu.restaurant });

  // Keep an even number of pages for clean spread pairing.
  if (pages.length % 2 !== 0) {
    pages.splice(pages.length - 1, 0, { kind: "blank", key: "blank" });
  }

  return pages;
}

/** Items-per-page heuristic based on the viewport. */
export function itemsPerPageFor(portrait: boolean): number {
  return portrait ? 4 : 6;
}
