import Link from "next/link";

// The real entry point is /restaurant/{slug}?t={table} via a table QR — this
// page only exists because something has to answer "/". A customer who lands
// here has no restaurant and no table, so there is nothing to show them but the
// instruction to scan. The dev shortcut below is kept out of production builds:
// in production it would hand any visitor a live menu for one named restaurant,
// on a table they are not sitting at.
const isDev = process.env.NODE_ENV !== "production";

export default function Home() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-neutral-200 px-4 py-12 text-center">
      <div className="w-full max-w-xl">
        <h1 className="font-titleFont text-4xl font-bold tracking-tight text-titleColor sm:text-5xl">
          Flipbook Menu
        </h1>
        <p className="mt-3 font-descriptionFont text-disableTextColor">
          Scan the QR code on your table to open the menu, add items to your
          order, and send it to the kitchen.
        </p>

        {isDev && (
          <div className="mt-8 flex flex-col items-center gap-3">
            <Link
              href="/restaurant/spice-empire?t=1"
              className="rounded-xl bg-highlightColor px-6 py-3 font-medium text-white transition hover:opacity-90"
            >
              Open Spice Empire menu (Table 1) →
            </Link>
            <p className="mt-1 font-descriptionFont text-xs text-disableTextColor">
              Dev only. A real QR encodes{" "}
              <code className="text-titleColor">
                /restaurant/&#123;slug&#125;?t=&#123;table&#125;
              </code>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
