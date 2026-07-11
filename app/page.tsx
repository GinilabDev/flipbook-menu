"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FlipbookViewer from "@/components/FlipbookViewer";
import { renderPdf, type RenderResult } from "@/lib/pdf";
import { detectMenu } from "@/lib/detect";
import type { Hotspot, Menu, MenuItem } from "@/lib/menu";

type Status = "loading" | "ready" | "error";

export default function Home() {
  const [status, setStatus] = useState<Status>("loading");
  const [menu, setMenu] = useState<Menu | null>(null);
  const [result, setResult] = useState<RenderResult | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string>("");

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    setProgress({ done: 0, total: 0 });
    try {
      // 1. Fetch the menu descriptor from the (mock) admin API.
      const menuRes = await fetch("/api/menu?restaurant=demo");
      if (!menuRes.ok) throw new Error("Could not load the menu.");
      const menu: Menu = await menuRes.json();
      setMenu(menu);

      // 2. Render the PDF (fetched through our proxy) into page images + text.
      const res = await renderPdf({ url: menu.pdfUrl }, (done, total) =>
        setProgress({ done, total })
      );
      if (res.pages.length === 0) throw new Error("The menu PDF has no pages.");
      setResult(res);

      // 3. Get item hotspots — from the API if provided, else auto-detect.
      if (!menu.autoDetect && menu.hotspots.length > 0) {
        setItems(menu.items);
        setHotspots(menu.hotspots);
      } else {
        const detected = detectMenu(res.pages);
        setItems(detected.items);
        setHotspots(detected.hotspots);
      }

      setStatus("ready");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const itemsById = useMemo(
    () => Object.fromEntries(items.map((it) => [it.id, it])),
    [items]
  );
  const hotspotsByPage = useMemo(() => {
    const map: Record<number, Hotspot[]> = {};
    for (const h of hotspots) (map[h.pageNumber] ??= []).push(h);
    return map;
  }, [hotspots]);

  if (status === "ready" && result && menu) {
    return (
      <FlipbookViewer
        pages={result.pages}
        aspect={result.aspect}
        title={menu.title}
        pdfUrl={menu.pdfUrl}
        onReset={load}
        hotspotsByPage={hotspotsByPage}
        itemsById={itemsById}
        currencySymbol={menu.currencySymbol}
      />
    );
  }

  const pct =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950/40 to-slate-950 px-4 py-12">
      <div className="w-full max-w-xl text-center">
        <div className="mb-8">
          <h1 className="bg-gradient-to-r from-indigo-300 via-white to-indigo-300 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
            {menu?.title ?? "Menu"}
          </h1>
          <p className="mt-3 text-slate-400">
            Tap items in the flipbook to add them to your cart.
          </p>
        </div>

        {status === "loading" && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-10">
            <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-indigo-400" />
            <p className="text-sm text-slate-300">
              {progress.total > 0
                ? `Rendering pages… ${progress.done}/${progress.total}`
                : "Loading menu…"}
            </p>
            <div className="mx-auto mt-4 h-2 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-indigo-400 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-10">
            <p className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
            <button
              onClick={load}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Retry
            </button>
          </div>
        )}

        <p className="mt-8 text-xs text-slate-600">
          Built with Next.js &amp; Tailwind CSS · pdf.js · react-pageflip
        </p>
      </div>
    </main>
  );
}
