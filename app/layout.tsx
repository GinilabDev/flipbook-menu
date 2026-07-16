import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/lib/cart";

// Fallback only — /restaurant/[slug] overrides these per restaurant via
// generateMetadata, so a scanned QR names the actual restaurant and table.
export const metadata: Metadata = {
  title: "Flipbook Menu",
  description: "Scan the code at your table to browse the menu and order.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
