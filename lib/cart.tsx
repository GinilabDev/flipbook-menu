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

/** Mutating the cart. Stable for the provider's whole life — see below. */
interface CartActions {
  add: (item: MenuItem, qty?: number) => void;
  setQty: (itemId: string, qty: number) => void;
  remove: (itemId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
/**
 * Actions live in their own context so that adding an item doesn't hand every
 * consumer a new `add`/`setQty`. That matters more than it looks: the flipbook
 * passes these handlers down into its page elements, and react-pageflip tears
 * the whole book's DOM down and rebuilds it whenever those elements change
 * identity — mid-flip, that reads as the page snapping backwards.
 */
const CartActionsContext = createContext<CartActions | null>(null);

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

  // `dispatch` never changes, so neither do these.
  const actions = useMemo<CartActions>(
    () => ({
      add: (item, qty) => dispatch({ type: "add", item, qty }),
      setQty: (itemId, qty) => dispatch({ type: "setQty", itemId, qty }),
      remove: (itemId) => dispatch({ type: "remove", itemId }),
      clear: () => dispatch({ type: "clear" }),
    }),
    [],
  );

  const value = useMemo<CartContextValue>(() => {
    const lines = Object.values(state.lines);
    return {
      lines,
      count: lines.reduce((n, l) => n + l.qty, 0),
      subtotal: lines.reduce((s, l) => s + effectivePrice(l.item) * l.qty, 0),
      ...actions,
      qtyOf: (itemId) => state.lines[itemId]?.qty ?? 0,
    };
  }, [state, actions]);

  return (
    <CartActionsContext.Provider value={actions}>
      <CartContext.Provider value={value}>{children}</CartContext.Provider>
    </CartActionsContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within <CartProvider>");
  return ctx;
}

/** Just the mutators — the reference never changes, so it is safe to hold. */
export function useCartActions(): CartActions {
  const ctx = useContext(CartActionsContext);
  if (!ctx) throw new Error("useCartActions must be used within <CartProvider>");
  return ctx;
}

/**
 * How many of one item are in the cart. Read here, inside the card, rather than
 * threaded down from the page — a card can then update its badge without the
 * page above it re-rendering (and rebuilding the book's DOM).
 */
export function useItemQty(itemId: string): number {
  return useCart().qtyOf(itemId);
}
