# Flipbook Menu — QR ভিত্তিক ডিজিটাল রেস্টুরেন্ট মেনু

টেবিলের QR স্ক্যান করলে ওই রেস্টুরেন্টের মেনু একটি **ফ্লিপবুক** হিসেবে খোলে —
গ্রাহক পেজ উল্টে আইটেম দেখেন, কার্টে যোগ করেন, এবং টেবিল থেকেই অর্ডার পাঠান।

মেনু **tomafood admin API থেকে data হিসেবে** আসে (PDF নয়) — প্রতিটি আইটেম আসল
DOM element, তাই দাম, ব্যাজ ও ছবি সবই লাইভ ডেটা থেকে রেন্ডার হয়।

## Tech Stack

- **Next.js 16** (App Router, Turbopack)
- **React 19** · **TypeScript 5.7** (`strict`)
- **Tailwind CSS 3**
- **react-pageflip** — বইয়ের মতো পেজ উল্টানো
- **react-icons**

## Getting Started

```bash
npm install
npm run dev          # http://localhost:3000
```

`.env` ছাড়াই dev চলে — ডিফল্ট মান লোকাল Laragon সেটআপের দিকে নির্দেশ করে
(`http://localhost/tomafood-net`)। ভিন্ন হোস্ট হলে:

```bash
cp .env.example .env.local
```

| Variable | কোথায় ব্যবহৃত | মন্তব্য |
|---|---|---|
| `ADMIN_API_BASE` | server only | tomafood admin API base, `/v2` সহ |
| `NEXT_PUBLIC_MEDIA_BASE_URL` | server + browser | লোগো ও রেসিপি ছবির web root। **production-এ অবশ্যই https** — নইলে mixed content হিসেবে ব্লক হবে |

## Routes

| Route | কী |
|---|---|
| `/restaurant/{slug}?t={table}` | **আসল entry point** — টেবিলের QR এটিই এনকোড করে। `slug` = রেস্টুরেন্টের `url` কলাম অথবা numeric id। টেবিল `localStorage`-এ মনে রাখা হয়, তাই refresh করলেও context থাকে |
| `/` | শুধু "টেবিলের QR স্ক্যান করুন" বার্তা (dev বিল্ডে একটি shortcut link থাকে) |
| `/api/flipbook/menu` | admin API-তে proxy — branding + menu একসাথে merge করে |
| `/api/flipbook/order` | অর্ডার admin API-তে পাঠায় |

অ্যাডমিন API অচল থাকলে **কোনো demo/mock মেনু দেখানো হয় না** — ইচ্ছাকৃত সিদ্ধান্ত।
রান্নাঘর যে দামে রাজি হয়নি সেই দাম দেখানোর চেয়ে সৎ error ভালো।

## Project Structure

```
app/
  layout.tsx                     root layout — CartProvider
  page.tsx                       "scan the QR" landing
  api/flipbook/menu|order/       admin API proxy routes
  restaurant/[slug]/
    page.tsx                     server component — per-restaurant metadata + theme colour
    RestaurantMenuClient.tsx     client — table resolve + menu fetch + loading/error
components/
  MenuExperience.tsx             top level: view toggle, popup, lightbox, cart
  FlipbookViewer.tsx             react-pageflip wrapper, sizing/scale, navigation
  MenuPage.tsx                   cover / section / back page + subcategory accordion
  ItemCard.tsx                   item card (list + compact) + dietary badges
  CartUI.tsx                     floating cart button, drawer, place order
  CategoryModal.tsx  ItemPopup.tsx  ListView.tsx  MediaLightbox.tsx  ViewSkeleton.tsx
lib/
  menu.ts        data contract + pure helpers (pricing, grouping, ordering)
  layout.ts      layout engine — এক category = ঠিক এক page
  cart.tsx       cart state (reducer + localStorage)
  menu-source.ts server-side admin fetch (restaurant + menu, parallel)
  config.ts      env-driven hosts + mediaUrl()
  accent.ts      category accent colour   ·   flyToCart.ts  add-to-cart animation
plans/           architecture notes, API contract, product audit
```

### তিনটি নকশার সিদ্ধান্ত, যা না জানলে কোড বিভ্রান্তিকর লাগবে

1. **পেজ একটি স্থির design space-এ আঁকা হয় (`400 × 556` px)**, তারপর viewer
   `scale = stageHeight / 556` দিয়ে স্ক্রিনে বসায় — এ কারণেই ফোন আর ডেস্কটপে
   টাইপোগ্রাফি একই অনুপাতে থাকে।
2. **এক category = ঠিক এক page** (`lib/layout.ts`)। লম্বা category পেজের ভেতরেই
   স্ক্রল করে, দ্বিতীয় পেজে যায় না। Category picker-এর পুরো ভিত্তি এটি।
3. **বইয়ের page element গুলো referentially stable** (`FlipbookViewer.tsx#bookPages`)।
   react-pageflip children-এর identity বদলালেই পুরো DOM ধ্বংস করে নতুন করে বানায় —
   flip চলাকালে সেটি হলে পেজ পিছনে লাফ দেয়। তাই কার্টের qty প্রপস হিসেবে নামানো হয়
   না; প্রতিটি কার্ড নিজে `useItemQty()` দিয়ে সাবস্ক্রাইব করে।

## Production Build

```bash
npm run build
npm run start
```

## Documentation

- [plans/api-contract.md](plans/api-contract.md) — flipbook ↔ admin JSON চুক্তি
- [plans/04-data-mapping.md](plans/04-data-mapping.md) — DB টেবিল → JSON ম্যাপিং
- [plans/05-product-audit-2026-07.md](plans/05-product-audit-2026-07.md) — architecture,
  UX ও performance audit, roadmap এবং task list
