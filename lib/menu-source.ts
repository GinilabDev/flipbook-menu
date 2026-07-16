// Server-side menu fetch, shared by the /api/flipbook/menu proxy and the
// restaurant page's generateMetadata. Talks to the tomafood admin API and
// falls back to mock data when it is unreachable or USE_MOCK is set.

import type { Menu } from "@/lib/menu";
import { ADMIN_API_BASE, ADMIN_MENU_PATH, USE_MOCK } from "@/lib/config";
import { mockMenu } from "@/lib/mock";

export interface MenuResult {
  menu: Menu;
  source: "admin" | "mock";
}

export interface FetchMenuOptions {
  /**
   * Seconds to cache for. Metadata passes a small value so that generating the
   * title doesn't re-fetch the whole menu on every render; the proxy route
   * omits it and always reads through, since a stale menu is a wrong menu.
   */
  revalidate?: number;
}

export async function fetchMenu(
  restaurant: string,
  table?: string,
  opts: FetchMenuOptions = {},
): Promise<MenuResult> {
  if (!USE_MOCK) {
    try {
      const url = new URL(ADMIN_API_BASE + ADMIN_MENU_PATH);
      url.searchParams.set("restaurant", restaurant);
      if (table) url.searchParams.set("table", table);

      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        ...(opts.revalidate === undefined
          ? { cache: "no-store" as const }
          : { next: { revalidate: opts.revalidate } }),
      });
      if (res.ok) {
        const data = (await res.json()) as Menu;
        if (data?.restaurant && Array.isArray(data.items)) {
          return { menu: data, source: "admin" };
        }
      }
    } catch {
      /* admin unreachable — fall through to mock */
    }
  }
  return { menu: mockMenu(restaurant, table), source: "mock" };
}
