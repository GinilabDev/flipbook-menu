# API Contract — flipbook ↔ admin

flipbook শুধু এই endpoint দুটো **consume** করে। এখন mock route দিয়ে চলছে
(`app/api/*`); আসল এডমিন API (tomafood.net) ঠিক এই shape রিটার্ন করলে flipbook-এর
কোনো কোড বদলাতে হবে না। সোর্স-অফ-ট্রুথ টাইপ: `lib/menu.ts`।

## GET /api/menu?restaurant={id}

রিটার্ন → `Menu`:

```jsonc
{
  "menuId": "menu_demo",
  "title": "Main Menu",
  "pdfUrl": "/api/pdf-proxy?url=https%3A%2F%2Fbrek-e.co.uk%2Fpdf%2FMain%2520Print%2520me.pdf",
  "currency": "GBP",
  "currencySymbol": "£",
  "autoDetect": true,          // true বা hotspots খালি → client auto-detect করবে
  "items": [
    {
      "id": "it_45",           // স্থায়ী হওয়া উচিত (media এর জন্য জরুরি)
      "name": "Chicken Biryani",
      "price": 8.50,
      "description": "…",
      "media": [               // ঐচ্ছিক — দেখুন 03-media-feature.md
        { "type": "image", "url": "https://cdn.../biryani.jpg", "thumbnail": "…" },
        { "type": "video", "provider": "youtube", "url": "https://youtu.be/abc123" }
      ]
    }
  ],
  "hotspots": [
    {
      "id": "hs_9",
      "itemId": "it_45",
      "pageNumber": 1,          // 1-based
      "rect": { "x": 0.12, "y": 0.34, "w": 0.20, "h": 0.06 }  // পেজের অনুপাত 0–1
    }
  ]
}
```

**নিয়ম:**
- `rect` সবসময় **0–1 অনুপাতে** (top-left origin) — যেকোনো screen/zoom-এ মিলবে।
- `pdfUrl` সরাসরি বা `/api/pdf-proxy?url=…` দিয়ে দেওয়া যায় (CORS এড়াতে)।
- `autoDetect:true` বা `hotspots` খালি হলে flipbook নিজে PDF text থেকে আইটেম detect করে।
  আসল hotspot দিলে `autoDetect:false` দিয়ে `items`+`hotspots` পূরণ করুন।

## POST /api/order

বডি (flipbook যা পাঠায়):

```jsonc
{
  "restaurant": "demo",
  "items": [ { "itemId": "it_45", "qty": 2 } ],
  "customer": { "name": "…", "phone": "…", "table": "…" },   // ঐচ্ছিক (checkout পেজে)
  "note": "…"
}
```

রিটার্ন:

```jsonc
{ "ok": true, "orderId": "…", "status": "received" }
```

## GET /api/pdf-proxy?url={encoded}

external PDF-কে CORS-নিরাপদভাবে stream করে। শুধু whitelisted host
(`brek-e.co.uk`, `tomafood.net`) — `app/api/pdf-proxy/route.ts`-এ তালিকা।
