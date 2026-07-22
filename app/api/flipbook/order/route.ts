import { ADMIN_API_BASE, ADMIN_ORDER_PATH } from "@/lib/config";

// Proxies the order to the tomafood admin API.
// Body: { restaurant, table?, items:[{itemId,qty}], note?, customer? }
//
// A failure here is reported as a failure. This used to fall back to a
// fabricated confirmation, which told the customer their food was on its way
// while the kitchen had never heard of the order.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    return Response.json({ error: "No items in order." }, { status: 400 });
  }

  try {
    const res = await fetch(ADMIN_API_BASE + ADMIN_ORDER_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return Response.json(await res.json());
  } catch {
    /* admin unreachable */
  }

  return Response.json(
    { ok: false, error: "Could not send your order. Please call a member of staff." },
    { status: 502 },
  );
}
