// Server-side menu fetch, shared by the /api/flipbook/menu proxy and the
// restaurant page's generateMetadata. Talks to the tomafood admin API.
//
// There is deliberately no offline/demo fallback: a stand-in menu would show
// customers dishes and prices the kitchen never agreed to, which is worse than
// showing nothing. When the admin is unreachable this returns null and the
// caller surfaces the failure.

import type { Category, Menu, MenuItem, Restaurant, Subcategory, TableInfo } from "@/lib/menu";
import {
  ADMIN_API_BASE,
  ADMIN_MENU_PATH,
  ADMIN_RESTAURANT_PATH,
} from "@/lib/config";

export interface FetchMenuOptions {
  /**
   * Seconds to cache for. Metadata passes a small value so that generating the
   * title doesn't re-fetch on every render; the proxy route omits it and always
   * reads through, since a stale menu is a wrong menu.
   */
  revalidate?: number;
  /**
   * Skip the menu call and return branding only (items empty). generateMetadata
   * needs the name and table, never the 278 items.
   */
  brandingOnly?: boolean;
}

/** Admin GET returning parsed JSON, or null on any non-OK / transport error. */
async function adminGet<T>(
  path: string,
  restaurant: string,
  table: string | undefined,
  revalidate: number | undefined,
): Promise<T | null> {
  try {
    const url = new URL(ADMIN_API_BASE + path);
    url.searchParams.set("restaurant", restaurant);
    if (table) url.searchParams.set("table", table);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      ...(revalidate === undefined
        ? { cache: "no-store" as const }
        : { next: { revalidate } }),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null; // admin unreachable
  }
}

interface RestaurantResponse {
  restaurant: Restaurant;
  table: TableInfo | null;
}
interface MenuResponse {
  categories: Category[];
  subcategories: Subcategory[];
  items: MenuItem[];
}

/** The assembled menu, or null when the admin API can't be reached. */
export async function fetchMenu(
  restaurant: string,
  table?: string,
  opts: FetchMenuOptions = {},
): Promise<Menu | null> {
  const { revalidate, brandingOnly } = opts;

  // Independent endpoints — fire both at once rather than paying for them
  // back to back.
  const [info, menu] = await Promise.all([
    adminGet<RestaurantResponse>(ADMIN_RESTAURANT_PATH, restaurant, table, revalidate),
    brandingOnly
      ? Promise.resolve(null)
      : adminGet<MenuResponse>(ADMIN_MENU_PATH, restaurant, table, revalidate),
  ]);

  // Branding is what makes a menu usable (currency symbol, name, theme), so it
  // alone decides whether we have an answer at all.
  if (!info?.restaurant) return null;

  return {
    restaurant: info.restaurant,
    table: info.table ?? undefined,
    categories: menu?.categories ?? [],
    subcategories: menu?.subcategories ?? [],
    items: menu?.items ?? [],
  };
}
