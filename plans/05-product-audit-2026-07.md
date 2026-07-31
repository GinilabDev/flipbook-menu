# Flipbook Menu — Senior Product & Engineering Audit

**Date:** 2026-07-26 · **Branch:** `Complete-Architecture-Review`
**Reviewed by:** architecture / UX / performance / restaurant-ops / QA lenses
**Method:** পুরো source line-by-line পড়া হয়েছে; live admin API (`restaurant=6`) থেকে
real payload measure করা হয়েছে; `next build` + `tsc --noEmit` চালানো হয়েছে।
কোনো দাবি অনুমানভিত্তিক নয় — প্রতিটির সাথে file:line বা measured number আছে।

> **Scope note:** এই ধাপে **কোনো কোড পরিবর্তন করা হয়নি**। এটি Phase 1–11 এর
> analysis + roadmap। Implementation Phase 9-এর task list ধরে, এক task একবারে।

---

## 0. দুটি premise correction (evidence সহ)

| আপনার ধারণা | বাস্তবে | Evidence |
|---|---|---|
| React + **Vite** | **Next.js 16.2.10 App Router (Turbopack)** — Vite নেই | `package.json`, build output `▲ Next.js 16.2.10 (Turbopack)` |
| "QR → … → Payment → Confirmation" flow আছে | **Payment step সম্পূর্ণ অনুপস্থিত**, এবং order আসলে kitchen-এ পৌঁছায় না | `components/CartUI.tsx:93`, `tomafood-net/api/application/controllers/v2/Flipbook.php:179` |

এই দুটো audit-এর বাকি সব সিদ্ধান্তকে প্রভাবিত করে, তাই আগে বললাম।

---

## Deliverable 1 — Complete Architecture Review

### 1.1 Stack

```
Next.js 16.2.10 (App Router, Turbopack)  ·  React 19.0.0  ·  TypeScript 5.7 (strict: true)
Tailwind CSS 3.4  ·  react-pageflip 2.0.3  ·  react-icons 5.7
Dependencies মোট: 5টি। কোনো state library নেই, কোনো data-fetching library নেই, কোনো test runner নেই।
```

`tsc --noEmit` → **clean**। `next build` → **success**, কোনো warning নেই।

### 1.2 Folder architecture

```
app/
  layout.tsx                       Root layout — <CartProvider> এখানে mount হয়
  page.tsx                         Demo launcher (hardcoded spice-empire link)
  globals.css                      Tailwind + flipbook page/spine/arrow CSS
  api/flipbook/menu/route.ts       GET proxy → admin
  api/flipbook/order/route.ts      POST proxy → admin
  restaurant/[slug]/
    page.tsx                       SERVER component — generateMetadata + generateViewport মাত্র
    RestaurantMenuClient.tsx       CLIENT — table resolve + menu fetch + loading/error
components/                        সব "use client"
  MenuExperience.tsx   (366)       Top-level orchestrator: view toggle, popup, lightbox, skeleton, cart mount
  FlipbookViewer.tsx   (311)       react-pageflip wrapper, stage measuring, scale math, nav
  MenuPage.tsx         (467)       cover / section / back / blank page renderer + subcategory accordion
  ItemCard.tsx         (285)       card + compact row + dietary badges (list ও book দুই জায়গায় shared)
  CartUI.tsx           (316)       floating cart button + drawer + place-order + fly-to-cart animation
  CategoryModal.tsx    (140)       table of contents
  ItemPopup.tsx        (113)       item detail + qty picker
  ListView.tsx          (88)       flipbook-এর scroll alternative
  MediaLightbox.tsx     (92)       image carousel / YouTube-Vimeo embed
  ViewSkeleton.tsx      (83)       view-switch placeholder
lib/
  menu.ts       (199)  Data contract + pure helpers (effectivePrice, groupCategoryItems, orderedCategories…)
  layout.ts     (167)  Layout engine — Menu → LayoutPage[]
  cart.tsx      (126)  CartProvider (useReducer + localStorage)
  menu-source.ts (93)  Server-side admin fetch (restaurant + menu parallel merge)
  config.ts      (33)  ADMIN_API_BASE, file_url, mediaUrl()
  accent.ts      (49)  Deterministic category accent colour
  flyToCart.ts   (20)  window CustomEvent bridge
```

মোট **3,203 lines** TS/TSX। কোনো dead file নেই (PDF-era leftovers আগেই সরানো হয়েছে)।

### 1.3 Component hierarchy

```
RootLayout
└─ CartProvider                                        ← একমাত্র global state
   └─ /restaurant/[slug] (server, metadata only)
      └─ RestaurantMenuClient (client fetch → Menu | error)
         └─ MenuExperience                             ← সব UI state এখানে জমা
            ├─ header (logo · name · table · TOC btn · view toggle)
            ├─ FlipbookViewer ──► MenuPage × N ──► ItemCard(compact) × 672
            │   └─ (dynamic import: react-pageflip, ssr:false)
            ├─ ListView ─────────► ItemCard(card) × 672
            ├─ ViewSkeleton (overlay)
            ├─ CategoryModal · ItemPopup · MediaLightbox
            └─ CartUI (fixed button + drawer)
```

**Coupling assessment:** hierarchy পরিষ্কার এবং shallow। `ItemCard` দুই view-তে shared
হওয়াটা ভালো সিদ্ধান্ত — price/badge/discount logic এক জায়গায়। `MenuExperience`
কিছুটা fat (366 lines, ৭টি useState + ৩টি useEffect) কিন্তু এখনো readable।

### 1.4 Routing

| Route | Type | মন্তব্য |
|---|---|---|
| `/` | Static | Demo launcher — production-এ hardcoded `spice-empire?t=1` link leak করে |
| `/restaurant/[slug]` | **Dynamic (ƒ)** | QR entry point। `?t=` না থাকলে `localStorage` fallback |
| `/api/flipbook/menu` | Dynamic | proxy, `cache: no-store` |
| `/api/flipbook/order` | Dynamic | proxy, response pass-through |

Slug = restaurant `url` column অথবা numeric id (admin দুটোই resolve করে)।
`robots: { index: false }` — per-table QR page হিসেবে সঠিক সিদ্ধান্ত।

### 1.5 State management

**তিন স্তরে, কোনো Redux নেই — এবং এই scale-এ Redux দরকারও নেই:**

1. **Cart (global)** — `lib/cart.tsx`, `useReducer` + Context + `localStorage` persist।
2. **View/UI state (local)** — `MenuExperience`-এ `view`, `popupItem`, `mediaItem`,
   `catOpen`, `activeCategoryId`, `portrait`, `skeleton`।
3. **Derived state (memo)** — `pages = buildPages(menu, …)` (`MenuExperience.tsx:55`),
   `entries` (TOC list, `:63`)।

**Architectural risk:** cart context value প্রতিটি cart mutation-এ নতুন object
(`lib/cart.tsx:105`), আর `qtyOf` একটি নতুন closure। নিচে কোনো `React.memo` নেই →
**প্রতিটি "+" tap-এ পুরো 672-card tree re-render হয়।** (Performance section দ্রষ্টব্য।)

### 1.6 API communication

```
Browser ──► /api/flipbook/menu?restaurant&table  (Next route handler)
                    │
                    └─ lib/menu-source.ts  Promise.all([
                          GET {ADMIN}/flipbook/restaurant   (579 bytes, measured)
                          GET {ADMIN}/flipbook/menu         (152 KB,   measured)
                       ]) → merge → single `Menu`
Browser ──► /api/flipbook/order (POST) ──► {ADMIN}/flipbook/order
```

**ভালো দিক:** branding আর menu আলাদা endpoint, `Promise.all`-এ parallel
(`lib/menu-source.ts:75`); `generateMetadata` শুধু `brandingOnly: true` নেয় —
title-এর জন্য 672 item টানে না; admin fail করলে **mock fallback নেই** —
সচেতন সিদ্ধান্ত, এবং সঠিক (ভুল দামের menu দেখানোর চেয়ে error ভালো)।

**সমস্যা:** proxy সবসময় `cache: "no-store"` (`lib/menu-source.ts:44`) → ৫০টা টেবিল
একসাথে scan করলে ৫০টা full 152 KB admin hit।

### 1.7 Layout engine (business logic-এর কেন্দ্র — সাবধানে ছোঁবেন)

`lib/layout.ts` — চুক্তি: **এক category = ঠিক এক page**।

```
page 0                = cover
প্রতিটি non-empty cat = section page (header + blocks[])
                        blocks: "group" (collapsible subcategory) | "row" (itemsPerRow টি card)
শেষ page              = back cover  (+ প্রয়োজনে blank, spread জোড় রাখতে)
```

Pages **fixed design space `400 × 556`**-এ লেখা হয়, viewer `scale = stageHeight / 556`
দিয়ে scale করে (`FlipbookViewer.tsx:197`)। এর ফলে type সব device-এ সমানুপাতিক।
`itemsPerRowFor(portrait)` → phone-এ 1, spread-এ 2 — এবং এই breakpoint (`768px`)
**দুই জায়গায় duplicate** (`MenuExperience.tsx:49` ও `FlipbookViewer.tsx:78`)।

এই "one page per category" সিদ্ধান্তটাই CategoryModal-কে কাজ করায় (প্রতিটি
category-র একটি stable destination)। **এটি ভাঙবেন না।**

### 1.8 Real data profile (measured, restaurant 6 — "SPICE EMPIRE")

| Metric | Value | Design-এ যা বোঝায় |
|---|---|---|
| Categories | 40 (৩টি খালি → filter হয়) | TOC-তে 37 entry |
| Subcategories | 87 | ৫টি category `withSubcategory` |
| Items | **672** | সব একসাথে DOM-এ mount হয় |
| Payload | **152 KB** uncompressed | client-side fetch, LCP-blocking |
| **সবচেয়ে বড় category** | **92 items** (Tikka Curries) | একটি scrollable "page"-এ ৯২টি item |
| Median category | 11 items | বেশিরভাগ page ঠিকঠাক |
| **ছবিসহ item** | **0 / 672** | premium visual menu আজ অসম্ভব |
| Description সহ item | **16 / 672** | card-এর desc line প্রায় সবসময় খালি |
| veg / hot / nut flag | **0 / 7 / 2** | allergen info কার্যত নেই |
| একই নামের item | **173টি duplicate** | cart-এ "MADRAS" কোনটা বোঝা যায় না |
| Discounted item | 0 | discount UI আজ dead code path |

**এটাই audit-এর সবচেয়ে গুরুত্বপূর্ণ finding:** UI যে data ধরে নিয়ে ডিজাইন করা
(ছবি, description, dietary badge, discount), সেই data **বাস্তবে নেই**। Product-এর
সবচেয়ে বড় উন্নতি আসবে frontend থেকে নয় — **admin-side content pipeline** থেকে।

---

## Deliverable 2 — Complete User Journey Analysis (Phase 2)

প্রতিটি ধাপ: Expectation → Current → Friction → Recommendation → Business impact।

### ধাপ 1 · QR Scan
- **Expectation:** ২ সেকেন্ডে menu, কোনো app/login নেই।
- **Current:** `/restaurant/{slug}?t={table}`; table `localStorage`-এ persist (`RestaurantMenuClient.tsx:26-35`)।
- **Friction:** ① `?t=` ছাড়া scan করলে (বা পুরনো localStorage থেকে) **ভুল টেবিল** নিয়ে order যেতে পারে — টেবিল বদলানো গ্রাহকের ক্ষেত্রে বাস্তব ঘটনা। ② persisted table-এর কোনো expiry নেই।
- **Recommendation:** `?t=` থাকলে সবসময় সেটিই জেতে (এখনকার আচরণ ✅), কিন্তু localStorage-এ **TTL ~4 ঘণ্টা** দিন এবং header-এ table chip সবসময় দেখান + "wrong table?" tap-to-change।
- **Impact:** ভুল টেবিলে খাবার যাওয়া = সরাসরি খরচ + refund + review ঝুঁকি।

### ধাপ 2 · Restaurant Landing
- **Expectation:** ব্র্যান্ড চিনতে পারা, তাৎক্ষণিক।
- **Current:** কোনো আলাদা landing নেই — সরাসরি spinner, তারপর flipbook cover (`MenuPage.tsx:45-87`)।
- **Friction:** **সম্পূর্ণ menu client-side fetch** — HTML আসার পরে 152 KB API call, তারপর ভারী render। খারাপ 4G-তে খালি স্ক্রিনে কয়েক সেকেন্ড।
- **Recommendation:** `?t=` থাকলে (QR-এ সবসময় থাকে) **server-render** করুন — RSC-তে menu fetch করে প্রথম page পাঠান; localStorage-only case-এ client fallback থাকুক।
- **Impact:** LCP ~2–4s → ~1s। Dine-in-এ প্রথম ১০ সেকেন্ডই ordering-এ রূপান্তরের সবচেয়ে ভঙ্গুর মুহূর্ত।

### ধাপ 3 · Flipbook Menu
- **Expectation:** বইয়ের মতো, কিন্তু দ্রুত।
- **Current:** ৪২ page একসাথে mount, page turn 800ms, flip sound, arrow + swipe।
- **Friction:** ① প্রথম paint-এ ৬৭২টি card DOM-এ। ② flip sound প্রথম tap-এর আগে browser block করে (autoplay policy) — কখনো বাজে, কখনো না, inconsistent। ③ **restaurant-এ বই রূপক শুধু তখনই মূল্যবান যখন ব্র্যান্ড premium** — ৯২ item-এর category-তে এটি ব্যবহারযোগ্যতার শত্রু।
- **Recommendation:** near-page rendering (নিচে P1-2), sound-কে opt-in toggle, এবং **first-visit-এ view preference মনে রাখা** (flip vs list)।
- **Impact:** ordering time কমে; পুরনো ফোনে jank কমে।

### ধাপ 4 · Category Navigation
- **Expectation:** "Starters কোথায়?" — এক tap।
- **Current:** header-এ grid icon → `CategoryModal`, active category ticked, `scrollIntoView({block:'center'})` (`CategoryModal.tsx:47`)।
- **Friction:** ৩৭টি category-র flat list; কোনো search/filter নেই; icon-only button-এর মানে প্রথমবার বোঝা যায় না।
- **Recommendation:** modal-এর মাথায় একটি filter input; button-এ text label ("Menu"); সাম্প্রতিক/জনপ্রিয় category উপরে।
- **Impact:** discovery time কমে → বেশি item দেখা → basket বড়।

### ধাপ 5 · Product Discovery  ⚠️ **সবচেয়ে বড় ফাঁক**
- **Expectation:** "chicken korma" খুঁজে বের করা।
- **Current:** **কোনো search নেই।** ৬৭২ item, ৩৭ category — একমাত্র উপায় page ঘুরিয়ে খোঁজা।
- **Friction:** যে গ্রাহক নির্দিষ্ট ডিশ চান তাকে ৯২-item page-এ scroll করতে হয়; তাতে waiter ডাকা সহজ মনে হয় → digital menu-র মূল উদ্দেশ্য ব্যর্থ।
- **Recommendation:** **P0 — global search** (নাম + subcategory + category match, debounce, ফলাফল থেকে সরাসরি add/detail)। ৬৭২ item সব ইতিমধ্যেই client memory-তে আছে, তাই এটি pure client feature, কোনো API লাগবে না।
- **Impact:** এই একটি feature সম্ভবত পুরো roadmap-এর সবচেয়ে বড় conversion lift।

### ধাপ 6 · Product Details
- **Expectation:** ছবি, উপকরণ, allergen, spice level।
- **Current:** `ItemPopup` — নাম, desc, দাম, qty, Add (`ItemPopup.tsx`)।
- **Friction:** desc আছে মাত্র **16/672** item-এ; ছবি **0**; allergen প্রায় শূন্য। Popup-এ `role="dialog"` নেই, focus trap নেই, Escape কাজ করে না।
- **Recommendation:** (a) admin-এ image + description + allergen ঢোকানোর content drive; (b) popup-কে accessible dialog করা; (c) desc/ছবি না থাকলে graceful — "Ask your server about ingredients" line।
- **Impact:** ছবিসহ item সাধারণত উল্লেখযোগ্য বেশি order হয়; এখানে সেই সুযোগ পুরোটাই অব্যবহৃত।

### ধাপ 7 · Customization  ⚠️ **অনুপস্থিত**
- **Expectation:** spice level, size, "no onion", side পছন্দ।
- **Current:** কোনো option/modifier নেই। Cart line-এর key শুধু `item.id` (`lib/cart.tsx:38`), তাই একই item-এর দুটি ভিন্ন variant রাখাই সম্ভব নয়। `plans/api-contract.md`-এ `options: []` আছে — unimplemented।
- **Friction:** curry house-এ customization প্রায় নিয়ম। এখন গ্রাহককে waiter ডাকতেই হয় → waiter-free ordering ভাঙে।
- **Recommendation:** cart key `itemId + optionsHash`-এ যাওয়া (backward compatible: option না থাকলে key = itemId), সাথে item-level "Special instructions" note field। **এটি business-logic change — নিচে Phase 6-এ risk বিশ্লেষণ আছে।**
- **Impact:** waiter interruption কমে; upsell (extra cheese, large) সরাসরি রাজস্ব।

### ধাপ 8 · Quantity Update
- **Expectation:** দ্রুত +/−।
- **Current:** card-এ "+" (`ItemCard.tsx:213`), popup-এ stepper, drawer-এ stepper।
- **Friction:** compact card-এর "+" মাত্র **18 × 18 design px** (ফোনে ≈26 CSS px) — WCAG 2.5.8-এর 24px এবং Apple-এর 44pt দুটোই fail; পাশে thumbnail/price ঘেঁষা। ভুল tap করলে popup খোলে (নরম fallback, তবু ঘর্ষণ)। এছাড়া এটি `<button>`-এর ভেতরে `<span role="button" tabIndex={-1}>` — **keyboard-এ পৌঁছানোই যায় না**, এবং nested interactive element HTML-invalid।
- **Recommendation:** hit-area ≥44px (visual ছোট রেখে `::after` দিয়ে বাড়ানো যায়), এবং card-কে `<div role="group">` + ভেতরে দুটি আসল `<button>` করা।
- **Impact:** mis-tap কমে; accessibility compliance।

### ধাপ 9 · Add To Cart
- **Expectation:** স্পষ্ট feedback।
- **Current:** "fly to cart" chip animation + button bump (`CartUI.tsx:29-91`), `prefers-reduced-motion` সম্মান করা হয় ✅।
- **Friction:** কোনো screen-reader announcement নেই (`aria-live` নেই); কোনো Undo নেই।
- **Recommendation:** polite live region ("Chicken Korma added, 2 in cart") + toast-এ Undo।
- **Impact:** ভুল add দ্রুত ঠিক করা যায় → cart abandonment কমে।

### ধাপ 10 · Cart Review  ⚠️
- **Expectation:** কী order করছি, কত দাম, টেবিল ঠিক আছে কিনা।
- **Current:** drawer — line, qty stepper, remove, subtotal (`CartUI.tsx:216-279`)।
- **Friction:** ① **cart localStorage key restaurant/table দিয়ে scope করা নয়** — `"flipbook.cart.v1"` (`lib/cart.tsx:30`)। আলাদা রেস্টুরেন্টের QR scan করলে **আগের রেস্টুরেন্টের item cart-এ থেকে যায়**। ② line-এ শুধু নাম দেখানো হয়, অথচ **173টি duplicate নাম** আছে — "MADRAS" কোনটা বোঝা অসম্ভব। ③ কোনো order note নেই। ④ Escape/back-button দিয়ে drawer বন্ধ হয় না, body scroll lock নেই।
- **Recommendation:** storage key-তে restaurant id, cart line-এ category/subcategory subtitle, note field, Escape + history-back handling।
- **Impact:** ① সরাসরি ভুল order প্রতিরোধ (P0)।

### ধাপ 11 · Checkout  ⚠️
- **Expectation:** নিশ্চিত করা, তারপর পাঠানো।
- **Current:** "Checkout" button সরাসরি `POST /api/flipbook/order` (`CartUI.tsx:93`), কোনো confirmation নেই, কোনো নাম/note নেই।
- **Friction:** ① double-tap হলে **duplicate order** যেতে পারে (`placing` state আছে ✅ কিন্তু server-side idempotency key নেই)। ② **table না থাকলেও order পাঠানো যায়** — kitchen জানবে না কোথায় দিতে হবে। ③ failure-এ `alert()` (`CartUI.tsx:109`) — ব্র্যান্ডের বাইরের native dialog।
- **Recommendation:** confirm step (table + total + note), table না থাকলে blocking prompt, `alert()` → in-UI error, client-generated idempotency key।
- **Impact:** duplicate/anonymous order = kitchen chaos এবং কর্মী-সময় নষ্ট।

### ধাপ 12 · Payment  ⚠️ **সম্পূর্ণ অনুপস্থিত**
- **Current:** কোনো payment নেই। (admin-এ `v2/Stripe_payment.php` আছে — পথ খোলা।)
- **Recommendation:** dine-in-এ "pay at table" ঐচ্ছিক রাখা যুক্তিসঙ্গত; তবে **সিদ্ধান্তটি স্পষ্ট করে product-এ লিখতে হবে** ("Pay at the counter / your server will bring the bill") — নইলে গ্রাহক অপেক্ষা করবেন payment screen-এর জন্য।
- **Impact:** প্রত্যাশা ব্যবস্থাপনা; পরে Stripe যোগ করলে flow তৈরি থাকবে।

### ধাপ 13 · Order Confirmation  🔴 **সবচেয়ে গুরুতর**
- **Current:** UI বলে **"Order placed! Your order has been sent to the kitchen."** (`CartUI.tsx:199-202`)।
  অথচ admin-এ:
  ```php
  // Flipbook.php:179
  // TODO: wire into the existing order flow (Order_model / rcs_order +
  // rcs_order_item) … For now, acknowledge receipt so the flipbook end-to-end works.
  $order_id = 'fb_' . time();
  ```
  **অর্থাৎ order কোথাও সংরক্ষিত হয় না, kitchen কখনো জানে না।**
- **Friction:** এটি production-এ চালু করলে গ্রাহক অপেক্ষা করবেন এমন খাবারের জন্য যা কেউ রান্না করছে না।
- **Recommendation:** **launch-blocking।** `order_post`-কে `rcs_order`/`rcs_order_item`-এ লিখতে হবে, source=`flipbook`, `restaurant_id` + `table_id` সহ, এবং **server-side re-pricing** (client-এর পাঠানো দাম বিশ্বাস করা যাবে না)। response-এ আসল order number ফেরত দিয়ে UI-তে দেখাতে হবে।
- **Impact:** এটি ঠিক না হওয়া পর্যন্ত product production-ready নয়।

### ধাপ 14 · Post-order (journey-তে ছিল না, কিন্তু dine-in-এ অপরিহার্য)
- **Current:** কিছুই নেই — order history নেই, "add to existing order" নেই, staff call নেই, bill request নেই।
- **Recommendation:** টেবিলের চলতি order-এর একটি view + "Order more" (dine-in-এ ২–৩ রাউন্ড order স্বাভাবিক) + "Call waiter" / "Request bill" button।
- **Impact:** দ্বিতীয় রাউন্ড order = গড় bill-এর সবচেয়ে সহজ বৃদ্ধি।

---

## Deliverable 3 — UX Audit Report (Phase 3)

| দিক | মূল্যায়ন | Evidence / বিস্তারিত |
|---|---|---|
| **Navigation** | ⚠️ মাঝারি | TOC ভালো, কিন্তু search নেই; icon-only header button-এর মানে অস্পষ্ট |
| **Visual hierarchy** | ✅ ভালো | section header → accent rule → subcategory head → card — স্পষ্ট স্তর |
| **Touch targets** | 🔴 খারাপ | compact "+" 18px (`ItemCard.tsx:227`); flip arrow 32px মোবাইলে (`globals.css:195`) |
| **Thumb usability** | ⚠️ মাঝারি | cart button নিচে-মাঝে ✅; কিন্তু TOC ও view toggle উপরে-ডানে — এক হাতে কঠিন |
| **Animation timing** | ⚠️ | flip 800ms (`FlipbookViewer.tsx:244`) — বারবার ব্যবহারে ধীর মনে হয়; 450–550ms উপযুক্ত |
| **Scroll behaviour** | ⚠️ | page-এর ভেতরে scroll + বাইরে swipe-to-flip একই অঙ্গভঙ্গি; ৯২-item page-এ বিভ্রান্তিকর। নিচের fade (`MenuPage.tsx:296`) ভালো affordance |
| **Feedback** | ✅/⚠️ | fly-to-cart চমৎকার; কিন্তু screen-reader-এ নীরব |
| **Loading** | ✅ ভালো | skeleton + min-duration + timeout (`MenuExperience.tsx:24-27,143-176`) — পরিণত কাজ |
| **Error handling** | ⚠️ | menu error page ভালো (retry সহ); order error `alert()`; কোনো `error.tsx` boundary নেই → render throw করলে white screen |
| **Empty states** | ⚠️ | cart empty state ✅; কিন্তু "menu-তে কোনো item নেই" (categories: []) case-এ শুধু cover+back — কোনো বার্তা নেই |
| **Success state** | ⚠️ | সুন্দর, কিন্তু **মিথ্যা** (উপরে দেখুন); order number নেই, ETA নেই |
| **Accessibility** | 🔴 | nested interactive elements; `tabIndex={-1}` add button; ItemPopup-এ `role="dialog"` নেই; কোথাও focus trap নেই; modal খোলা অবস্থায়ও arrow key বই ওল্টায় (`FlipbookViewer.tsx:160-167`); body scroll lock নেই; `aria-live` নেই |
| **Typography** | ⚠️ | body font = **FivoSans-Thin** (`globals.css:14`) — thin weight, 9–12 design px-এ রেস্টুরেন্টের কম আলোয় পড়া কষ্টকর। `.otf` (45 KB) — woff2 হলে ~অর্ধেক |
| **Spacing** | ✅ | ঘন কিন্তু সুসংগত |
| **Color consistency** | ✅ ভালো | `--main-color` CSS variable একবার set, সর্বত্র ব্যবহৃত (`MenuExperience.tsx:190-199`); `readableOn()` দিয়ে contrast-safe cover text (`MenuPage.tsx:340`) — বুদ্ধিমান |
| **CTA visibility** | ⚠️ | cart button শুধু cart খালি না হলে দেখা যায় — প্রথম add-এর আগে কোনো CTA নেই; cover-এর "Tap any item…" line-ই একমাত্র শিক্ষা |
| **Cart interaction** | ⚠️ | stepper ভালো; কিন্তু duplicate নামের কারণে line অস্পষ্ট |
| **Checkout experience** | 🔴 | confirmation step নেই, note নেই, payment নেই, order number নেই |

---

## Deliverable 4 — Restaurant Industry Perspective (Phase 4)

| প্রশ্ন | বর্তমান অবস্থা | সুপারিশ |
|---|---|---|
| **Table ordering workflow** | Order kitchen-এ যায় **না** (Flipbook.php:179) | P0-1 — সবার আগে |
| **Dine-in usability** | Table QR ✅, table chip drawer-এ ✅ | Table সবসময় header-এ দেখান |
| **Waiter-free ordering** | ভাঙে — customization/note নেই, তাই "extra spicy" বলতে waiter লাগে | P1 — note + options |
| **Average ordering time** | Search না থাকায় ৬৭২ item-এ দীর্ঘ | P0-2 search |
| **Confusion points** | ৯২-item page; একই নামের ১৭৩ item; page-এর ভেতরে scroll | Search + cart context label |
| **Conversion** | ছবি ০, description ১৬/৬৭২ | Content pipeline (P1) — সবচেয়ে বড় লিভার |
| **Upsell** | কিছুই নেই | Item popup-এ "Goes well with" (একই category/subcategory থেকে, pure client) |
| **Cross-sell** | কিছুই নেই | Cart drawer-এ "Add naan / drinks?" — Sundries/Naan Bread category থেকে |
| **Repeat ordering** | নেই | "Order again" — শেষ order localStorage-এ |
| **Large family ordering** | কঠিন — একটাই cart, কে কী চাইল বোঝা যায় না | Cart line-এ optional "for" tag (Person 1/2) — হালকা সমাধান |
| **Split ordering** | নেই | Phase 2 feature; আগে order persistence দরকার |
| **Operational efficiency** | Kitchen-এ কিছুই পৌঁছায় না; staff call নেই | Order persistence + "Call waiter" |

**Consultant-এর সারকথা:** technology-টা ভালো, কিন্তু **এই মুহূর্তে এটি একটি সুন্দর
ডিজিটাল menu — ordering system নয়।** এক লাইনের business decision: আগে order pipeline
সম্পূর্ণ করুন, তারপর discovery (search), তারপর content (ছবি/description), তারপর
premium polish।

---

## Deliverable 5 — Performance Report (Phase 5)

### 5.1 Measured

```
Build:              ✓ compiled 9.8s,  TypeScript 4.0s,  6 static pages
Client chunks:      769 KB raw (uncompressed, সব route মিলিয়ে)
                    সবচেয়ে বড় chunk 227 KB raw
Menu API payload:   152 KB uncompressed  (672 items) — 73 ms locally
Restaurant payload: 579 bytes
Fonts:              Acumin-RPro.woff 48 KB + FivoSans-Thin.otf 45 KB  (woff2 নয়)
Static assets:      icons.png 25 KB, flipBook.mp3 15 KB
```

### 5.2 Findings

| # | সমস্যা | Evidence | প্রভাব |
|---|---|---|---|
| P-1 | **সব page একসাথে mount** — react-pageflip সব children DOM-এ চায় → ৪২ page × ৬৭২ card প্রথম render-এ | `FlipbookViewer.tsx:253`, `lib/layout.ts:108` | প্রথম render দীর্ঘ, memory বেশি, পুরনো ফোনে jank |
| P-2 | **প্রতিটি cart mutation-এ পুরো tree re-render** — context value নতুন object, `qtyOf` নতুন closure, কোথাও `React.memo` নেই | `lib/cart.tsx:105-117`, `MenuExperience.tsx:178` | প্রতিটি "+" tap-এ ৬৭২ card re-render |
| P-3 | **Menu client-side fetch** — HTML → JS → fetch 152 KB → heavy render | `RestaurantMenuClient.tsx:39` | LCP-তে সরাসরি ধাক্কা |
| P-4 | **Proxy-তে কোনো cache নেই** (`no-store`) | `lib/menu-source.ts:44` | ৫০ টেবিল = ৫০ full admin hit |
| P-5 | `orderedCategories()` ও `itemsByCategory()` প্রতিবার **পুরো item list পুনরায় sort** করে; `ListView` প্রতি render-এ ডাকে | `lib/menu.ts:147-164`, `ListView.tsx:23,44` | O(n log n) × render; 672 item-এ লক্ষণীয় |
| P-6 | **Font woff2 নয়**, preload নেই | `globals.css:6-19` | FOUT + ~45 KB অতিরিক্ত |
| P-7 | সব ছবি raw `<img>` — `next/image` নেই, width/height নেই | `ItemCard.tsx:56,163`, `MenuPage.tsx:326` | আজ ছবি ০ বলে সুপ্ত; ছবি এলেই **CLS + বড় payload** |
| P-8 | `window.resize` listener **দুই component-এ duplicate**, কোনো debounce নেই; resize-এ `buildPages` পুরো recompute | `MenuExperience.tsx:48-53`, `FlipbookViewer.tsx:77-82` | ফোন rotate/keyboard-এ ঝাঁকুনি |
| P-9 | Flip animation 800ms + `will-change: transform` সব page-এ | `globals.css:187-190` | compositor memory; কম RAM device-এ চাপ |
| P-10 | ListView-এ virtualization নেই — ৬৭২ card একসাথে | `ListView.tsx:70` | scroll jank |

### 5.3 Web Vitals (predicted, real data দিয়ে)

- **LCP:** দুর্বল — server render নেই, তাই API + render-এর পরে content।
- **CLS:** এখন ভালো (fixed design space); **ছবি যোগ হলেই খারাপ হবে** যদি dimension না দেওয়া হয় (P-7)।
- **INP:** ঝুঁকিপূর্ণ — P-2 অনুযায়ী প্রতিটি tap একটি বড় re-render চালায়।

---

## Deliverable 6 — Business Logic Protection (Phase 6)

### 6.1 যেসব logic **ছোঁয়া যাবে না** (কাজ করছে, এবং সচেতন সিদ্ধান্ত)

| Logic | কোথায় | কেন রক্ষিত |
|---|---|---|
| One page per category | `lib/layout.ts` | CategoryModal-এর ভিত্তি; ভাঙলে TOC অর্থহীন |
| Fixed design space 400×556 + scale | `layout.ts:31`, `FlipbookViewer.tsx:197` | সব device-এ সমান typography-র একমাত্র কারণ |
| `groupCategoryItems` + `withSubcategory` gate | `lib/menu.ts:174` | POS bookkeeping subcategory আর আসল heading আলাদা করার business rule |
| `effectivePrice` / `hasDiscount` | `lib/menu.ts:128-136` | দাম গণনার একক উৎস |
| **কোনো mock fallback না রাখা** | `lib/menu-source.ts` header comment | ভুল দামের menu দেখানোর চেয়ে error ভালো — সচেতন সিদ্ধান্ত |
| `readableOn()` contrast | `MenuPage.tsx:340` | brand colour যেকোনো কিছু হতে পারে |
| `accentFor()` deterministic hash | `lib/accent.ts:40` | SSR/CSR ও TOC/page-এ রঙ মিলতে হবে |
| Existing admin API contract | `lib/menu-source.ts`, `plans/api-contract.md` | tomafood-net-এর সাথে চুক্তি — ভাঙবে না |

### 6.2 যে business logic পরিবর্তন **প্রস্তাব করছি** — প্রতিটির যুক্তি

**(a) Cart storage key-কে restaurant-scoped করা** — `"flipbook.cart.v1"` → `"flipbook.cart.v2.{restaurantId}"`

- **কেন দরকার:** এখন এক রেস্টুরেন্টের cart অন্য রেস্টুরেন্টের page-এ দেখা যায়।
- **বর্তমান সীমাবদ্ধতা:** ভুল রেস্টুরেন্টের item সহ order যেতে পারে।
- **সুবিধা:** সঠিক isolation; ভবিষ্যতে table-scoped করাও সহজ।
- **ঝুঁকি:** low — migration-এ পুরনো key-এর cart হারাবে (গ্রাহকের cart ক্ষণস্থায়ী, গ্রহণযোগ্য)।
- **Backward compatibility:** পুরনো key একবার পড়ে migrate করে মুছে দেওয়া যায়।
- **Migration impact:** নেই (client-only, কোনো DB/API পরিবর্তন নয়)।

**(b) Cart line key = `itemId + optionsHash` (customization-এর ভিত্তি)**

- **কেন:** option ছাড়া waiter-free ordering সম্পূর্ণ হয় না।
- **সীমাবদ্ধতা:** এখন একই item-এর দুই variant রাখা অসম্ভব।
- **সুবিধা:** upsell/modifier-এর দরজা খোলে।
- **ঝুঁকি:** **medium** — cart reducer-এর প্রতিটি path (`add/setQty/remove/qtyOf`) বদলাবে, এবং `qtyOf(itemId)` কে "এই item-এর মোট qty" হিসেবে redefine করতে হবে (card badge-এর জন্য)।
- **Backward compat:** option না থাকলে key = itemId → বর্তমান আচরণ অপরিবর্তিত।
- **Migration:** persisted cart-এ `v2` key ব্যবহার করলে পুরনো shape কখনো লোডই হবে না।
- **সিদ্ধান্ত:** admin-এ option data না আসা পর্যন্ত **শুধু note field** করা নিরাপদ; পূর্ণ options পরে।

**(c) Server-side re-pricing (admin-এ)**

- **কেন:** client cart-এ দাম snapshot হিসেবে রাখা হয় (`lib/cart.tsx:38`)। গ্রাহক page খুলে রাখলে দাম বদলালেও পুরনো দাম দেখাবে; আর order body-তে qty client থেকে আসে।
- **সুবিধা:** দাম নিয়ে বিরোধ বন্ধ; tampering প্রতিরোধ।
- **ঝুঁকি:** low — flipbook client already শুধু `{itemId, qty}` পাঠায় (`CartUI.tsx:102`), তাই **frontend-এ কোনো পরিবর্তন লাগবে না**।
- **API contract:** অপরিবর্তিত।

**(d) Menu proxy-তে ছোট cache (30–60s SWR)**

- **কেন:** peak-এ একই menu বারবার fetch।
- **ঝুঁকি:** low-medium — ৬০ সেকেন্ড পর্যন্ত stale দাম দেখানোর সম্ভাবনা। রেস্টুরেন্টে দাম দিনে কয়েকবারও বদলায় না, কিন্তু **সিদ্ধান্তটি ব্যবসার** — তাই ৩০s রক্ষণশীল মান প্রস্তাব করছি, এবং item **availability** পরে আলাদা lightweight endpoint-এ।

**DB structure পরিবর্তন প্রস্তাব করছি না** — শুধু `rcs_order`/`rcs_order_item`-এ
বিদ্যমান flow-তে flipbook order লেখা (নতুন column লাগলে সর্বোচ্চ একটি `source` flag,
যা সম্ভবত ইতিমধ্যেই আছে — implement করার সময় যাচাই করতে হবে)।

---

## Deliverable 6b — Prioritized Roadmap (Phase 7)

### 🔴 P0 — Critical (launch blocker)

**P0-1 · Order persistence (admin)**
- **কী:** `Flipbook.php:order_post()`-কে `rcs_order` + `rcs_order_item`-এ লিখতে হবে; server-side re-pricing; আসল order number ফেরত; flipbook UI-তে সেটি দেখানো।
- **কেন:** এখন UI বলে "sent to the kitchen", বাস্তবে কিছুই যায় না।
- **Impact:** এটি ছাড়া product ব্যবহারযোগ্য নয়।
- **Risk:** medium (existing order flow ছুঁতে হবে — সাবধানে, POS order ভাঙা যাবে না)।
- **Effort:** 1–2 দিন (admin-side)।

**P0-2 · Global item search**
- **কী:** header-এ search; নাম + subcategory + category মিলিয়ে; ফলাফল থেকে সরাসরি add/detail; flip view-তে category-তে jump।
- **কেন:** ৬৭২ item, ৩৭ category, কোনো search নেই — discovery-র বৃহত্তম বাধা।
- **Impact:** ordering time-এ সবচেয়ে বড় হ্রাস; conversion lift।
- **Risk:** low (pure client, data ইতিমধ্যেই memory-তে)। **Effort:** 0.5–1 দিন।

**P0-3 · Cart isolation + checkout safety**
- **কী:** storage key restaurant-scoped; table না থাকলে checkout block + prompt; `alert()` সরিয়ে in-UI error; idempotency key।
- **কেন:** ভুল রেস্টুরেন্ট/টেবিলের order = সরাসরি আর্থিক ক্ষতি।
- **Risk:** low। **Effort:** 0.5 দিন।

**P0-4 · Production config**
- **কী:** `lib/config.ts:13`-এর `file_url = "http://localhost/tomafood-net"` **hardcoded** — env var করতে হবে (`MEDIA_BASE_URL`); `.env.example` লিখতে হবে; HTTPS-এ mixed-content ঠেকাতে হবে; `app/page.tsx`-এর hardcoded demo link সরাতে/গার্ড করতে হবে; `README.md` এখনো **মুছে ফেলা PDF flow** বর্ণনা করে — পুরো ভুল।
- **কেন:** deploy করলেই logo/ছবি ভাঙবে।
- **Risk:** none। **Effort:** 2 ঘণ্টা।

### 🟠 P1 — High

**P1-1 · Accessibility pass**
- Nested `role="button"` → আসল `<button>`; hit-area ≥44px; `ItemPopup`-এ `role="dialog"` + focus trap + Escape; সব overlay-তে body-scroll lock; overlay খোলা থাকলে arrow-key flip বন্ধ; cart-এ `aria-live`।
- **Risk:** low-medium (card markup বদলাবে → layout regression নজরে রাখতে হবে)। **Effort:** 1–1.5 দিন।

**P1-2 · Render performance**
- `MenuPage` + `ItemCard`-এ `React.memo`; cart context-কে দুই ভাগ (state vs dispatch) অথবা `qtyOf`-কে stable ref; near-page rendering (current ± 2 page ছাড়া বাকিগুলোতে হালকা placeholder); `resize`-এ debounce; breakpoint-কে একটি shared hook-এ।
- **Impact:** INP ও প্রথম render।
- **Risk:** medium (react-pageflip সব child expect করে — placeholder-এর height অবশ্যই একই রাখতে হবে)। **Effort:** 1–2 দিন।

**P1-3 · Server-render first paint**
- `?t=` থাকলে RSC-তে menu fetch করে HTML পাঠানো; localStorage-only case-এ client fallback অটুট।
- **Risk:** medium (hydration mismatch এড়াতে হবে)। **Effort:** 1 দিন।

**P1-4 · Menu caching**
- Proxy-তে `revalidate: 30` + SWR header; admin-এ ETag।
- **Risk:** low-medium (stale দাম — উপরে 6.2d)। **Effort:** 0.5 দিন।

**P1-5 · Content pipeline (admin + ব্যবসায়িক)**
- ছবি ০/৬৭২, description ১৬/৬৭২, allergen ~০ — top 30 item-এর ছবি/description/allergen ভরার একটি admin workflow।
- **Impact:** roadmap-এর সবচেয়ে বড় conversion lever, কিন্তু এটি **content কাজ, code নয়**।
- **Effort:** admin-side; frontend শুধু ছবি এলে `next/image` + dimension (CLS রোধ)।

**P1-6 · Order note + "Call waiter" / "Request bill"**
- Waiter-free ordering-এর ফাঁক পূরণ। **Effort:** 0.5–1 দিন (admin support সহ)।

### 🟡 P2 — Medium

- **P2-1** Order confirmation-এ order number + ETA + "Order more" (একই টেবিলের দ্বিতীয় রাউন্ড)।
- **P2-2** Cart line-এ category/subcategory subtitle (১৭৩টি duplicate নামের সমস্যা)।
- **P2-3** Upsell/cross-sell: item popup-এ "Goes well with", cart-এ "Add sides/drinks?"।
- **P2-4** Flip timing 800→550ms; sound opt-in; view preference (flip/list) মনে রাখা।
- **P2-5** `error.tsx` + `not-found.tsx` + empty-menu state।
- **P2-6** Font: woff2 রূপান্তর + preload; description font Thin → Regular।
- **P2-7** ৯২-item page-এর জন্য in-page mini-nav (subcategory chips, sticky)।
- **P2-8** `next.config.mjs`-এ security headers (CSP, X-Frame-Options, Referrer-Policy)।

### 🟢 P3 — Nice to have

- **P3-1** Item customization/options (6.2b — data আসার পর)।
- **P3-2** Payment (Stripe — admin-এ controller আছে)।
- **P3-3** Split ordering / per-person tagging।
- **P3-4** Favourites / "Order again"।
- **P3-5** Multi-language (menu data-তে locale field দরকার)।
- **P3-6** ListView virtualization।
- **P3-7** Analytics + error telemetry (Sentry), যাতে পরের audit measured হয়।
- **P3-8** Test setup (Vitest + Playwright) — এখন **শূন্য** test।

---

## Deliverable 7 — Component Refactor Plan (Phase 8)

| # | Component | বর্তমান দায়িত্ব | সমস্যা | প্রস্তাবিত পরিবর্তন | Dependency | Risk | ক্রম |
|---|---|---|---|---|---|---|---|
| 1 | `lib/config.ts` | Admin base + media URL | `file_url` hardcoded localhost | env-driven `MEDIA_BASE_URL` | — | low | 1 |
| 2 | `lib/cart.tsx` | Global cart | key scope নেই; context value unstable; option support নেই | restaurant-scoped key + state/dispatch context split | 1 | low | 2 |
| 3 | `components/CartUI.tsx` | Button + drawer + order | `alert()`; confirm step নেই; table guard নেই; Escape নেই | error inline, confirm step, table guard, idempotency key, Escape/scroll-lock | 2 | low | 3 |
| 4 | **নতুন** `components/SearchOverlay.tsx` | — | — | নতুন search UI (P0-2) | `lib/menu`, `MenuExperience` | low | 4 |
| 5 | **নতুন** `lib/search.ts` | — | — | normalize + match + rank (pure, testable) | — | low | 4 |
| 6 | `components/ItemCard.tsx` | Card + compact row + badges | nested interactive; 18px target; memo নেই | markup restructure (`role="group"` + real buttons), hit-area, `React.memo` | — | **medium** (layout math CompactRow-এর CSS-এর সাথে বাঁধা) | 5 |
| 7 | `components/ItemPopup.tsx` | Detail + qty | dialog semantics নেই | `role="dialog"` + focus trap + Escape; পরে note field | — | low | 5 |
| 8 | `components/MenuPage.tsx` | Page renderer + accordion | `SectionBody` accordion state + rendering একসাথে; memo নেই | `SectionBody` আলাদা ফাইল, `React.memo(MenuPage)` | 6 | medium | 6 |
| 9 | `components/FlipbookViewer.tsx` | Book + sizing + nav | breakpoint duplicate; সব page mount; global keydown guard নেই | shared `useViewport()` hook; near-page rendering; keydown-এ overlay guard | 8 | **medium-high** (react-pageflip internals) | 7 |
| 10 | `components/MenuExperience.tsx` | Orchestrator | 366 lines, ৭ state | search state যোগ হলে UI state-কে একটি reducer-এ; breakpoint hook | 9 | low | 8 |
| 11 | `lib/menu.ts` | Contract + helpers | `itemsByCategory` বারবার গণনা | একবার index তৈরি করে `Menu`-র পাশে রাখা (pure helper অটুট) | — | low | 9 |
| 12 | `app/restaurant/[slug]/page.tsx` | Metadata | client-only fetch | `?t=` থাকলে server-render (P1-3) | 11 | medium | 10 |

---

## Deliverable 8 — Claude Code Task List (Phase 9)

> নিয়ম: **এক task সম্পূর্ণ শেষ (acceptance + QA pass) না হওয়া পর্যন্ত পরেরটা শুরু নয়।**

---

### TASK 1 — Production config & docs hygiene
**Objective:** deploy করলেই media/logo ভাঙার সমস্যা এবং ভুল README ঠিক করা।
**Files:** `lib/config.ts`, `.env.example` (new), `README.md`, `app/page.tsx`, `next.config.mjs`
**Steps:**
1. `file_url` → `process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? ADMIN থেকে derive ?? localhost` (dev fallback অটুট)।
2. `.env.example`: `ADMIN_API_BASE`, `NEXT_PUBLIC_MEDIA_BASE_URL`।
3. `README.md` পুরো নতুন করে লেখা (PDF-era বর্ণনা মুছে; QR flow, env, run, deploy)।
4. `app/page.tsx`-এর demo link `NODE_ENV !== "production"`-এ সীমাবদ্ধ।
**Acceptance:** env সেট করে build → logo/ছবি সঠিক host থেকে লোড হয়; README বাস্তবতা বর্ণনা করে।
**Regression risk:** নেই (dev default অপরিবর্তিত)।
**Testing:** dev + `next build && next start` দুই মোডে logo দেখা।
**Done when:** `tsc` clean, build clean, dev-এ আচরণ অপরিবর্তিত।

---

### TASK 2 — Cart isolation + checkout safety
**Objective:** ভুল রেস্টুরেন্ট/টেবিলের order প্রতিরোধ।
**Files:** `lib/cart.tsx`, `components/CartUI.tsx`, `components/MenuExperience.tsx`
**Steps:**
1. `CartProvider`-এ `restaurantId` prop; key `flipbook.cart.v2.{restaurantId}`; পুরনো `v1` key একবার migrate করে মুছে দেওয়া। (Provider `app/layout.tsx`-এ, তাই restaurant scope pass করতে provider-কে `MenuExperience`-এ নামাতে হতে পারে — **cart persistence ভাঙছে কিনা যাচাই করে** করতে হবে।)
2. `table` না থাকলে Checkout disabled + স্পষ্ট বার্তা ("Scan the QR on your table to order")।
3. `alert()` → drawer-এর ভেতরে error banner + Retry।
4. প্রতিটি order attempt-এ client-generated `idempotencyKey` (crypto.randomUUID) পাঠানো (admin আপাতত উপেক্ষা করবে; P0-1-এ ব্যবহার হবে)।
**Acceptance:** ভিন্ন slug-এ গেলে cart আলাদা; table ছাড়া checkout সম্ভব নয়; failure-এ native alert নেই।
**Regression risk:** medium — cart persistence। **অবশ্যই পরীক্ষা:** add → refresh → cart অটুট।
**Testing:** দুই slug, refresh, cart clear, offline order attempt।

---

### TASK 3 — Global search
**Objective:** ৬৭২ item-এ সেকেন্ডে খুঁজে পাওয়া।
**Files:** `lib/search.ts` (new), `components/SearchOverlay.tsx` (new), `components/MenuExperience.tsx`
**Steps:**
1. `lib/search.ts`: case/diacritic-insensitive normalize; item নাম prefix > substring, subcategory, category — rank সহ; সর্বোচ্চ ৫০ result।
2. `SearchOverlay`: full-screen sheet, input autofocus, ফলাফলে `ItemCard`, প্রতিটিতে "in {Category} › {Subcategory}" subtitle (duplicate নামের সমস্যাও এতে কমে)।
3. Header-এ search icon; result tap → ItemPopup; "Go to category" → `goToCategory`।
4. Escape/back বন্ধ করে; body scroll lock।
**Acceptance:** "korma" লিখলে <100ms-এ সব korma; ফলাফল থেকে add করলে cart বাড়ে; overlay খোলা থাকলে arrow key বই ওল্টায় না।
**Regression risk:** low। **Testing:** খালি query, ০ result, বাংলা/ইংরেজি কেস, দ্রুত টাইপিং।

---

### TASK 4 — Accessibility & touch targets
**Objective:** WCAG-এর মৌলিক শর্ত + mis-tap হ্রাস।
**Files:** `ItemCard.tsx`, `ItemPopup.tsx`, `CategoryModal.tsx`, `CartUI.tsx`, `MediaLightbox.tsx`, `FlipbookViewer.tsx`, `MenuExperience.tsx`
**Steps:**
1. `ItemCard`: বাইরের `<button>` → `<div role="group">`; ভেতরে "details" ও "add" দুটি আসল `<button>`; add-এর hit-area ≥44px (`::after` overlay), visual size অপরিবর্তিত।
2. `ItemPopup`: `role="dialog" aria-modal aria-labelledby`, focus trap, Escape।
3. সব overlay: body scroll lock, Escape, backdrop click (আছে) — একটি shared `useOverlay()` hook।
4. `FlipbookViewer`-এর keydown listener-এ `anyOverlayOpen` guard।
5. Cart-এ `aria-live="polite"` announcement।
**Acceptance:** কেবল keyboard দিয়ে browse → item খোলা → add → checkout সম্ভব; overlay-তে focus আটকে থাকে; page layout অপরিবর্তিত (screenshot diff)।
**Regression risk:** **medium** — `CompactRow`-এর markup layout math-এর সাথে যুক্ত; ভুল করলে page over/under-fill হবে।
**Testing:** keyboard-only পাস, VoiceOver/NVDA স্পট চেক, ৯২-item category-তে layout তুলনা।

---

### TASK 5 — Render performance
**Objective:** প্রতিটি tap-এ ৬৭২ card re-render বন্ধ; প্রথম render হালকা।
**Files:** `lib/cart.tsx`, `components/MenuPage.tsx`, `components/ItemCard.tsx`, `components/FlipbookViewer.tsx`, `lib/useViewport.ts` (new)
**Steps:**
1. Cart context দুই ভাগ: `CartStateContext` + `CartActionsContext` (actions stable)।
2. Card-কে শুধু নিজের qty subscribe করানো (per-item selector hook), অথবা `qty` prop রেখে `React.memo` + stable `qtyOf`।
3. `React.memo(MenuPage)`, `React.memo(ItemCard)`।
4. `useViewport()` hook — একটি resize listener, debounce 150ms; `MenuExperience` ও `FlipbookViewer` দুটোই ব্যবহার করবে (breakpoint duplication শেষ)।
5. Near-page rendering: current ± 2 এর বাইরে page-এ শুধু header + placeholder (একই height), flip-এ hydrate।
**Acceptance:** React Profiler-এ একটি "+" tap = শুধু সেই card (+ cart) re-render; ৯২-item category-তে flip smooth; page count/ordering অপরিবর্তিত।
**Regression risk:** **medium-high** — react-pageflip সব child DOM-এ চায়; placeholder-এর মাপ হুবহু মিলতে হবে।
**Testing:** ৪২ page × ২টি device; দ্রুত flip; jump-to-category; scroll-inside-page।

---

### TASK 6 — Order pipeline (admin) 🔴
**Objective:** order সত্যিই kitchen-এ পৌঁছানো।
**Files:** `tomafood-net/api/application/controllers/v2/Flipbook.php`, প্রাসঙ্গিক model
**Steps:**
1. `order_post()`-এ payload validate (restaurant, table আবশ্যক, qty 1..99, itemId ওই রেস্টুরেন্টের)।
2. **Server-side re-pricing** — `rcs_recipe.out_price` থেকে; client-এর দাম উপেক্ষা।
3. বিদ্যমান order flow-তে insert (`rcs_order` + `rcs_order_item`), source=`flipbook`, table_id সহ।
4. `idempotencyKey` দিয়ে duplicate suppress।
5. Response: আসল `orderNumber`, `total`, `status`।
6. Flipbook UI-তে order number + "Order more" দেখানো।
**Acceptance:** flipbook থেকে order → admin/POS-এ দৃশ্যমান, সঠিক টেবিল ও মোট; একই idempotencyKey দুবার = একটি order।
**Regression risk:** **HIGH** — বিদ্যমান POS/online order flow ছোঁয়া হচ্ছে। আলাদা branch, staging DB-তে আগে।
**Testing:** POS order ও online order আগের মতোই কাজ করছে কিনা — regression suite।

---

### TASK 7 — First-paint & caching
**Files:** `app/restaurant/[slug]/page.tsx`, `RestaurantMenuClient.tsx`, `lib/menu-source.ts`, `app/api/flipbook/menu/route.ts`
**Steps:** `?t=` থাকলে server-side fetch করে initial `Menu` prop হিসেবে পাঠানো (client fallback অটুট); proxy-তে `revalidate: 30` + `stale-while-revalidate`।
**Acceptance:** QR link-এ প্রথম HTML-এই cover render; ৩০s-এর মধ্যে পুনরাবৃত্ত scan admin-এ hit করে না।
**Risk:** medium (hydration mismatch)। **Testing:** JS off করে HTML যাচাই; দুইবার scan করে admin log।

---

### TASK 8 — UX polish
**Files:** `CartUI.tsx`, `ItemPopup.tsx`, `MenuPage.tsx`, `FlipbookViewer.tsx`, `globals.css`, নতুন `error.tsx`
**Steps:** order note field; cart line-এ category subtitle; "Goes well with" (একই subcategory থেকে ৩টি); flip 550ms; sound toggle (default off); view preference persist; `error.tsx` + empty-menu state; font woff2 + preload; description font weight।
**Acceptance:** প্রতিটি ছোট আইটেম আলাদা commit; কোনো layout regression নেই।

---

## Deliverable 9 — QA Checklist (Phase 10)

### Manual (প্রতিটি feature)
- [ ] QR scan (`?t=1`) → menu লোড; header-এ নাম + table
- [ ] `?t=` ছাড়া → localStorage থেকে table; কোনোটাই না থাকলে checkout blocked
- [ ] Flip: swipe, arrow, keyboard; cover → back cover পর্যন্ত
- [ ] TOC → ৩৭টি category-র প্রতিটিতে jump সঠিক page-এ
- [ ] ৯২-item category (Tikka Curries): accordion, scroll, শেষ row arrow-এর নিচে চাপা পড়ে না
- [ ] Add from card / popup / search → cart count + subtotal সঠিক
- [ ] Qty stepper (0-এ গেলে line মুছে যায়)
- [ ] Checkout success ও failure দুই path
- [ ] View toggle flip ⇄ list; scroll position ও active category বজায়

### Edge cases
- [ ] খালি menu (`categories: []`) — crash নয়, বার্তা
- [ ] একটিমাত্র item-এর category
- [ ] খুব লম্বা নাম (44 অক্ষর, real data-তে আছে) — truncate/wrap
- [ ] Duplicate নাম (১৭৩টি) — cart-এ পার্থক্য বোঝা যায়
- [ ] `discountPrice > price` (অসঙ্গত data)
- [ ] `currencySymbol` অনুপস্থিত
- [ ] localStorage disabled/full (private mode)
- [ ] Offline → menu error + Retry; order error + Retry
- [ ] দ্রুত double-tap Checkout → একটিই order
- [ ] Admin 500 / timeout / ভুল JSON

### Mobile (360–430px)
- [ ] 1-up card; type পড়া যায়; "+" mis-tap হয় না
- [ ] Landscape phone (height ~390) — scale ছোট হয়ে text অপাঠ্য হচ্ছে কিনা
- [ ] Safari 100dvh (address bar) — cart button ঢেকে যায় না
- [ ] Scroll-inside-page vs swipe-to-flip সংঘাত নেই
- [ ] iOS-এ flip sound autoplay ব্লক হলে console error নেই

### Tablet (768–1024px)
- [ ] 2-up spread; cover/back centred slide
- [ ] Portrait ⇄ landscape rotate — pages পুনর্গণনা, current category ধরে রাখে

### Desktop
- [ ] Keyboard nav; hover state; খুব চওড়া স্ক্রিনে (2560px) page অস্বাভাবিক নয়

### Performance
- [ ] Lighthouse mobile: LCP/CLS/INP রেকর্ড (before/after)
- [ ] React Profiler: একটি add = কতগুলো component re-render
- [ ] ৪২ page mount time; memory (DevTools)
- [ ] 3G throttle-এ first paint

### Accessibility
- [ ] Keyboard-only পুরো journey
- [ ] Screen reader: card, badge, price, cart update
- [ ] Contrast: badge, disableTextColor (#4a4a4a on white ✅), brand cover text
- [ ] Touch target ≥44px
- [ ] `prefers-reduced-motion`-এ flip ও fly-chip

### Regression (প্রতিটি task-এর পর)
- [ ] `tsc --noEmit` clean · `next build` clean
- [ ] Page count ও category ক্রম অপরিবর্তিত (৩৭ section page + cover + back)
- [ ] Cart persist across refresh
- [ ] Metadata: title/og/themeColor সঠিক
- [ ] POS/online order flow অক্ষত (TASK 6-এর পর — **আবশ্যক**)

---

## Deliverable 10 — Deployment Readiness Checklist

| আইটেম | অবস্থা |
|---|---|
| Build reproducible (`next build`) | ✅ pass |
| Type safety (`strict: true`, `tsc` clean) | ✅ |
| Env config | 🔴 `file_url` hardcoded localhost; `.env.example` নেই |
| Secrets management | ✅ কোনো secret কোডে নেই (admin API public) |
| Error boundary (`error.tsx` / `not-found.tsx`) | 🔴 নেই |
| Logging / monitoring | 🔴 নেই (Sentry/analytics কিছুই না) |
| Health check endpoint | 🔴 নেই |
| Security headers / CSP | 🔴 `next.config.mjs`-এ কিছুই নেই |
| HTTPS media (mixed content) | 🔴 media base `http://` |
| Rate limiting (order endpoint) | 🔴 নেই — public POST proxy |
| Input validation (order proxy) | ⚠️ শুধু `items` non-empty (`route.ts:11`); qty/id validate হয় না |
| Caching strategy | ⚠️ সব `no-store` |
| Automated tests | 🔴 শূন্য |
| CI pipeline | 🔴 নেই |
| Rollback plan | ⚠️ git আছে, deploy process নথিভুক্ত নয় |
| Docs (README) | 🔴 **ভুল** — মুছে ফেলা PDF flow বর্ণনা করে |
| Analytics/funnel | 🔴 নেই — conversion মাপার উপায় নেই |
| Legal: allergen info | 🔴 ৬৭২ item-এ allergen flag ~০; UK-তে dine-in allergen তথ্য দেখানো বাধ্যতামূলক — অন্তত disclaimer + "ask staff" লাইন লাগবে |

---

## Deliverable 11 — Production Risk Assessment

| # | ঝুঁকি | সম্ভাবনা | প্রভাব | ব্যবস্থা |
|---|---|---|---|---|
| R1 | **Order kitchen-এ পৌঁছায় না, অথচ গ্রাহক "placed" দেখে** | নিশ্চিত | 🔴 সর্বোচ্চ — গ্রাহক ক্ষোভ, রাজস্ব ক্ষতি | TASK 6। **ততক্ষণ পর্যন্ত production-এ চালু নয়** |
| R2 | Media base localhost → logo/ছবি ভাঙা, HTTPS-এ mixed content | নিশ্চিত deploy-এ | 🔴 উচ্চ | TASK 1 |
| R3 | Cross-restaurant cart leak | মাঝারি (multi-tenant) | 🔴 উচ্চ — ভুল order | TASK 2 |
| R4 | Table ছাড়া/ভুল table-এ order | মাঝারি | 🔴 উচ্চ | TASK 2 |
| R5 | Duplicate order (double tap / retry) | মাঝারি | 🟠 মাঝারি | idempotency key (TASK 2+6) |
| R6 | Peak-এ প্রতিটি scan = full 152 KB admin hit | উচ্চ (ব্যস্ত সময়) | 🟠 মাঝারি — admin overload | TASK 7 |
| R7 | পুরনো ফোনে ৬৭২ card render → jank/ক্র্যাশ | মাঝারি | 🟠 মাঝারি | TASK 5 |
| R8 | Search না থাকায় গ্রাহক হাল ছেড়ে waiter ডাকেন | উচ্চ | 🟠 মাঝারি — product ব্যর্থতা | TASK 3 |
| R9 | Allergen তথ্যের অভাব | উচ্চ | 🔴 উচ্চ (আইনি + নিরাপত্তা) | Disclaimer এখনই; data পরে (P1-5) |
| R10 | Public order endpoint-এ কোনো rate limit/validation নেই | মাঝারি | 🟠 মাঝারি — spam order | TASK 6-এ validation + rate limit |
| R11 | Client দাম দেখায়, server re-price করে না | নিশ্চিত (আজ কোনো price-ই নেই) | 🟠 মাঝারি — বিরোধ | TASK 6 |
| R12 | Zero test → প্রতিটি refactor-এ regression | উচ্চ | 🟠 মাঝারি | P3-8; ততক্ষণ QA checklist বাধ্যতামূলক |
| R13 | Render throw করলে white screen | কম | 🟠 মাঝারি | `error.tsx` (P2-5) |

---

## সারসংক্ষেপ — ৩ লাইনে

1. **Codebase-এর মান প্রত্যাশার চেয়ে ভালো** — layout engine, scale math, skeleton, accent/contrast handling পরিণত ও ভালোভাবে ব্যাখ্যা করা; `tsc` ও build দুটোই clean।
2. **কিন্তু product হিসেবে এটি এখনো "ordering system" নয়** — order kitchen-এ পৌঁছায় না, search নেই, customization নেই, payment নেই।
3. **সবচেয়ে বড় লিভার কোডে নয় — data-তে:** ৬৭২ item-এ ছবি ০, description ১৬, allergen ~০। UI যে premium অভিজ্ঞতার জন্য তৈরি, সেই কাঁচামালই অনুপস্থিত।

**প্রস্তাবিত ক্রম:** TASK 1 → 2 → 3 → 6 → 4 → 5 → 7 → 8।
(TASK 6 admin-side, তাই 3-এর পর সমান্তরালে শুরু করা যায়।)
