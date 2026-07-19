import Link from "next/link";

// The real entry point is /r/{restaurantId}?t={tableId} via a table QR.
// This landing page is just a friendly demo launcher.
export default function Home() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-neutral-200 px-4 py-12 text-center">
      <div className="w-full max-w-xl">
        <h1 className="font-titleFont text-4xl font-bold tracking-tight text-titleColor sm:text-5xl">
          Flipbook Menu
        </h1>
        <p className="mt-3 font-descriptionFont text-disableTextColor">
          Scan a table QR to open that restaurant&apos;s menu as a flipbook, add
          items to your cart, and order.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            href="/restaurant/spice-empire?t=1"
            className="rounded-xl bg-highlightColor px-6 py-3 font-medium text-white transition hover:opacity-90"
          >
            Open Spice Empire menu (Table 1) →
          </Link>
          <p className="mt-1 font-descriptionFont text-xs text-disableTextColor">
            A real QR encodes <code className="text-titleColor">/restaurant/&#123;slug&#125;?t=&#123;table&#125;</code>
          </p>
        </div>
      </div>
    </main>
  );
}
