# 00 — সামগ্রিক আর্কিটেকচার (QR → data-driven flipbook)

## লক্ষ্য

টেবিলের QR স্ক্যান করে কাস্টমার সেই রেস্টুরেন্টের মেনু ফ্লিপবুক আকারে দেখবে, আইটেমে
ট্যাপ করে কার্টে যোগ করবে, ও অর্ডার দেবে (কোন টেবিল থেকে সেটাসহ)। আইটেমের ছবি/ভিডিও
দেখা যাবে। মোবাইল/ট্যাবলেট/ডেস্কটপ — সব রেসপনসিভ।

## মূল ধারণা

```
[টেবিলের QR]
   │  encodes:  https://menu.tomafood.net/r/{restaurantId}?t={tableId}
   ▼
[Flipbook অ্যাপ /r/[restaurant]]
   │  GET /api/flipbook/menu?restaurant=..&table=..
   ▼
[রেস্টুরেন্টের মেনু-ডেটা: categories + items + media]
   │  layout engine → fixed-slot পেজ (cover → section → items → back)
   ▼
[ফ্লিপবুক টেমপ্লেটে রেন্ডার]  →  আইটেমে ট্যাপ → cart → POST order (table সহ)
```

**PDF নেই।** আইটেম আসল React এলিমেন্ট হিসেবে রেন্ডার হয় (structured data থেকে), তাই
hotspot-detect লাগে না — ক্লিক, media, responsive সব সরাসরি DOM-এ।

## কেন এটা আগের চেয়ে ভালো

- ✅ আইটেম সবসময় নিখুঁত জায়গায় (auto-detect ভুলের ঝুঁকি নেই)।
- ✅ প্রতি রেস্টুরেন্টে নিজের মেনু, একই কোড।
- ✅ ছবি/ভিডিও/দাম/availability সরাসরি ডেটা থেকে — এডমিনে বদলালেই আপডেট।
- ✅ মেনু-ডেটা tomafood DB-তে **আগে থেকেই আছে** (`rcs_recipe`, `rcs_recipe_category`)।

## দুই দিকের দায়িত্ব

**Flipbook অ্যাপ (this repo):**
1. `/r/[restaurant]` রুট + `?t={tableId}` পড়া (+ localStorage-এ table মনে রাখা)।
2. মেনু-ডেটা fetch (mock দিয়ে শুরু)।
3. **Layout engine** (`lib/layout.ts`) — category+item → fixed-slot flipbook পেজ।
4. `FlipbookViewer` শেল রেখে image-এর বদলে **MenuPage** (রেন্ডার করা টেমপ্লেট) ফিড।
5. Item card → cart popup, media lightbox, cart drawer, checkout (টেবিল-সহ)।
6. Mobile: single-page flipbook + "list view" টগল।

**Admin (tomafood-net, CodeIgniter):**
1. একটা **JSON API endpoint** — রেস্টুরেন্টের category+item+media রিটার্ন
   (মূলত বিদ্যমান `rcs_recipe*` টেবিল থেকে; দেখুন [04-data-mapping.md](04-data-mapping.md))।
2. **Table QR** — বিদ্যমান `rcs_restaurant_table` থেকে প্রতি টেবিলের QR জেনারেট/প্রিন্ট।
3. **Video ফিল্ড** — item media-তে ভিডিও লিংক রাখার কলাম (এখন নেই)।
4. **Branding** — রেস্টুরেন্টের রঙ + logo সার্ভ।
5. **Order** — বিদ্যমান order API-তে flipbook থেকে আসা অর্ডার (table-context) যুক্ত।

## মাইলস্টোন

| ধাপ | কাজ | অ্যাপ | অবস্থা |
|---|---|---|---|
| 0 | API contract + data mapping চূড়ান্ত | দুই দল | ⬜ |
| 1 | মেনু-ডেটা টাইপ + mock API | flipbook | ⬜ |
| 2 | Layout engine (fixed-slot pagination) | flipbook | ⬜ |
| 3 | MenuPage টেমপ্লেট + FlipbookViewer-এ যুক্ত | flipbook | ⬜ |
| 4 | Item → cart popup (reuse) + list-view টগল | flipbook | ⬜ |
| 5 | QR রুট `/r/[restaurant]?t=` + table-context | flipbook | ⬜ |
| 6 | Media badge + lightbox | flipbook | ⬜ |
| 7 | Admin: menu JSON API endpoint | admin | ⬜ |
| 8 | Admin: table QR generate/print | admin | ⬜ |
| 9 | Admin: video ফিল্ড + branding | admin | ⬜ |
| 10 | আসল order API যুক্ত | দুই অ্যাপ | ⬜ |

## যা reuse হচ্ছে (আগের কাজ থেকে)

- `FlipbookViewer` book-shell (flip, zoom, sound, sizing, arrows) — থাকছে।
- `lib/cart.tsx`, `components/CartUI.tsx` — থাকছে (order-এ table যুক্ত হবে)।
- item popup, media lightbox প্ল্যান — থাকছে।
- `lib/pdf.ts` + `lib/detect.ts` — মূল ফ্লো থেকে বাদ; ঐচ্ছিক "PDF import" টুল হিসেবে
  এডমিনে recipe seed করতে ব্যবহার করা যেতে পারে।
