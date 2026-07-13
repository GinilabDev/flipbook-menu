# API Contract — flipbook ↔ admin (tomafood-net)

flipbook এই endpoint গুলো **consume** করে। এখন mock; আসল tomafood API একই shape
রিটার্ন করলে flipbook কোড বদলাবে না। টেবিল→JSON: [04-data-mapping.md](04-data-mapping.md)।

## GET /api/v2/flipbook/menu?restaurant={id}&table={tableId}

```jsonc
{
  "restaurant": {
    "id": "42",
    "name": "Toma Food",
    "logoUrl": "https://cdn.tomafood.net/logo/42.png",
    "brandColor": "#c1121f",
    "currency": "GBP",
    "currencySymbol": "£"
  },
  "table": { "id": "7", "name": "Table 7", "area": "Ground floor" },  // ঐচ্ছিক
  "categories": [
    { "id": "3", "name": "Starters", "description": "…", "color": "#e63946", "sortOrder": 1 }
  ],
  "items": [
    {
      "id": "1201",                 // rcs_recipe.id — স্থায়ী
      "name": "Chicken Biryani",
      "shortDesc": "…",
      "longDesc": "…",
      "price": 8.50,                // out_price
      "discountPrice": 0,           // > 0 হলে কাটা-দাম
      "categoryId": "3",
      "subcategoryId": "0",
      "sortOrder": 2,
      "veg": false, "hot": true, "nut": false,
      "media": [
        { "type": "image", "url": "https://cdn.../1201.jpg", "thumbnail": "..." },
        { "type": "video", "provider": "youtube", "url": "https://youtu.be/abc" }
      ]
    }
  ]
}
```

**নিয়ম:**
- আইটেম `categoryId` দিয়ে ক্যাটাগরিতে গ্রুপ হয়; layout engine ফ্লিপবুক পেজে সাজায়।
- `sortOrder` মেনে ক্রম; শুধু available আইটেম।
- `table` থাকলে dine-in context; না থাকলে সাধারণ ভিউ।

## POST /api/v2/flipbook/order

বডি:
```jsonc
{
  "restaurant": "42",
  "table": "7",
  "items": [
    { "itemId": "1201", "qty": 2, "options": [] }
  ],
  "note": "extra spicy",
  "customer": { "name": "…", "phone": "…" }   // dine-in-এ ঐচ্ছিক
}
```
রিটার্ন:
```jsonc
{ "ok": true, "orderId": "...", "status": "received" }
```

## নোট
- endpoint পাবলিক (QR স্ক্যান) — read-only menu ডেটা, সংবেদনশীল কিছু নয়।
- CORS: flipbook ডোমেইন allow, নয়তো flipbook-এ proxy রুট।
- আগের `Menu/Hotspot/Rect/pdfUrl` shape **বাতিল** — নতুন shape এটি।
