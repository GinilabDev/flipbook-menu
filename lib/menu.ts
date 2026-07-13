// ---------------------------------------------------------------------------
// Data-driven menu contract — shared between the flipbook (this repo) and the
// tomafood admin API. The flipbook CONSUMES this shape; items are structured
// data (not PDF hotspots) and render as real elements into a flipbook template.
// See plans/api-contract.md and plans/04-data-mapping.md.
// ---------------------------------------------------------------------------

export type MediaType = "image" | "video";
export type MediaProvider = "youtube" | "vimeo" | "file";

export interface Media {
  type: MediaType;
  url: string;
  /** for videos: how to embed. images are always shown directly. */
  provider?: MediaProvider;
  thumbnail?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  /** customer price (rcs_recipe.out_price) */
  price: number;
  /** > 0 → show as the effective (struck-through original) price */
  discountPrice?: number;
  shortDesc?: string;
  longDesc?: string;
  categoryId: string;
  subcategoryId?: string;
  sortOrder?: number;
  veg?: boolean;
  hot?: boolean;
  nut?: boolean;
  media?: Media[];
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  /** brand/section accent colour */
  color?: string;
  sortOrder?: number;
}

export interface Restaurant {
  id: string;
  name: string;
  logoUrl?: string;
  brandColor?: string;
  currency?: string;
  currencySymbol: string;
}

export interface TableInfo {
  id: string;
  name?: string;
  area?: string;
}

export interface Menu {
  restaurant: Restaurant;
  table?: TableInfo;
  categories: Category[];
  items: MenuItem[];
}

/** The price actually charged (discount wins when set). */
export function effectivePrice(item: MenuItem): number {
  return item.discountPrice && item.discountPrice > 0
    ? item.discountPrice
    : item.price;
}

export function hasDiscount(item: MenuItem): boolean {
  return !!item.discountPrice && item.discountPrice > 0 && item.discountPrice < item.price;
}

export function formatPrice(symbol: string, price: number): string {
  return `${symbol}${price.toFixed(2)}`;
}

export function hasMedia(item: MenuItem): boolean {
  return !!item.media && item.media.length > 0;
}

/** Group items by categoryId, each list sorted by sortOrder then name. */
export function itemsByCategory(menu: Menu): Record<string, MenuItem[]> {
  const map: Record<string, MenuItem[]> = {};
  for (const it of menu.items) (map[it.categoryId] ??= []).push(it);
  for (const list of Object.values(map)) {
    list.sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)
    );
  }
  return map;
}

/** Categories that actually have items, sorted by sortOrder. */
export function orderedCategories(menu: Menu): Category[] {
  const byCat = itemsByCategory(menu);
  return [...menu.categories]
    .filter((c) => (byCat[c.id]?.length ?? 0) > 0)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}
