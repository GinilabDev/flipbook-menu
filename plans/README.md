# Flipbook Menu — Plans

**টেবিলের QR স্ক্যান → সেই রেস্টুরেন্টের মেনু ফ্লিপবুক আকারে → cart → অর্ডার।**

কাস্টমার টেবিলের QR/বারকোড স্ক্যান করে, সেই রেস্টুরেন্টের মেনু একটা ফ্লিপবুক-টেমপ্লেটে
লোড হয়, আইটেমে ট্যাপ করে কার্টে যোগ করা যায় ও অর্ডার দেওয়া যায়। আইটেমের ছবি/ভিডিও
দেখা যায়। পুরোটা মোবাইল-রেসপনসিভ।

> ⚠️ **পরিবর্তন (2026-07-12):** আগের PDF-ভিত্তিক পরিকল্পনা বাতিল। এখন PDF নয় —
> রেস্টুরেন্টের **structured মেনু-ডেটা** (এডমিন DB) থেকে আইটেম এসে ফ্লিপবুক টেমপ্লেটের
> পেজে বসবে। পুরনো PDF/auto-detect কোড ঐচ্ছিক "import" টুল হিসেবে থাকতে পারে (মূল ফ্লো নয়)।

## দুই প্রজেক্ট

| প্রজেক্ট | পাথ | স্ট্যাক | ভূমিকা |
|---|---|---|---|
| Flipbook (এই repo) | `d:\ginilabProjects\flipbook-menu` | Next.js 16 / React 19 / Tailwind | কাস্টমার-facing ফ্লিপবুক |
| Admin (tomafood) | `d:\laragon\www\tomafood-net` | CodeIgniter (PHP) + MySQL | মেনু/টেবিল/অর্ডার ডেটা + API |

## ফাইল

| ফাইল | বিষয় |
|---|---|
| [00-overview.md](00-overview.md) | নতুন আর্কিটেকচার, QR-ফ্লো, মাইলস্টোন |
| [01-flipbook-app.md](01-flipbook-app.md) | ফ্লিপবুক অ্যাপের কাজ (layout engine, list টগল) |
| [02-admin-app.md](02-admin-app.md) | এডমিনের কাজ (API endpoint, QR, video ফিল্ড) |
| [03-media-feature.md](03-media-feature.md) | আইটেমের ছবি/ভিডিও |
| [04-data-mapping.md](04-data-mapping.md) | DB টেবিল → ফ্লিপবুক JSON ম্যাপিং |
| [api-contract.md](api-contract.md) | দুই অ্যাপের JSON চুক্তি |

## চূড়ান্ত সিদ্ধান্ত

1. **Layout:** fixed template slots (প্রতি পেজে নির্দিষ্ট সংখ্যক আইটেম, ক্যাটাগরি নতুন পেজে)।
2. **Mobile:** ফ্লিপবুক (single-page) + একটা "list view" টগল।
3. **Theme:** একটি template, প্রতি রেস্টুরেন্টে শুধু রঙ + logo।
4. **ভিডিও:** YouTube/Vimeo embed · **ছবি:** এডমিন আপলোড → CDN।
5. **অর্ডার:** টেবিল-context সহ, বিদ্যমান tomafood order API-তে যুক্ত।
