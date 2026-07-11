# 01 — Flipbook অ্যাপ (this repo)

## ✅ যা তৈরি (mock API দিয়ে end-to-end চলছে)

### API লেয়ার (mock — পরে আসল API এই shape-এ আসবে)
- `app/api/menu/route.ts` — `Menu` JSON রিটার্ন (pdfUrl, currency, items, hotspots)।
- `app/api/pdf-proxy/route.ts` — CORS এড়িয়ে external PDF আনে (host-whitelisted)।
- `app/api/order/route.ts` — কার্ট থেকে অর্ডার নেয়।

### কোর লজিক
- `lib/menu.ts` — শেয়ার্ড ডেটা contract (`Menu`, `MenuItem`, `Hotspot`, `Media`, `Rect`)।
- `lib/pdf.ts` — URL/ArrayBuffer থেকে PDF রেন্ডার + text-position এক্সট্র্যাকশন।
- `lib/detect.ts` — auto-detect: দাম-প্যাটার্ন খুঁজে নাম যুক্ত করে hotspot বানায়
  (multi-column + wrapped-title merge সাপোর্ট)।
- `lib/cart.tsx` — Cart state (Context + reducer, localStorage-এ persist)।

### UI
- `components/FlipbookViewer.tsx` — পেজের উপর hotspot overlay + item popup
  (qty + Add), "Show item areas" ডিবাগ টগল।
- `components/CartUI.tsx` — floating cart button + responsive drawer + checkout।
- `app/page.tsx` — API থেকে লোড → render → auto-detect → viewer।

## ⬜ বাকি কাজ

### A. Auto-detect যাচাই ও উন্নতি
- আসল PDF-এ ব্রাউজারে চালিয়ে detection accuracy দেখা (কতগুলো আইটেম ধরল, ভুল কতটা)।
- দরকারে heuristic টিউন করা (currency ছাড়া দাম, dotted leader, section heading বাদ)।

### B. আলাদা `/checkout` পেজ (এখন drawer-এ inline)
- customer info (নাম, ফোন, টেবিল/ঠিকানা), note, অর্ডার summary।
- `POST /api/order` → confirmation পেজ।

### C. Media (দেখুন [03-media-feature.md](03-media-feature.md))
- hotspot-এ media badge → lightbox modal।

### D. Responsive polish
- মোবাইলে বড় tap-target, single-page; ট্যাবলেট/ডেস্কটপে spread — কাঠামো আছে,
  hotspot ও drawer আরও পরিমার্জন।

## যাচাই

- ✅ `tsc --noEmit` পাস।
- ✅ তিনটি API endpoint curl-এ যাচাই (menu / pdf-proxy 158KB / order)।
- ⬜ PDF রেন্ডার + auto-detect ব্রাউজারে যাচাই (canvas — headless-এ সম্ভব নয়)।
