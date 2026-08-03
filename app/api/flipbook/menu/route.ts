import { fetchMenu, type MenuFailure } from "@/lib/menu-source";

/**
 * What each failure means to whoever asked, and what HTTP status says it.
 *
 * The `code` is the part the flipbook reads — it renders its own wording for
 * the customer (see RestaurantMenuClient#MESSAGES). The message here is for
 * anyone reading the API directly, so it stays legible on its own.
 */
const FAILURES: Record<MenuFailure, { status: number; error: string }> = {
  "not-found": {
    status: 404,
    error: "No restaurant matches this link.",
  },
  empty: {
    status: 404,
    error: "This restaurant has no published menu items.",
  },
  unreachable: {
    status: 502,
    error: "The menu service did not respond.",
  },
};

// The flipbook calls THIS route; it proxies to the tomafood admin API.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const restaurant = searchParams.get("restaurant");
  const table = searchParams.get("table") ?? undefined;

  if (!restaurant) {
    return Response.json(
      { code: "bad-request", error: "restaurant is required." },
      { status: 400 },
    );
  }

  const result = await fetchMenu(restaurant, table);
  if (!result.ok) {
    const { status, error } = FAILURES[result.reason];
    return Response.json({ code: result.reason, error }, { status });
  }

  return Response.json(result.menu);
}
