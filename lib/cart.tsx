"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import type { MenuItem } from "@/lib/menu";
import { effectivePrice } from "@/lib/menu";

export interface CartLine {
  item: MenuItem;
  qty: number;
}

interface CartState {
  lines: Record<string, CartLine>;
}

type Action =
  | { type: "add"; item: MenuItem; qty?: number }
  | { type: "setQty"; itemId: string; qty: number }
  | { type: "remove"; itemId: string }
  | { type: "clear" }
  | { type: "hydrate"; state: CartState };

const STORAGE_KEY = "flipbook.cart.v1";

function reducer(state: CartState, action: Action): CartState {
  switch (action.type) {
    case "add": {
      const existing = state.lines[action.item.id];
      const qty = (existing?.qty ?? 0) + (action.qty ?? 1);
      return {
        lines: { ...state.lines, [action.item.id]: { item: action.item, qty } },
      };
    }
    case "setQty": {
      const existing = state.lines[action.itemId];
      if (!existing) return state;
      if (action.qty <= 0) {
        const next = { ...state.lines };
        delete next[action.itemId];
        return { lines: next };
      }
      return {
        lines: {
          ...state.lines,
          [action.itemId]: { ...existing, qty: action.qty },
        },
      };
    }
    case "remove": {
      const next = { ...state.lines };
      delete next[action.itemId];
      return { lines: next };
    }
    case "clear":
      return { lines: {} };
    case "hydrate":
      return action.state;
    default:
      return state;
  }
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (item: MenuItem, qty?: number) => void;
  setQty: (itemId: string, qty: number) => void;
  remove: (itemId: string) => void;
  clear: () => void;
  qtyOf: (itemId: string) => number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { lines: {} });

  // Load persisted cart once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "hydrate", state: JSON.parse(raw) });
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  // Persist on change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full / unavailable — ignore */
    }
  }, [state]);

  const value = useMemo<CartContextValue>(() => {
    const lines = Object.values(state.lines);
    return {
      lines,
      count: lines.reduce((n, l) => n + l.qty, 0),
      subtotal: lines.reduce((s, l) => s + effectivePrice(l.item) * l.qty, 0),
      add: (item, qty) => dispatch({ type: "add", item, qty }),
      setQty: (itemId, qty) => dispatch({ type: "setQty", itemId, qty }),
      remove: (itemId) => dispatch({ type: "remove", itemId }),
      clear: () => dispatch({ type: "clear" }),
      qtyOf: (itemId) => state.lines[itemId]?.qty ?? 0,
    };
  }, [state]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within <CartProvider>");
  return ctx;
}
