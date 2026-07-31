import type { Metadata } from "next";
import "./globals.css";

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
    // The cart provider is NOT here: a cart belongs to one restaurant, and this
    // layout has no idea which one is on screen. It is mounted per restaurant
    // in app/restaurant/[slug]/RestaurantMenuClient.tsx.
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
