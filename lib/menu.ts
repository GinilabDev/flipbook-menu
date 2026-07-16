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
  /** spice level — rendered as N chili icons (0/undefined = none) */
  hot?: number;
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
  /** admin flag: this category's items are grouped under subcategory headings */
  withSubcategory?: boolean;
}

/**
 * A heading *inside* a category — the sauce/style rows of a classic curry-house
 * menu (Jalfrezi, Madras, Korma…). Shared across categories: the same "Madras"
 * subcategory heads items in Meat Dishes and in Seafood Dishes.
 */
export interface Subcategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
  sortOrder?: number;
  /** spice level — N chili icons, same convention as MenuItem.hot */
  hot?: number;
  nut?: boolean;
}

export interface RestaurantAddress {
  line1?: string;
  city?: string;
  county?: string;
  postcode?: string;
  /** the whole address on one line, ready to print */
  full?: string;
}

export interface RestaurantSocial {
  facebook?: string;
  instagram?: string;
  google?: string;
}

export interface Restaurant {
  id: string;
  name: string;
  /** raw admin path — run it through mediaUrl() before use */
  logoUrl?: string;
  /** theme header colour — the cover/back background */
  brandColor?: string;
  /** theme accent — the web menu's highlightColor */
  highlightColor?: string;
  currency?: string;
  currencySymbol: string;
  address?: RestaurantAddress | null;
  phone?: string;
  email?: string;
  website?: string;
  social?: RestaurantSocial | null;
}

export interface TableInfo {
  /** internal id — what the QR carries as ?t= */
  id: string;
  /** the number printed on the table itself, e.g. "5" */
  number?: string;
  /** ready-to-show label, e.g. "Table 5" (or "Booth A" if named) */
  name?: string;
  area?: string;
}

export interface Menu {
  restaurant: Restaurant;
  table?: TableInfo;
  categories: Category[];
  subcategories?: Subcategory[];
  items: MenuItem[];
}

/** Items of one category under one heading (`subcategory: null` = ungrouped). */
export interface ItemGroup {
  subcategory: Subcategory | null;
  items: MenuItem[];
}

/** Cheapest item in a list — the "from £x" the web prints on a heading. */
export function fromPrice(items: MenuItem[]): number {
  return Math.min(...items.map(effectivePrice));
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

/**
 * Split one category's items into rendered groups.
 *
 * Only categories the admin flagged `withSubcategory` are grouped — plenty of
 * categories ("Madras Dishes") carry a subcategory on every item purely as POS
 * bookkeeping, and heading each one would just repeat the category name. When
 * grouped, items with no subcategory lead, ungrouped, before the headings.
 */
export function groupCategoryItems(menu: Menu, category: Category): ItemGroup[] {
  const items = itemsByCategory(menu)[category.id] ?? [];
  const subs = menu.subcategories ?? [];

  if (!category.withSubcategory || subs.length === 0) {
    return items.length ? [{ subcategory: null, items }] : [];
  }

  const subById = new Map(subs.map((s) => [s.id, s]));
  const loose: MenuItem[] = [];
  const bySub = new Map<string, MenuItem[]>();

  for (const it of items) {
    const sub = it.subcategoryId ? subById.get(it.subcategoryId) : undefined;
    if (!sub) loose.push(it);
    else (bySub.get(sub.id) ?? bySub.set(sub.id, []).get(sub.id)!).push(it);
  }

  const groups: ItemGroup[] = [];
  if (loose.length) groups.push({ subcategory: null, items: loose });
  for (const sub of subs) {
    const list = bySub.get(sub.id);
    if (list?.length) groups.push({ subcategory: sub, items: list });
  }
  return groups;
}
