// ---------------------------------------------------------------------------
// Menu data contract — the JSON shape shared between the admin panel and this
// flipbook app. The flipbook only ever CONSUMES this shape; how the admin
// produces the hotspots (auto-detect now, manual correction later) is an
// implementation detail on the admin side and never changes this contract.
// ---------------------------------------------------------------------------

/** A rectangle expressed as a fraction (0–1) of the page, origin at top-left.
 *  Using ratios keeps hotspots aligned at any screen size or zoom level. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type MediaType = "image" | "video";

export interface Media {
  type: MediaType;
  url: string;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  description?: string;
  /** future: photo/video shown from the media button next to the item */
  media?: Media[];
}

export interface Hotspot {
  id: string;
  itemId: string;
  /** 1-based page this hotspot sits on */
  pageNumber: number;
  rect: Rect;
}

export interface Menu {
  menuId: string;
  title: string;
  pdfUrl: string;
  currency: string;
  /** ISO 4217-ish symbol used for display */
  currencySymbol: string;
  /** When true (or when hotspots is empty), the flipbook auto-detects items
   *  from the PDF text on the client. The admin API can instead ship explicit
   *  hotspots/items and set this false. */
  autoDetect?: boolean;
  items: MenuItem[];
  hotspots: Hotspot[];
}

export function formatPrice(menu: Pick<Menu, "currencySymbol">, price: number) {
  return `${menu.currencySymbol}${price.toFixed(2)}`;
}
