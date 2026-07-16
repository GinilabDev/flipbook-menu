import { fetchMenu } from "@/lib/menu-source";

// The flipbook calls THIS route; it proxies to the tomafood admin API and
// falls back to mock data when that endpoint is unreachable.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const restaurant = searchParams.get("restaurant") ?? "demo";
  const table = searchParams.get("table") ?? undefined;

  const { menu, source } = await fetchMenu(restaurant, table);

  return Response.json(menu, {
    headers: source === "mock" ? { "X-Menu-Source": "mock" } : undefined,
  });
}
