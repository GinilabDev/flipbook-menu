import type { Menu } from "@/lib/menu";

// Demo menu used as a fallback while the tomafood admin endpoint is being built,
// and for local UI development. Shape matches plans/api-contract.md exactly.
export function mockMenu(restaurantId = "demo", tableId?: string): Menu {
  return {
    restaurant: {
      id: restaurantId,
      name: "Toma Food",
      logoUrl: undefined,
      brandColor: "#c1121f",
      currency: "GBP",
      currencySymbol: "£",
    },
    table: tableId ? { id: tableId, name: `Table ${tableId}`, area: "Ground floor" } : undefined,
    categories: [
      { id: "c1", name: "Starters", description: "Begin here", color: "#e63946", sortOrder: 1 },
      { id: "c2", name: "Mains", description: "House favourites", color: "#f77f00", sortOrder: 2 },
      { id: "c3", name: "Biryani & Rice", color: "#606c38", sortOrder: 3 },
      { id: "c4", name: "Desserts", color: "#9d4edd", sortOrder: 4 },
      { id: "c5", name: "Drinks", color: "#0077b6", sortOrder: 5 },
    ],
    items: [
      { id: "i1", name: "Onion Bhaji", price: 4.5, categoryId: "c1", sortOrder: 1, veg: true,
        shortDesc: "Crispy spiced onion fritters", media: [{ type: "image", url: "https://picsum.photos/seed/bhaji/600/400" }] },
      { id: "i2", name: "Chicken Pakora", price: 5.25, categoryId: "c1", sortOrder: 2, hot: true,
        shortDesc: "Marinated chicken, gram-flour batter" },
      { id: "i3", name: "Vegetable Samosa", price: 3.95, categoryId: "c1", sortOrder: 3, veg: true,
        shortDesc: "Two pieces, mint chutney" },
      { id: "i4", name: "Sheek Kebab", price: 5.5, categoryId: "c1", sortOrder: 4,
        shortDesc: "Chargrilled minced lamb skewer" },

      { id: "i5", name: "Chicken Tikka Masala", price: 9.95, categoryId: "c2", sortOrder: 1, hot: true,
        shortDesc: "Creamy tomato, tandoori chicken",
        longDesc: "Our best-seller — tandoori chicken in a rich, mildly spiced tomato and cream sauce.",
        media: [
          { type: "image", url: "https://picsum.photos/seed/tikka/600/400" },
          { type: "video", provider: "youtube", url: "https://youtu.be/dQw4w9WgXcQ" },
        ] },
      { id: "i6", name: "Lamb Rogan Josh", price: 10.5, categoryId: "c2", sortOrder: 2,
        shortDesc: "Slow-cooked lamb, aromatic gravy" },
      { id: "i7", name: "Paneer Butter Masala", price: 8.95, categoryId: "c2", sortOrder: 3, veg: true,
        shortDesc: "Cottage cheese in buttery sauce",
        media: [{ type: "image", url: "https://picsum.photos/seed/paneer/600/400" }] },
      { id: "i8", name: "Fish Curry", price: 11.25, categoryId: "c2", sortOrder: 4, nut: true,
        shortDesc: "Bengal-style mustard fish" },
      { id: "i9", name: "Butter Chicken", price: 9.75, discountPrice: 7.99, categoryId: "c2", sortOrder: 5,
        shortDesc: "On offer this week" },

      { id: "i10", name: "Chicken Biryani", price: 8.5, categoryId: "c3", sortOrder: 1,
        shortDesc: "Fragrant basmati, saffron", media: [{ type: "image", url: "https://picsum.photos/seed/biryani/600/400" }] },
      { id: "i11", name: "Lamb Biryani", price: 9.5, categoryId: "c3", sortOrder: 2 },
      { id: "i12", name: "Vegetable Biryani", price: 7.5, categoryId: "c3", sortOrder: 3, veg: true },
      { id: "i13", name: "Pilau Rice", price: 2.95, categoryId: "c3", sortOrder: 4, veg: true },

      { id: "i14", name: "Gulab Jamun", price: 3.5, categoryId: "c4", sortOrder: 1, veg: true,
        shortDesc: "Warm, syrup-soaked" },
      { id: "i15", name: "Kulfi", price: 3.75, categoryId: "c4", sortOrder: 2, veg: true, nut: true,
        shortDesc: "Pistachio ice cream" },
      { id: "i16", name: "Mango Sorbet", price: 3.25, categoryId: "c4", sortOrder: 3, veg: true },

      { id: "i17", name: "Mango Lassi", price: 2.95, categoryId: "c5", sortOrder: 1, veg: true,
        shortDesc: "Sweet yoghurt drink", media: [{ type: "image", url: "https://picsum.photos/seed/lassi/600/400" }] },
      { id: "i18", name: "Masala Chai", price: 1.95, categoryId: "c5", sortOrder: 2, veg: true },
      { id: "i19", name: "Still Water", price: 1.5, categoryId: "c5", sortOrder: 3, veg: true },
      { id: "i20", name: "Cola", price: 1.75, categoryId: "c5", sortOrder: 4, veg: true },
    ],
  };
}
