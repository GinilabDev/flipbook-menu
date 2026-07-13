import { ADMIN_API_BASE, ADMIN_ORDER_PATH, USE_MOCK } from "@/lib/config";

// Proxies the order to the tomafood admin API; mock-confirms while that
// endpoint is being built. Body: { restaurant, table?, items:[{itemId,qty}], note?, customer? }
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    return Response.json({ error: "No items in order." }, { status: 400 });
  }

  if (!USE_MOCK) {
    try {
      const res = await fetch(ADMIN_API_BASE + ADMIN_ORDER_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) return Response.json(await res.json());
    } catch {
      /* admin unreachable — fall through to mock confirmation */
    }
  }

  const orderId = `mock_${body.items.length}_${body.items.reduce(
    (n: number, i: { qty?: number }) => n + (i.qty ?? 0),
    0
  )}`;
  return Response.json(
    { ok: true, orderId, status: "received" },
    { headers: { "X-Order-Source": "mock" } }
  );
}
