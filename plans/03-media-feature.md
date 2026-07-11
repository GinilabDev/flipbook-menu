# 03 — Media feature (আইটেমের ছবি/ভিডিও)

আইটেমের পাশে একটা media button, যেটা দিয়ে সেই আইটেমের ছবি বা ভিডিও দেখা যাবে।

## সিদ্ধান্ত (2026-07-11)

| বিষয় | সিদ্ধান্ত | কারণ |
|---|---|---|
| ভিডিও হোস্টিং | **YouTube/Vimeo embed** | server bandwidth লাগে না, রেডিমেড প্লেয়ার, ভালো buffering |
| ছবি | **এডমিনে আপলোড → CDN/সার্ভার URL** | নিজের নিয়ন্ত্রণ, লিংক ভাঙার ঝুঁকি নেই |

## ⚠️ মূল নির্ভরতা — stable itemId

এখন আইটেম-ID auto-detect থেকে আসে (`it_page2_5`) — **অস্থায়ী**। PDF/detection বদলালে
পাল্টে যায়। কিন্তু media একটা নির্দিষ্ট আইটেমে স্থায়ীভাবে বাঁধা থাকতে হবে। তাই media
feature-এর জন্য এডমিনে **stable itemId সহ item catalog** ([02-admin-app.md](02-admin-app.md#২-item-catalog-media-র-ভিত্তি)) দরকার — এটাই M4-এর মূল কাজ।

## ডেটা contract (সামান্য এক্সটেনশন — breaking নয়)

```jsonc
"media": [
  { "type": "image", "url": "https://cdn.tomafood.net/items/biryani-1.jpg", "thumbnail": "..." },
  { "type": "video", "provider": "youtube", "url": "https://youtu.be/abc123" },
  { "type": "video", "provider": "vimeo",   "url": "https://vimeo.com/12345678" }
]
```

`Media` টাইপ: `{ type:'image'|'video', url, provider?:'youtube'|'vimeo'|'file', thumbnail? }`।
`MenuItem.media[]` ইতিমধ্যেই `lib/menu.ts`-এ আছে; শুধু `provider?`/`thumbnail?` যোগ হবে।

## Flipbook-এ view (UX)

- **Badge:** media-যুক্ত আইটেমের hotspot কোণায় (top-right) ছোট 📷/▶ আইকন —
  **শুধু যেসব আইটেমে `media` আছে** তাদের জন্য।
- **ক্লিক → lightbox modal:**
  - একাধিক media → carousel (swipe/arrow)।
  - image → বড় করে (pinch-zoom ঐচ্ছিক)।
  - video → inline player: YouTube/Vimeo iframe (provider অনুযায়ী)।
  - নিচে আইটেম নাম, দাম, "Add to cart"।
- **রেসপনসিভ:** মোবাইলে fullscreen sheet, ডেস্কটপে centered modal।
- **পারফরম্যান্স:** modal না খোলা পর্যন্ত ভিডিও/বড় ছবি **lazy-load**।
- **ইন্টার‍্যাকশন আলাদা:** আইটেমে ক্লিক = cart popup; media আইকনে ক্লিক = lightbox
  (`stopPropagation` দিয়ে আলাদা)।

## ধাপ

| ধাপ | কাজ | অ্যাপ |
|---|---|---|
| M1 | contract-এ `provider`/`thumbnail` + **mock media** দিয়ে টেস্ট | flipbook |
| M2 | hotspot-এ media badge (শুধু media থাকলে) | flipbook |
| M3 | Lightbox modal (carousel + embed player, lazy-load) | flipbook |
| M4 | Item catalog + media manager | admin |
| M5 | আসল media API যুক্ত | admin |

M1–M3 mock media দিয়ে এখনই flipbook-এ বানানো যায় (ব্রাউজারে দেখে নেওয়ার জন্য);
M4–M5 এডমিনে।
