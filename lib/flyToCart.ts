// Tiny event bridge for the "fly to cart" animation. The caller (item popup)
// emits the origin point + label; CartUI listens and animates a chip from there
// into the floating cart button, then bumps the button. Kept as a window event
// so the animation survives the popup unmounting on add.

export interface FlyOrigin {
  /** viewport x of the animation start (client coords) */
  x: number;
  /** viewport y of the animation start (client coords) */
  y: number;
  /** text shown on the flying chip (usually the item name) */
  label?: string;
}

export const FLY_EVENT = "flipbook:fly-to-cart";

export function flyToCart(origin: FlyOrigin): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<FlyOrigin>(FLY_EVENT, { detail: origin }));
}
