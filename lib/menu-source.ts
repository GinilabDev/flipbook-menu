// Server-side menu fetch, shared by the /api/flipbook/menu proxy and the
// restaurant page's generateMetadata. Talks to the tomafood admin API.
//
// There is deliberately no offline/demo fallback: a stand-in menu would show
// customers dishes and prices the kitchen never agreed to, which is worse than
// showing nothing. When there is no menu to give, this reports *why* (see
// MenuFailure) and the caller turns that into something the customer can act
// on.

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

/**
 * Why a menu could not be produced. The reason travels all the way to the
 * customer's screen, because these need different things of them: a wrong QR is
 * a question for the waiter, an unpublished menu is a question for the manager,
 * and an admin that is down is worth waiting a moment and retrying. One
 * "Could not load the menu." told them none of that.
 */
export type MenuFailure =
  /** the admin has no restaurant under this slug — usually a mistyped/old QR */
  | "not-found"
  /** the admin answered, but with no dishes to show */
  | "empty"
  /** the admin could not be reached, or refused to answer */
  | "unreachable";

export type MenuResult =
  | { ok: true; menu: Menu }
  | { ok: false; reason: MenuFailure };

type AdminResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "not-found" | "unreachable" };

/** Admin GET returning parsed JSON, or why it couldn't. */
async function adminGet<T>(
  path: string,
  restaurant: string,
  table: string | undefined,
  revalidate: number | undefined,
): Promise<AdminResult<T>> {
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
    // 404 is the admin answering, and answering clearly: there is no such
    // restaurant. Every other refusal is a fault at its end, not the QR's.
    if (res.status === 404) return { ok: false, reason: "not-found" };
    if (!res.ok) return { ok: false, reason: "unreachable" };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, reason: "unreachable" }; // admin unreachable / bad JSON
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

/** The assembled menu, or the reason there isn't one. */
export async function fetchMenu(
  restaurant: string,
  table?: string,
  opts: FetchMenuOptions = {},
): Promise<MenuResult> {
  const { revalidate, brandingOnly } = opts;

  // Independent endpoints — fire both at once rather than paying for them
  // back to back.
  const [info, menu] = await Promise.all([
    adminGet<RestaurantResponse>(ADMIN_RESTAURANT_PATH, restaurant, table, revalidate),
    brandingOnly
      ? null
      : adminGet<MenuResponse>(ADMIN_MENU_PATH, restaurant, table, revalidate),
  ]);

  // Branding is what makes a menu usable (currency symbol, name, theme), so it
  // alone decides whether we have an answer at all. An admin that answers 200
  // with nothing in it is answering about a restaurant it doesn't have.
  if (!info.ok) return { ok: false, reason: info.reason };
  if (!info.data?.restaurant) return { ok: false, reason: "not-found" };

  // The dishes are a separate call, and it can fail on its own. Falling through
  // with an empty list used to hand the customer a book of blank pages under
  // the right restaurant's name — a failure disguised as a menu.
  if (menu && !menu.ok) return { ok: false, reason: menu.reason };
  const items = menu?.data.items ?? [];
  if (menu && items.length === 0) return { ok: false, reason: "empty" };

  return {
    ok: true,
    menu: {
      restaurant: info.data.restaurant,
      table: info.data.table ?? undefined,
      categories: menu?.data.categories ?? [],
      subcategories: menu?.data.subcategories ?? [],
      items,
    },
  };
}
