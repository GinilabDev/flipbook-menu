"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import type { Menu } from "@/lib/menu";
import { CartProvider } from "@/lib/cart";
import MenuExperience from "@/components/MenuExperience";

type Status = "loading" | "ready" | "error";

/**
 * The failures a customer can actually hit, as the API names them, plus the two
 * only the browser can see.
 */
type FailureCode =
  | "not-found"
  | "empty"
  | "unreachable"
  | "offline"
  | "unknown";

interface FailureCopy {
  title: string;
  /** What happened and what to do about it — written for a diner, not a dev. */
  detail: (slug: string) => string;
  /** Whether trying again could plausibly change the answer. */
  retryable: boolean;
  icon: "plug" | "wifi" | "search" | "plate";
}

/**
 * One screen per cause.
 *
 * The whole point of the taxonomy: these ask different things of the person
 * holding the phone. A wrong QR is a question for the waiter and no amount of
 * retrying will fix it; a flat Wi-Fi is theirs to fix; an admin that is down is
 * nobody's fault and worth one more tap. "Could not load the menu." left them
 * to guess between the three.
 */
const FAILURES: Record<FailureCode, FailureCopy> = {
  "not-found": {
    title: "This menu doesn't exist",
    detail: (slug) =>
      `We couldn't find a restaurant for the code “${slug}”. The QR code may be out of date — please ask a member of staff for the current one.`,
    retryable: false,
    icon: "search",
  },
  empty: {
    title: "No dishes to show yet",
    detail: () =>
      "This restaurant hasn't published any items to its menu. Please ask a member of staff to take your order.",
    retryable: true,
    icon: "plate",
  },
  unreachable: {
    title: "The menu is temporarily unavailable",
    detail: () =>
      "We couldn't reach the restaurant's system just now. It's usually back within a moment — try again, or ask a member of staff.",
    retryable: true,
    icon: "plug",
  },
  offline: {
    title: "You're offline",
    detail: () =>
      "Your phone has lost its connection. Reconnect to Wi-Fi or mobile data, then try again.",
    retryable: true,
    icon: "wifi",
  },
  unknown: {
    title: "Something went wrong",
    detail: () =>
      "The menu couldn't be opened. Please try again, or ask a member of staff for a printed menu.",
    retryable: true,
    icon: "plug",
  },
};

const CODES = new Set(Object.keys(FAILURES));

/** A failure carrying which one it was, rather than only a sentence. */
class MenuError extends Error {
  code: FailureCode;
  constructor(code: FailureCode) {
    super(code);
    this.code = code;
  }
}

export default function RestaurantMenuClient() {
  const params = useParams<{ slug: string }>();
  const search = useSearchParams();
  // The QR encodes the restaurant's url slug (or numeric id).
  const restaurant = params.slug;

  const [status, setStatus] = useState<Status>("loading");
  const [menu, setMenu] = useState<Menu | null>(null);
  const [failure, setFailure] = useState<FailureCode>("unknown");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      // Table comes from the QR (?t=); remember it so a refresh keeps context.
      const tableKey = `flipbook.table.${restaurant}`;
      let table = search.get("t") || search.get("table") || "";
      if (table) {
        try {
          localStorage.setItem(tableKey, table);
        } catch {}
      } else {
        try {
          table = localStorage.getItem(tableKey) || "";
        } catch {}
      }

      const qs = new URLSearchParams({ restaurant });
      if (table) qs.set("table", table);

      let res: Response;
      try {
        res = await fetch(`/api/flipbook/menu?${qs.toString()}`);
      } catch {
        // fetch only rejects when the request never got an answer: the device
        // is off the network, or nothing is listening. The browser is the only
        // one who can tell those apart.
        throw new MenuError(
          typeof navigator !== "undefined" && navigator.onLine === false
            ? "offline"
            : "unreachable",
        );
      }

      if (!res.ok) {
        // The route names the cause; anything unrecognised (a proxy's own 502
        // page, say) is still a system we couldn't reach.
        const body = await res.json().catch(() => null);
        const code = body?.code;
        throw new MenuError(
          typeof code === "string" && CODES.has(code)
            ? (code as FailureCode)
            : "unreachable",
        );
      }

      const data: Menu = await res.json().catch(() => null as never);
      if (!data?.restaurant || !Array.isArray(data.items)) {
        throw new MenuError("unreachable");
      }
      setMenu(data);
      setStatus("ready");
    } catch (err) {
      setFailure(err instanceof MenuError ? err.code : "unknown");
      setStatus("error");
    }
  }, [restaurant, search]);

  useEffect(() => {
    load();
  }, [load]);

  // The cart is scoped to the restaurant, so it can only be mounted once we
  // know which restaurant this is.
  if (status === "ready" && menu)
    return (
      <CartProvider restaurantId={menu.restaurant.id}>
        <MenuExperience menu={menu} />
      </CartProvider>
    );

  const copy = FAILURES[failure];

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-neutral-200 px-4 text-center font-titleFont">
      {status === "loading" ? (
        <>
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-neutral-100 border-t-highlightColor" />
          <p className="font-descriptionFont text-sm text-disableTextColor">
            Loading menu…
          </p>
        </>
      ) : (
        <div
          role="alert"
          className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-7 text-titleColor shadow-sm"
        >
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-titleColor">
            <FailureIcon name={copy.icon} />
          </span>
          <h1 className="font-titleFont text-lg font-semibold">{copy.title}</h1>
          <p className="mt-2 font-descriptionFont text-base leading-5 text-disableTextColor">
            {copy.detail(restaurant)}
          </p>
          {copy.retryable && (
            <button
              onClick={load}
              className="mt-5 w-full rounded-xl bg-highlightColor px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 active:scale-[0.98]"
            >
              Try again
            </button>
          )}
        </div>
      )}
    </main>
  );
}

/** A picture of the cause, so the card reads before the words do. */
function FailureIcon({ name }: { name: FailureCopy["icon"] }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-6 w-6",
    "aria-hidden": true,
  };
  if (name === "wifi")
    return (
      <svg {...common}>
        <path d="M2 8.8a16 16 0 0 1 20 0M5 12.5a11 11 0 0 1 14 0M8.5 16.1a6 6 0 0 1 7 0" />
        <path d="M12 20h.01" />
        <path d="m3 3 18 18" />
      </svg>
    );
  if (name === "search")
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    );
  if (name === "plate")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M9 2v6M15 2v6" />
      <path d="M6 8h12v3a6 6 0 0 1-6 6 6 6 0 0 1-6-6V8Z" />
      <path d="M12 17v5" />
    </svg>
  );
}
