"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import type { Menu } from "@/lib/menu";
import { CartProvider } from "@/lib/cart";
import MenuExperience from "@/components/MenuExperience";

type Status = "loading" | "ready" | "error";

export default function RestaurantMenuClient() {
  const params = useParams<{ slug: string }>();
  const search = useSearchParams();
  // The QR encodes the restaurant's url slug (or numeric id).
  const restaurant = params.slug;

  const [status, setStatus] = useState<Status>("loading");
  const [menu, setMenu] = useState<Menu | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
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
      const res = await fetch(`/api/flipbook/menu?${qs.toString()}`);
      if (!res.ok) throw new Error("Could not load the menu.");
      const data: Menu = await res.json();
      if (!data?.restaurant || !Array.isArray(data.items)) {
        throw new Error("Menu is unavailable right now.");
      }
      setMenu(data);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
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

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-neutral-200 px-4 text-center font-titleFont">
      {status === "loading" ? (
        <>
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-neutral-100 border-t-highlightColor" />
          <p className="font-descriptionFont text-sm text-disableTextColor">Loading menu…</p>
        </>
      ) : (
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-titleColor">
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 font-descriptionFont text-sm text-red-700">
            {error}
          </p>
          <button
            onClick={load}
            className="rounded-xl bg-highlightColor px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            Retry
          </button>
        </div>
      )}
    </main>
  );
}
