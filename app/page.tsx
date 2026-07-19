import Link from "next/link";

// The real entry point is /r/{restaurantId}?t={tableId} via a table QR.
// This landing page is just a friendly demo launcher.
export default function Home() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950/40 to-slate-950 px-4 py-12 text-center">
      <div className="w-full max-w-xl">
        <h1 className="bg-gradient-to-r from-indigo-300 via-white to-indigo-300 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
          Flipbook Menu
        </h1>
        <p className="mt-3 text-slate-400">
          Scan a table QR to open that restaurant&apos;s menu as a flipbook, add
          items to your cart, and order.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            href="/restaurant/spice-empire?t=1"
            className="rounded-xl bg-indigo-600 px-6 py-3 font-medium text-white transition hover:bg-indigo-500"
          >
            Open Spice Empire menu (Table 1) →
          </Link>
          <p className="mt-1 text-xs text-slate-600">
            A real QR encodes <code className="text-slate-400">/restaurant/&#123;slug&#125;?t=&#123;table&#125;</code>
          </p>
        </div>
      </div>
    </main>
  );
}
