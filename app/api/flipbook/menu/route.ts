import { fetchMenu } from "@/lib/menu-source";

// The flipbook calls THIS route; it proxies to the tomafood admin API.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const restaurant = searchParams.get("restaurant");
  const table = searchParams.get("table") ?? undefined;

  if (!restaurant) {
    return Response.json({ error: "restaurant is required." }, { status: 400 });
  }

  const menu = await fetchMenu(restaurant, table);
  if (!menu) {
    return Response.json(
      { error: "This menu is unavailable right now." },
      { status: 502 },
    );
  }

  return Response.json(menu);
}
