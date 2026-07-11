# 00 — সামগ্রিক আর্কিটেকচার ও প্ল্যান

## লক্ষ্য

এডমিন প্যানেল থেকে আপলোড করা রেস্টুরেন্ট-মেনু PDF-কে একটা ইন্টার‍্যাক্টিভ ফ্লিপবুকে
রূপ দেওয়া, যেখানে —

1. PDF API-র মাধ্যমে লোড হয়ে flipbook হিসেবে দেখা যায়,
2. PDF-এর আইটেমে ক্লিক করে কার্টে যোগ করা যায়,
3. কার্ট থেকে অর্ডার দেওয়া যায়,
4. (future) আইটেমের পাশে media button দিয়ে ছবি/ভিডিও দেখা যায়,
5. মোবাইল / ট্যাবলেট / ডেস্কটপ — সব জায়গায় responsive।

## মূল টেকনিক্যাল চ্যালেঞ্জ — Hotspot mapping

PDF যখন image-এ রেন্ডার হয়, তাতে "আইটেম" বলে কিছু থাকে না — শুধু pixel। আইটেমে ক্লিক
করাতে হলে দরকার **hotspot**: প্রতিটি আইটেমের অবস্থান (পেজের অনুপাতে `x,y,w,h`) আর তার
সাথে যুক্ত আইটেম-তথ্য (নাম, দাম, media)।

- **এখন:** flipbook নিজেই PDF-এর text পড়ে দাম-প্যাটার্ন খুঁজে hotspot **auto-detect**
  করে (`lib/detect.ts`)।
- **পরে:** এডমিনে ভিজ্যুয়াল editor দিয়ে auto-detect ফলাফল সংশোধন/স্থায়ী করা হবে।
- দুই ক্ষেত্রেই আউটপুট একই `Hotspot` shape — তাই flipbook কোড বদলায় না।

## আর্কিটেকচার ও ডেটা-ফ্লো

```
┌─────────────────────────┐         ┌──────────────────────────┐
│  ADMIN (tomafood.net)   │         │  FLIPBOOK APP (this repo) │
│                         │         │                          │
│ 1. PDF আপলোড            │         │ 1. GET /api/menu         │
│ 2. Item catalog +       │  API →  │ 2. PDF → image রেন্ডার   │
│    hotspot সংশোধন       │ ◄─JSON─ │ 3. hotspot overlay       │
│ 3. Media manager        │         │ 4. ক্লিক → cart          │
│ 4. অর্ডার ম্যানেজ        │  ◄POST─ │ 5. checkout → order      │
└─────────────────────────┘  order  └──────────────────────────┘
```

সম্পূর্ণ JSON চুক্তি → [api-contract.md](api-contract.md)।

## ডেটা মডেল (এডমিন DB — প্রস্তাবিত)

```
Restaurant 1─* Menu 1─* MenuItem 1─* Media
MenuItem   1─* Hotspot         (hotspot.pageNumber + rect)
Order      1─* OrderItem *─1 MenuItem
```

> **নোট:** `MenuItem` স্থায়ী (stable id), `Hotspot` সেই আইটেমকে PDF পেজে map করে।
> Media স্থায়ী itemId-র উপর নির্ভরশীল — তাই media feature-এর আগে item catalog দরকার।

## মাইলস্টোন

| ধাপ | কাজ | অ্যাপ | অবস্থা |
|---|---|---|---|
| 0 | API contract চূড়ান্ত | দুই দল | ✅ (mock) |
| 1 | API থেকে PDF লোড + রেন্ডার | flipbook | ✅ |
| 2 | Auto-detect hotspot | flipbook | ✅ |
| 3 | Hotspot overlay + cart | flipbook | ✅ |
| 4 | Order API + checkout | দুই অ্যাপ | ✅ mock / ⬜ real |
| 5 | Admin: item catalog + hotspot editor | admin | ⬜ |
| 6 | Media: badge + lightbox (M1–M3) | flipbook | ⬜ |
| 7 | Media: manager + real API (M4–M5) | admin | ⬜ |

বিস্তারিত: [01-flipbook-app.md](01-flipbook-app.md) · [02-admin-app.md](02-admin-app.md)
· [03-media-feature.md](03-media-feature.md)
