// Server-side menu fetch, shared by the /api/flipbook/menu proxy and the
// restaurant page's generateMetadata. Talks to the tomafood admin API and
// falls back to mock data when it is unreachable or USE_MOCK is set.

import type { Category, Menu, MenuItem, Restaurant, Subcategory, TableInfo } from "@/lib/menu";
import {
  ADMIN_API_BASE,
  ADMIN_MENU_PATH,
  ADMIN_RESTAURANT_PATH,
  USE_MOCK,
} from "@/lib/config";
import { mockMenu } from "@/lib/mock";

export interface MenuResult {
  menu: Menu;
  source: "admin" | "mock";
}

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

export async function fetchMenu(
  restaurant: string,
  table?: string,
  opts: FetchMenuOptions = {},
): Promise<MenuResult> {
  if (!USE_MOCK) {
    const { revalidate, brandingOnly } = opts;

    // Independent endpoints — fire both at once rather than paying for them
    // back to back.
    const [info, menu] = await Promise.all([
      adminGet<RestaurantResponse>(ADMIN_RESTAURANT_PATH, restaurant, table, revalidate),
      brandingOnly
        ? Promise.resolve(null)
        : adminGet<MenuResponse>(ADMIN_MENU_PATH, restaurant, table, revalidate),
    ]);

    // Branding is what makes a menu usable (currency symbol, name, theme), so
    // it alone decides whether we have a real answer or fall back to mock.
    if (info?.restaurant) {
      return {
        menu: {
          restaurant: info.restaurant,
          table: info.table ?? undefined,
          categories: menu?.categories ?? [],
          subcategories: menu?.subcategories ?? [],
          items: menu?.items ?? [],
        },
        source: "admin",
      };
    }
  }
  return { menu: mockMenu(restaurant, table), source: "mock" };
}
