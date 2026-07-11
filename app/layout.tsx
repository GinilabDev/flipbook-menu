import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/lib/cart";

export const metadata: Metadata = {
  title: "FlipBook — PDF to Flipbook",
  description:
    "Upload a PDF and view it as a realistic page-flipping flipbook. Built with Next.js & Tailwind CSS.",
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
