"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import type { Menu } from "@/lib/menu";
import MenuExperience from "@/components/MenuExperience";

type Status = "loading" | "ready" | "error";

export default function RestaurantMenuPage() {
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

  if (status === "ready" && menu) return <MenuExperience menu={menu} />;

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-950 px-4 text-center">
      {status === "loading" ? (
        <>
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-indigo-400" />
          <p className="text-sm text-slate-400">Loading menu…</p>
        </>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
          <p className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
          <button
            onClick={load}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Retry
          </button>
        </div>
      )}
    </main>
  );
}
