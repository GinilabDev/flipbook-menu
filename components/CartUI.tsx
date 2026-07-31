"use client";

import { useEffect, useRef, useState } from "react";
import { useCart } from "@/lib/cart";
import type { Restaurant, TableInfo } from "@/lib/menu";
import { effectivePrice } from "@/lib/menu";
import { FLY_EVENT, type FlyOrigin } from "@/lib/flyToCart";
import { useOverlay } from "@/lib/useOverlay";

interface CartUIProps {
  restaurant: Restaurant;
  table?: TableInfo;
  /** Lets the page know a sheet is up — the book must stop taking arrow keys. */
  onOpenChange?: (open: boolean) => void;
}

const money = (sym: string, n: number) => `${sym}${n.toFixed(2)}`;

/**
 * Identifies one order attempt so a retry can't become a second dinner.
 * `randomUUID` needs a secure context, which a kitchen tablet on plain http
 * over the venue's LAN is not — hence the fallback.
 */
function newOrderKey(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `fb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Floating cart button + slide-in drawer. Responsive: full-width sheet on
 *  mobile, right-hand drawer on desktop. */
export default function CartUI({ restaurant, table, onOpenChange }: CartUIProps) {
  const currencySymbol = restaurant.currencySymbol;
  const { lines, count, subtotal, setQty, remove, clear } = useCart();
  const [open, setOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Spoken by the live region below — "Chicken Korma added". */
  const [announcement, setAnnouncement] = useState("");
  const cartBtnRef = useRef<HTMLButtonElement>(null);
  const orderKeyRef = useRef<string | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useOverlay({
    open,
    onClose: () => setOpen(false),
    containerRef: drawerRef,
    // The drawer, so the order is read out before the close button.
    initialFocusRef: drawerRef,
  });

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  // An order needs a table to go to. Without one the kitchen gets food with
  // nowhere to take it, so browsing and adding stay open but sending does not.
  const canOrder = !!table?.id;

  // A retry must reuse its key (so a timed-out order isn't cooked twice), but
  // an edited cart is a different order and gets a fresh one.
  const linesSignature = lines.map((l) => `${l.item.id}:${l.qty}`).join(",");
  useEffect(() => {
    orderKeyRef.current = null;
    setError(null);
  }, [linesSignature]);

  // "Fly to cart": animate a labelled chip from the add point into the cart
  // button along an arc, then bump the button. Purely visual; the chip is a
  // throwaway DOM node so it survives the popup/card unmounting on add.
  useEffect(() => {
    const bump = () => {
      const btn = cartBtnRef.current;
      if (!btn) return;
      btn.classList.remove("cart-bump");
      void btn.offsetWidth; // restart the keyframes
      btn.classList.add("cart-bump");
    };

    const fly = (detail: FlyOrigin, retry: boolean) => {
      // The animation is invisible to a screen reader, so say what happened.
      if (detail.label) setAnnouncement(`${detail.label} added to your order`);
      const btn = cartBtnRef.current;
      // The button only exists once the cart is non-empty, so on the very first
      // add it is still one render away — wait a frame before giving up.
      if (!btn) {
        if (retry) requestAnimationFrame(() => fly(detail, false));
        return;
      }
      const { x: sx, y: sy, label } = detail;

      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        bump();
        return;
      }

      const r = btn.getBoundingClientRect();
      const dx = r.left + r.width / 2 - sx;
      const dy = r.top + r.height / 2 - sy;

      const chip = document.createElement("div");
      chip.className = "fly-chip";
      chip.textContent = label || "+1";
      chip.style.left = `${sx}px`;
      chip.style.top = `${sy}px`;
      document.body.appendChild(chip);

      const anim = chip.animate(
        [
          { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
          {
            transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${
              dy * 0.5 - 70
            }px)) scale(0.9)`,
            opacity: 1,
            offset: 0.5,
          },
          {
            transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.2)`,
            opacity: 0.35,
          },
        ],
        { duration: 700, easing: "cubic-bezier(.4,.6,.3,1)" },
      );
      anim.onfinish = () => {
        chip.remove();
        bump();
      };
      anim.oncancel = () => chip.remove();
    };

    const onFly = (e: Event) => fly((e as CustomEvent<FlyOrigin>).detail, true);
    window.addEventListener(FLY_EVENT, onFly);
    return () => window.removeEventListener(FLY_EVENT, onFly);
  }, []);

  const placeOrder = async () => {
    if (!canOrder || placing) return;
    setPlacing(true);
    setError(null);
    const idempotencyKey = (orderKeyRef.current ??= newOrderKey());
    try {
      const res = await fetch("/api/flipbook/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant: restaurant.id,
          table: table?.id,
          idempotencyKey,
          items: lines.map((l) => ({ itemId: l.item.id, qty: l.qty })),
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || "");
      orderKeyRef.current = null;
      clear();
      setPlaced(true);
    } catch (err) {
      // Reported in the drawer, next to the button that failed — a native
      // alert() drops the customer out of the restaurant's own UI, and on iOS
      // it can be dismissed before it is read.
      setError(
        (err instanceof Error && err.message) ||
          "Could not send your order. Please try again, or call a member of staff.",
      );
    } finally {
      setPlacing(false);
    }
  };

  return (
    <>
      {/* Adds happen on a page that gives no spoken feedback of its own. */}
      <p aria-live="polite" className="sr-only">
        {announcement}
        {announcement && count > 0
          ? `. ${count} item${count === 1 ? "" : "s"} in your order, ${money(currencySymbol, subtotal)}`
          : ""}
      </p>

      {/* Floating cart button — centred at the foot of the book, and only once
          there is something in the cart: an empty cart has nothing to open, and
          the book now runs edge to edge, so every pixel of chrome covers menu.
          The wrapper owns the centring transform; `cart-bump` animates the
          button's own scale and would otherwise fight it. */}
      {count > 0 && (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
          <button
            ref={cartBtnRef}
            onClick={() => {
              setPlaced(false);
              setOpen(true);
            }}
            aria-label={`Open cart, ${count} item${count === 1 ? "" : "s"}`}
            className="pointer-events-auto flex items-center gap-2.5 rounded-full bg-highlightColor py-3 pl-4 pr-5 text-white shadow-lg shadow-black/25 transition hover:opacity-90"
          >
            <span className="relative flex items-center">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              <span className="absolute -right-2.5 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 font-titleFont text-[11px] font-bold text-white">
                {count}
              </span>
            </span>
            <span className="font-titleFont text-sm font-semibold tabular-nums">
              {money(currencySymbol, subtotal)}
            </span>
          </button>
        </div>
      )}

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Your order"
            tabIndex={-1}
            className="relative flex h-full w-full max-w-md flex-col bg-white text-titleColor shadow-2xl outline-none"
          >
            <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-5 py-4">
              <div className="min-w-0">
                <h2 className="font-titleFont text-lg font-semibold leading-tight">
                  Your order
                </h2>
                <p className="truncate font-descriptionFont text-xs text-disableTextColor">
                  {restaurant.name}
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                {/* Only when the QR carried a table — otherwise we don't know
                    which one, and a wrong number sends food to the wrong seat. */}
                {table?.name && (
                  <span className="rounded-lg bg-highlightColor px-2.5 py-1 font-titleFont text-xs font-bold text-white">
                    {table.name}
                  </span>
                )}
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-disableTextColor hover:bg-neutral-100"
                >
                  ✕
                </button>
              </div>
            </div>

            {placed ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">
                  ✓
                </div>
                <p className="font-titleFont text-lg font-medium">Order placed!</p>
                <p className="font-descriptionFont text-sm text-disableTextColor">
                  Your order has been sent to the kitchen.
                </p>
                <button
                  onClick={() => setOpen(false)}
                  className="mt-2 rounded-xl bg-highlightColor px-5 py-2.5 font-titleFont text-sm font-medium text-white transition hover:opacity-90"
                >
                  Back to menu
                </button>
              </div>
            ) : lines.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center font-descriptionFont text-disableTextColor">
                <p className="text-4xl">🛒</p>
                <p>Your cart is empty.</p>
                <p className="text-sm">Tap an item on the menu to add it.</p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-5 py-3">
                  {lines.map((l) => (
                    <div
                      key={l.item.id}
                      className="flex items-start gap-3 border-b border-neutral-200 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-titleFont font-medium">
                          {l.item.name}
                        </p>
                        <p className="font-titleFont text-sm text-disableTextColor">
                          {money(currencySymbol, effectivePrice(l.item))}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <QtyStepper
                          qty={l.qty}
                          onChange={(q) => setQty(l.item.id, q)}
                        />
                        <button
                          onClick={() => remove(l.item.id)}
                          aria-label="Remove"
                          className="text-disableTextColor hover:text-rose-500"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            role="presentation"
                            focusable="false"
                            fill="currentColor"
                            viewBox="0 0 16 16"
                            className="c-pieIcon c-pieIcon--trash"
                            width="22"
                            height="22"
                          >
                            <path d="M9.864 1.219H6.136L5.49 2.53h5.022z"></path>
                            <path d="M1.875 3.844v1.312h.962l.788 8.243a1.53 1.53 0 0 0 1.523 1.382h5.722a1.53 1.53 0 0 0 1.505-1.382l.779-8.243h.971V3.844zm9.205 9.406a.23.23 0 0 1-.219.201H5.14a.23.23 0 0 1-.219-.201l-.77-8.094h7.7z"></path>
                          </svg>
                        </button>
                      </div>
                      <div className="w-16 text-right font-titleFont font-medium tabular-nums">
                        {money(currencySymbol, effectivePrice(l.item) * l.qty)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-neutral-200 px-5 py-4">
                  <div className="mb-3 flex items-center justify-between font-titleFont text-base font-semibold">
                    <span>Subtotal</span>
                    <span className="tabular-nums">
                      {money(currencySymbol, subtotal)}
                    </span>
                  </div>

                  {error && (
                    <p
                      role="alert"
                      className="mb-3 rounded-lg bg-red-50 px-3 py-2.5 font-descriptionFont text-sm text-red-700"
                    >
                      {error}
                    </p>
                  )}

                  {!canOrder && (
                    <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2.5 font-descriptionFont text-sm text-amber-800">
                      Scan the QR code on your table to send this order — we
                      need to know where to bring it.
                    </p>
                  )}

                  <button
                    onClick={placeOrder}
                    disabled={placing || !canOrder}
                    className="w-full rounded-xl bg-highlightColor py-3 font-titleFont font-medium text-white transition hover:opacity-90 disabled:bg-disableColor disabled:text-disableTextColor disabled:opacity-60"
                  >
                    {placing ? "Sending…" : error ? "Try again" : "Checkout"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function QtyStepper({
  qty,
  onChange,
}: {
  qty: number;
  onChange: (qty: number) => void;
}) {
  return (
    <div className="flex items-center rounded-lg border border-neutral-200 bg-neutral-100">
      <button
        onClick={() => onChange(qty - 1)}
        aria-label="Decrease"
        className="flex h-8 w-8 items-center justify-center rounded-l-lg text-lg text-titleColor hover:bg-neutral-200"
      >
        −
      </button>
      <span className="w-7 text-center font-titleFont text-sm tabular-nums text-titleColor">
        {qty}
      </span>
      <button
        onClick={() => onChange(qty + 1)}
        aria-label="Increase"
        className="flex h-8 w-8 items-center justify-center rounded-r-lg text-lg text-titleColor hover:bg-neutral-200"
      >
        +
      </button>
    </div>
  );
}
