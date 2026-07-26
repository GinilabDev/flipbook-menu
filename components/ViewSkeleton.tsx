"use client";

/**
 * Placeholders shown while a view mounts. Switching to the flipbook is the
 * jumpy one — react-pageflip loads client-side and the book only gets its real
 * size after the stage is measured — so we cover that first paint instead of
 * letting the user watch it snap into place. The list gets a matching skeleton
 * so both directions of the toggle feel the same.
 */

const shimmer = "animate-pulse rounded bg-neutral-300/70";

function PageSkeleton() {
  return (
    <div className="flex h-full min-w-0 flex-1 basis-0 flex-col gap-4 overflow-hidden bg-white p-6 shadow-book">
      <div className={`${shimmer} h-6 w-1/2 self-center`} />
      <div className={`${shimmer} h-3 w-1/3 self-center`} />
      <div className="mt-4 flex flex-1 flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`${shimmer} h-12 w-12 flex-shrink-0 rounded-lg`} />
            <div className="flex-1 space-y-2">
              <div className={`${shimmer} h-3 w-3/4`} />
              <div className={`${shimmer} h-2.5 w-1/2`} />
            </div>
            <div className={`${shimmer} h-3 w-10 flex-shrink-0`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function FlipSkeleton({ portrait }: { portrait: boolean }) {
  // Edge to edge, like the book it stands in for — anything smaller would show
  // the placeholder resizing into place, which is what it exists to hide.
  return (
    <div className="flex h-full w-full bg-neutral-200">
      <PageSkeleton />
      {!portrait && <PageSkeleton />}
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
}: {
  mode: "flip" | "list";
  portrait?: boolean;
}) {
  return mode === "flip" ? <FlipSkeleton portrait={portrait} /> : <ListSkeleton />;
}
