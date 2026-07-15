"use client";

import { useEffect, useRef, useState } from "react";
import { useCart } from "@/lib/cart";
import type { Restaurant, TableInfo } from "@/lib/menu";
import { effectivePrice } from "@/lib/menu";
import { FLY_EVENT, type FlyOrigin } from "@/lib/flyToCart";

interface CartUIProps {
  restaurant: Restaurant;
  table?: TableInfo;
}

const money = (sym: string, n: number) => `${sym}${n.toFixed(2)}`;

/** Floating cart button + slide-in drawer. Responsive: full-width sheet on
 *  mobile, right-hand drawer on desktop. */
export default function CartUI({ restaurant, table }: CartUIProps) {
  const currencySymbol = restaurant.currencySymbol;
  const { lines, count, subtotal, setQty, remove, clear } = useCart();
  const [open, setOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(false);
  const cartBtnRef = useRef<HTMLButtonElement>(null);

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

    const onFly = (e: Event) => {
      const btn = cartBtnRef.current;
      if (!btn) return;
      const { x: sx, y: sy, label } = (e as CustomEvent<FlyOrigin>).detail;

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
        { duration: 700, easing: "cubic-bezier(.4,.6,.3,1)" }
      );
      anim.onfinish = () => {
        chip.remove();
        bump();
      };
      anim.oncancel = () => chip.remove();
    };

    window.addEventListener(FLY_EVENT, onFly);
    return () => window.removeEventListener(FLY_EVENT, onFly);
  }, []);

  const placeOrder = async () => {
    setPlacing(true);
    try {
      const res = await fetch("/api/flipbook/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant: restaurant.id,
          table: table?.id,
          items: lines.map((l) => ({ itemId: l.item.id, qty: l.qty })),
        }),
      });
      if (!res.ok) throw new Error("order failed");
      clear();
      setPlaced(true);
    } catch {
      alert("Could not place the order. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <>
      {/* Floating cart button */}
      <button
        ref={cartBtnRef}
        onClick={() => {
          setPlaced(false);
          setOpen(true);
        }}
        aria-label="Open cart"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-500 sm:h-16 sm:w-16"
      >
        <svg
          width="24"
          height="24"
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
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs font-bold text-white">
            {count}
          </span>
        )}
      </button>

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative flex h-full w-full max-w-md flex-col bg-white text-slate-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-lg font-semibold">Your order</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {placed ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">
                  ✓
                </div>
                <p className="text-lg font-medium">Order placed!</p>
                <p className="text-sm text-slate-500">
                  This is a mock confirmation — the real order flow comes next.
                </p>
                <button
                  onClick={() => setOpen(false)}
                  className="mt-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
                >
                  Back to menu
                </button>
              </div>
            ) : lines.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-slate-400">
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
                      className="flex items-start gap-3 border-b border-slate-100 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{l.item.name}</p>
                        <p className="text-sm text-slate-500">
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
                          className="text-slate-400 hover:text-rose-500"
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
                      <div className="w-16 text-right font-medium tabular-nums">
                        {money(currencySymbol, effectivePrice(l.item) * l.qty)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-100 px-5 py-4">
                  <div className="mb-3 flex items-center justify-between text-base font-semibold">
                    <span>Subtotal</span>
                    <span className="tabular-nums">
                      {money(currencySymbol, subtotal)}
                    </span>
                  </div>
                  <button
                    onClick={placeOrder}
                    disabled={placing}
                    className="w-full rounded-xl bg-indigo-600 py-3 font-medium text-white transition hover:bg-indigo-500 disabled:opacity-60"
                  >
                    Checkout
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
    <div className="flex items-center rounded-lg border border-slate-200">
      <button
        onClick={() => onChange(qty - 1)}
        aria-label="Decrease"
        className="flex h-8 w-8 items-center justify-center text-lg text-slate-600 hover:bg-slate-50"
      >
        −
      </button>
      <span className="w-7 text-center text-sm tabular-nums">{qty}</span>
      <button
        onClick={() => onChange(qty + 1)}
        aria-label="Increase"
        className="flex h-8 w-8 items-center justify-center text-lg text-slate-600 hover:bg-slate-50"
      >
        +
      </button>
    </div>
  );
}
