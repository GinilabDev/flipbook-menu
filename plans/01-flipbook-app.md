# 01 — Flipbook অ্যাপ (this repo)

কাস্টমার-facing অংশ। মেনু-ডেটা এনে fixed-slot টেমপ্লেটে ফ্লিপবুক রেন্ডার করে।

## নতুন কাজ

### A. মেনু-ডেটা টাইপ + mock API
- `lib/menu.ts` রিফ্যাক্টর: `Menu → { restaurant, categories[], items[] }`
  (hotspot/rect বাদ; আইটেম এখন data, image নয়)।
- `Category { id, name, color?, sortOrder }`, `MenuItem { id, name, price,
  discountPrice?, shortDesc?, longDesc?, categoryId, veg?, hot?, media[] }`।
- mock API: `GET /api/flipbook/menu?restaurant=&table=` → এই shape (দেখুন
  [api-contract.md](api-contract.md))।

### B. Layout engine — `lib/layout.ts` (নতুন মূল কাজ)
- ইনপুট: categories + items (sortOrder অনুযায়ী)।
- আউটপুট: `Page[]` — fixed-slot pagination:
  - Page 0 = cover (রেস্টুরেন্ট logo/নাম, brand রঙ)।
  - প্রতি ক্যাটাগরি নতুন পেজে শুরু (section header)।
  - প্রতি পেজে সর্বোচ্চ `N` আইটেম (grid/list); উপচে পড়লে "continued" পেজ।
  - শেষে back cover (ঐচ্ছিক)।
- `N` ও গ্রিড কনফিগ portrait/landscape-এ আলাদা (মোবাইলে কম)।
- Spread-এর জন্য পেজ সংখ্যা জোড় রাখা (react-pageflip cover mode)।

### C. MenuPage টেমপ্লেট — `components/MenuPage.tsx` (নতুন)
- একটা পেজের assigned আইটেম নিয়ে টেমপ্লেট রেন্ডার: section header + item কার্ড।
- Item কার্ড: নাম, দাম (discount থাকলে কাটা দাম), শর্ট desc, veg/hot ব্যাজ,
  থাকলে thumbnail, media badge, "+" add বোতাম।
- brand রঙ CSS variable দিয়ে (theme)।

### D. FlipbookViewer পরিবর্তন
- `pages: RenderedPage[]` (image) → `pages: LayoutPage[]` (data)।
- image `<Page>` এর বদলে `<MenuPage>` রেন্ডার; hotspot overlay বাদ।
- book-shell (flip/zoom/sound/sizing/arrows) অপরিবর্তিত।
- `aspect` এখন টেমপ্লেট-নির্ধারিত (ফিক্সড, যেমন 3:4)।

### E. List-view টগল (mobile-first)
- একটা টগল: flipbook ⇄ scrollable list (ক্যাটাগরি-ভিত্তিক accordion/section)।
- list-এও একই item কার্ড + add-to-cart; দ্রুত অর্ডারের জন্য।
- মোবাইলে ডিফল্ট list হতে পারে (কনফিগযোগ্য), ডেস্কটপে flipbook।

### F. QR রুট + table-context
- `/r/[restaurant]/page.tsx` — param থেকে restaurantId, `?t=` থেকে tableId।
- tableId localStorage-এ (রিফ্রেশে টিকে থাকে); order-এ পাঠানো হয়।
- restaurant না মিললে friendly error।

### G. Cart / order (reuse + এক্সটেন্ড)
- `lib/cart.tsx`, `CartUI.tsx` — থাকছে।
- order payload-এ `restaurant` + `table` যোগ; আইটেম option/variant থাকলে সেটাও।
- checkout: dine-in হলে customer-info হালকা (শুধু note/allergy), টেবিল থেকেই পরিচয়।

### H. Media (দেখুন [03-media-feature.md](03-media-feature.md))
- item কার্ডে media badge → lightbox (image carousel + YouTube/Vimeo embed)।

### I. Responsive polish
- মোবাইলে বড় tap-target, single-page flipbook বা list; ট্যাবলেট/ডেস্কটপে spread।

## যা বাদ / সরে যাচ্ছে (মূল ফ্লো থেকে)
- `lib/pdf.ts`, `lib/detect.ts`, `app/api/pdf-proxy` — মূল পথে আর লাগবে না।
  চাইলে আলাদা "PDF import" রুটে রাখা যায় (এডমিন seed), নয়তো সরিয়ে ফেলা।
- hotspot/rect ধারণা পুরো বাদ।

## reuse হচ্ছে
- FlipbookViewer book-shell, cart, CartUI, item popup, media lightbox প্ল্যান।
