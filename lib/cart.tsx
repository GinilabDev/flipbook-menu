"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { MenuItem } from "@/lib/menu";
import { effectivePrice } from "@/lib/menu";

export interface CartLine {
  item: MenuItem;
  qty: number;
}

interface CartState {
  /**
   * Storage key the `lines` were loaded from, or null before the first load.
   * Carried in state rather than a ref so the persist effect can tell "this
   * cart belongs to the restaurant on screen" from "this is the previous
   * restaurant's cart, about to be replaced" — writing the latter under the new
   * key is exactly the cross-restaurant leak this scoping exists to stop.
   */
  key: string | null;
  lines: Record<string, CartLine>;
}

type Action =
  | { type: "add"; item: MenuItem; qty?: number }
  | { type: "setQty"; itemId: string; qty: number }
  | { type: "remove"; itemId: string }
  | { type: "clear" }
  | { type: "hydrate"; key: string; lines: Record<string, CartLine> };

/**
 * One cart per restaurant. The v1 key was global, so scanning a second
 * restaurant's QR carried the first one's items over — and an order placed from
 * that cart sends the kitchen dishes it has never heard of.
 */
const storageKeyFor = (restaurantId: string) => `flipbook.cart.v2.${restaurantId}`;
/** Pre-scoping key. Dropped, not migrated — see loadLines(). */
const LEGACY_STORAGE_KEY = "flipbook.cart.v1";

function reducer(state: CartState, action: Action): CartState {
  switch (action.type) {
    case "add": {
      const existing = state.lines[action.item.id];
      const qty = (existing?.qty ?? 0) + (action.qty ?? 1);
      return {
        ...state,
        lines: { ...state.lines, [action.item.id]: { item: action.item, qty } },
      };
    }
    case "setQty": {
      const existing = state.lines[action.itemId];
      if (!existing) return state;
      if (action.qty <= 0) {
        const next = { ...state.lines };
        delete next[action.itemId];
        return { ...state, lines: next };
      }
      return {
        ...state,
        lines: {
          ...state.lines,
          [action.itemId]: { ...existing, qty: action.qty },
        },
      };
    }
    case "remove": {
      const next = { ...state.lines };
      delete next[action.itemId];
      return { ...state, lines: next };
    }
    case "clear":
      return { ...state, lines: {} };
    case "hydrate":
      return { key: action.key, lines: action.lines };
    default:
      return state;
  }
}

/**
 * Read one restaurant's stored cart. Anything unreadable is treated as empty —
 * a half-parsed cart is worse than none.
 *
 * The legacy global cart is deleted rather than migrated: it may well have been
 * filled at a different restaurant, and there is nothing in it saying which. A
 * customer losing an unsent cart is a small cost; inheriting someone else's
 * dishes is the bug.
 */
function loadLines(key: string): Record<string, CartLine> {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CartState | null;
    return parsed?.lines && typeof parsed.lines === "object" ? parsed.lines : {};
  } catch {
    return {};
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

/**
 * Per-item quantities, published as a subscribable store rather than as context
 * state.
 *
 * A menu page holds hundreds of cards, and each one shows how many of ITS item
 * are in the order. Through context, adding one dish re-renders every card on
 * every page — measured at 800+ DOM mutations for a single tap. Here a card
 * subscribes to its own id, so adding a dish repaints that dish's badge.
 */
interface QtyStore {
  subscribe: (listener: () => void) => () => void;
  getQty: (itemId: string) => number;
}

const QtyStoreContext = createContext<QtyStore | null>(null);

export function CartProvider({
  restaurantId,
  children,
}: {
  /** Scopes the cart. The API's restaurant id, not the URL slug — two slugs
   *  pointing at the same restaurant should share one cart. */
  restaurantId: string;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, { key: null, lines: {} });
  const storageKey = storageKeyFor(restaurantId);

  // Load this restaurant's cart.
  useEffect(() => {
    dispatch({ type: "hydrate", key: storageKey, lines: loadLines(storageKey) });
  }, [storageKey]);

  // Persist on change — but only once `state` is this restaurant's own cart.
  useEffect(() => {
    if (state.key !== storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ lines: state.lines }));
    } catch {
      /* storage full / unavailable — ignore */
    }
  }, [state, storageKey]);

  // ---- per-item quantity store ----
  // The lines are mirrored into a ref so `getQty` can be a stable function that
  // still reads current data, and subscribers are notified after each commit.
  const linesRef = useRef(state.lines);
  const qtyListeners = useRef(new Set<() => void>());
  const qtyStore = useMemo<QtyStore>(
    () => ({
      subscribe: (listener) => {
        qtyListeners.current.add(listener);
        return () => {
          qtyListeners.current.delete(listener);
        };
      },
      getQty: (itemId) => linesRef.current[itemId]?.qty ?? 0,
    }),
    [],
  );
  useEffect(() => {
    linesRef.current = state.lines;
    qtyListeners.current.forEach((l) => l());
  }, [state.lines]);

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
      <QtyStoreContext.Provider value={qtyStore}>
        <CartContext.Provider value={value}>{children}</CartContext.Provider>
      </QtyStoreContext.Provider>
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
 *
 * Subscribes to just this id, so a card only re-renders when ITS quantity
 * changes, not when anything at all happens to the order.
 */
export function useItemQty(itemId: string): number {
  const store = useContext(QtyStoreContext);
  if (!store) throw new Error("useItemQty must be used within <CartProvider>");
  return useSyncExternalStore(
    store.subscribe,
    () => store.getQty(itemId),
    () => 0,
  );
}
