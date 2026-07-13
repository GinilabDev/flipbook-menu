// Central config. The flipbook always calls its OWN /api/flipbook/* routes,
// which proxy to the tomafood admin API below (with a mock fallback while the
// real endpoint is being built).

/** tomafood admin API base, e.g. http://localhost/tomafood-net/api */
export const ADMIN_API_BASE =
  process.env.ADMIN_API_BASE?.replace(/\/+$/, "") ??
  "http://localhost/tomafood-net/api";

export const file_url = "http://localhost/tomafood-net";

/** Flipbook path on the admin API. */
export const ADMIN_MENU_PATH = "/v2/flipbook/menu";
export const ADMIN_ORDER_PATH = "/v2/flipbook/order";

/** When true, skip the admin call and always serve mock data. */
export const USE_MOCK = process.env.USE_MOCK === "1";
