// ---------------------------------------------------------------------------
// MOCK order endpoint. The real admin API should accept this same body and
// return an order id / confirmation. Shape the flipbook sends:
//   { restaurant?, items: [{ itemId, qty }], customer?, note? }
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    return Response.json({ error: "No items in order." }, { status: 400 });
  }

  // Pretend we persisted it. A deterministic id keeps this reproducible.
  const orderId = `mock_${body.items.length}_${body.items.reduce(
    (n: number, i: { qty?: number }) => n + (i.qty ?? 0),
    0
  )}`;

  return Response.json({ ok: true, orderId, status: "received" });
}
