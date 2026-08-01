"use client";

/**
 * Placeholders shown while a view mounts. Switching to the flipbook is the
 * jumpy one — react-pageflip loads client-side and the book only gets its real
 * size after the stage is measured — so we cover that first paint instead of
 * letting the user watch it snap into place. The list gets a matching skeleton
 * so both directions of the toggle feel the same.
 */

import type { Restaurant } from "@/lib/menu";
import { readableOn } from "@/lib/accent";

const shimmer = "animate-pulse rounded bg-neutral-300/70";

/**
 * The book always opens on the cover, so that is what stands in for it — a
 * spread of blank item rows was a placeholder for a page the reader never sees
 * first. The brand colour is already known by the time this shows (the menu has
 * loaded; it is the book that is still mounting), so the placeholder is the
 * right colour from the start and only its contents fade in.
 *
 * Sized like the closed book in FlipbookViewer: one page wide, centred on a
 * spread — see its `offsetFor`.
 */
function CoverSkeleton({
  portrait,
  restaurant,
}: {
  portrait: boolean;
  restaurant?: Restaurant;
}) {
  const bg = restaurant?.brandColor || "#262626";
  const fg = readableOn(bg);
  // Bars are drawn in the cover's own text colour — a grey shimmer on a brand
  // colour reads as a rendering fault rather than as loading.
  const bar = (className: string, opacity = 0.18) => (
    <div
      className={`animate-pulse rounded ${className}`}
      style={{ background: fg, opacity }}
    />
  );

  return (
    <div className="flex h-full w-full justify-center bg-neutral-200">
      <div
        className={`flex h-full flex-col items-center justify-center gap-4 p-8 shadow-book ${
          portrait ? "w-full" : "w-1/2"
        }`}
        style={{ background: bg }}
      >
        {/* logo, name, and the rule under it — the rule carries no data, so it
            is drawn for real rather than as a bar. */}
        {bar("h-16 w-40 max-w-[70%] rounded-lg")}
        {bar("h-7 w-56 max-w-[80%]", 0.24)}
        <span
          className="h-[3px] w-14 rounded-full"
          style={{
            background: restaurant?.highlightColor || fg,
            opacity: 0.9,
          }}
        />
        {bar("h-3 w-44 max-w-[75%]")}
        {bar("h-3 w-36 max-w-[65%]")}
        {bar("h-3.5 w-28", 0.22)}
        <div className="mt-5 flex flex-col items-center gap-2">
          {bar("h-3.5 w-52 max-w-[80%]", 0.14)}
          {bar("h-3 w-40 max-w-[70%]", 0.1)}
        </div>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl px-3 pb-28 pt-4">
      {Array.from({ length: 2 }).map((_, s) => (
        <section key={s} className="mb-6">
          <div className="border-b-2 border-neutral-200 py-2">
            <div className={`${shimmer} h-5 w-40`} />
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-[10px] border border-neutral-200 bg-white p-3 shadow-sm"
              >
                <div className={`${shimmer} h-16 w-16 flex-shrink-0 rounded-lg`} />
                <div className="flex-1 space-y-2">
                  <div className={`${shimmer} h-3.5 w-2/3`} />
                  <div className={`${shimmer} h-2.5 w-1/2`} />
                  <div className={`${shimmer} h-2.5 w-1/4`} />
                </div>
                <div className={`${shimmer} h-8 w-8 flex-shrink-0 rounded-full`} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function ViewSkeleton({
  mode,
  portrait = false,
  restaurant,
}: {
  mode: "flip" | "list";
  portrait?: boolean;
  /** brand colours for the cover placeholder */
  restaurant?: Restaurant;
}) {
  return mode === "flip" ? (
    <CoverSkeleton portrait={portrait} restaurant={restaurant} />
  ) : (
    <ListSkeleton />
  );
}
