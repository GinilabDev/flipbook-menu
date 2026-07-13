import type { Menu } from "@/lib/menu";
import { ADMIN_API_BASE, ADMIN_MENU_PATH, USE_MOCK } from "@/lib/config";
import { mockMenu } from "@/lib/mock";

// The flipbook calls THIS route; it proxies to the tomafood admin API and
// falls back to mock data while that endpoint is being built. When the real
// endpoint returns the Menu shape, it is used automatically — no client change.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const restaurant = searchParams.get("restaurant") ?? "demo";
  const table = searchParams.get("table") ?? undefined;

  if (!USE_MOCK) {
    try {
      const url = new URL(ADMIN_API_BASE + ADMIN_MENU_PATH);
      url.searchParams.set("restaurant", restaurant);
      if (table) url.searchParams.set("table", table);
      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        // avoid caching a stale menu during development
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as Menu;
        if (data?.restaurant && Array.isArray(data.items)) {
          return Response.json(data);
        }
      }
    } catch {
      /* admin unreachable — fall through to mock */
    }
  }

  return Response.json(mockMenu(restaurant, table), {
    headers: { "X-Menu-Source": "mock" },
  });
}
