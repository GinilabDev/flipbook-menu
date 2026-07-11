// Proxy an external PDF so the browser can fetch/render it without hitting CORS
// on the origin server. Only whitelisted hosts are allowed.
const ALLOWED_HOSTS = new Set<string>([
  "brek-e.co.uk",
  "tomafood.net",
]);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get("url");
  if (!target) {
    return new Response("Missing ?url", { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return new Response("Invalid url", { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return new Response(`Host not allowed: ${parsed.hostname}`, { status: 403 });
  }

  const upstream = await fetch(parsed.toString());
  if (!upstream.ok) {
    return new Response(`Upstream error ${upstream.status}`, {
      status: 502,
    });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
