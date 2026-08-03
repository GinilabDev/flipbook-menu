import type { Metadata, Viewport } from "next";
import { fetchMenu } from "@/lib/menu-source";
import { mediaUrl } from "@/lib/config";
import RestaurantMenuClient from "./RestaurantMenuClient";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * The menu itself still loads client-side (the table can come from
 * localStorage, not just the QR's ?t=), so this only reads what the title bar
 * needs. Both this and generateViewport share one cached fetch.
 */
async function menuForMeta({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const table = first(sp.t) || first(sp.table);
  try {
    // Metadata has no way to show an error, so a failure here is simply a page
    // with a generic title — the client below is what explains it.
    const result = await fetchMenu(slug, table, {
      revalidate: 30,
      brandingOnly: true,
    });
    return result.ok ? result.menu : null;
  } catch {
    return null;
  }
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const menu = await menuForMeta(props);
  if (!menu) return { title: "Menu" };

  const r = menu.restaurant;
  const where = menu.table?.name ? ` · ${menu.table.name}` : "";
  const place = [r.address?.city, r.address?.postcode].filter(Boolean).join(", ");
  const description = menu.table?.name
    ? `Browse the menu and order from ${menu.table.name} at ${r.name}${place ? `, ${place}` : ""}.`
    : `Browse the menu at ${r.name}${place ? `, ${place}` : ""} and order from your table.`;

  const icon = r.logoUrl ? mediaUrl(r.logoUrl) : undefined;
  const title = `${r.name} — Menu${where}`;

  return {
    title,
    description,
    icons: icon ? { icon, apple: icon } : undefined,
    openGraph: {
      title,
      description,
      siteName: r.name,
      type: "website",
      images: icon ? [{ url: icon }] : undefined,
    },
    twitter: { card: "summary", title, description },
    robots: { index: false },
  };
}

/** Paints the phone's browser chrome in the restaurant's own colour. */
export async function generateViewport(props: PageProps): Promise<Viewport> {
  const menu = await menuForMeta(props);
  return { themeColor: menu?.restaurant.brandColor || "#f36805" };
}

export default function RestaurantMenuPage() {
  return <RestaurantMenuClient />;
}
