import type { Menu } from "@/lib/menu";

// ---------------------------------------------------------------------------
// MOCK menu endpoint.
//
// This is the exact response shape the flipbook expects. When the real admin
// API is ready, make GET /api/menu?restaurant={id} return the same `Menu`
// JSON and everything downstream keeps working unchanged.
//
// For now `autoDetect: true` and empty hotspots/items → the flipbook extracts
// items from the PDF text on the client. Once the admin can ship reviewed
// hotspots, set autoDetect:false and fill `items` + `hotspots`.
// ---------------------------------------------------------------------------

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const restaurant = searchParams.get("restaurant") ?? "demo";

  const pdfUrl = "https://brek-e.co.uk/pdf/Main%20Print%20me.pdf";

  const menu: Menu = {
    menuId: `menu_${restaurant}`,
    title: "Main Menu",
    // Served through our own proxy to avoid CORS on the origin.
    pdfUrl: `/api/pdf-proxy?url=${encodeURIComponent(pdfUrl)}`,
    currency: "GBP",
    currencySymbol: "£",
    autoDetect: true,
    items: [],
    hotspots: [],
  };

  return Response.json(menu);
}
