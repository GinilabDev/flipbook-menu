// Central config. The flipbook always calls its OWN /api/flipbook/* routes,
// which proxy to the tomafood admin API below.
//
// Both hosts are environment-driven, defaulting to the local Laragon setup so
// `npm run dev` works with no .env file at all. See .env.example.

/** Trailing slashes off, so the joins below never produce `//`. */
const trimEnd = (url: string) => url.replace(/\/+$/, "");

/** tomafood admin API base, e.g. http://localhost/tomafood-net/api/v2 */
export const ADMIN_API_BASE = trimEnd(
  process.env.ADMIN_API_BASE || "http://localhost/tomafood-net/api/v2",
);

/**
 * Web root that recipe media paths are relative to. The admin API returns raw
 * paths like `/images/recipe_images/x.png`, served from the tomafood web root.
 *
 * NEXT_PUBLIC_ because `mediaUrl` runs in the browser too (item thumbnails, the
 * header logo); a server-only variable would compile to `undefined` there. Set
 * it to the same origin as the admin API — and over **https** in production,
 * since a page served over https cannot load http images (mixed content).
 */
export const MEDIA_BASE_URL = trimEnd(
  process.env.NEXT_PUBLIC_MEDIA_BASE_URL || "http://localhost/tomafood-net",
);

/**
 * Resolve a media path to a full URL. Absolute URLs (http/https — e.g. YouTube,
 * Vimeo, or already-absolute image links) pass through unchanged; relative admin
 * paths get `MEDIA_BASE_URL` prepended.
 */
export function mediaUrl(path?: string | null): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${MEDIA_BASE_URL}/${path.replace(/^\/+/, "")}`;
}

/**
 * Flipbook paths on the admin API. Branding and menu data are separate
 * endpoints — the restaurant payload is tiny and paints the cover/chrome, the
 * menu is the big one.
 */
export const ADMIN_RESTAURANT_PATH = "/flipbook/restaurant";
export const ADMIN_MENU_PATH = "/flipbook/menu";
export const ADMIN_ORDER_PATH = "/flipbook/order";
