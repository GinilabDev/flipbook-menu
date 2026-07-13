// Central config. The flipbook always calls its OWN /api/flipbook/* routes,
// which proxy to the tomafood admin API below (with a mock fallback while the
// real endpoint is being built).

/** tomafood admin API base, e.g. http://localhost/tomafood-net/api */
export const ADMIN_API_BASE =
  process.env.ADMIN_API_BASE?.replace(/\/+$/, "") ??
  "http://localhost/tomafood-net/api";

/**
 * Web root that recipe media paths are relative to. The admin API returns raw
 * paths like `/images/recipe_images/x.png`, served from the tomafood web root.
 */
export const file_url = "http://localhost/tomafood-net";

/**
 * Resolve a media path to a full URL. Absolute URLs (http/https — e.g. YouTube,
 * Vimeo, or already-absolute image links) pass through unchanged; relative admin
 * paths get `file_url` prepended.
 */
export function mediaUrl(path?: string | null): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${file_url}/${path.replace(/^\/+/, "")}`;
}

/** Flipbook path on the admin API. */
export const ADMIN_MENU_PATH = "/v2/flipbook/menu";
export const ADMIN_ORDER_PATH = "/v2/flipbook/order";

/** When true, skip the admin call and always serve mock data. */
export const USE_MOCK = process.env.USE_MOCK === "1";
