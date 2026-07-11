# Flipbook Menu — Plans

রেস্টুরেন্টের PDF মেনুকে ইন্টার‍্যাক্টিভ ফ্লিপবুকে পরিণত করার প্রজেক্ট। এডমিন প্যানেল
(tomafood.net) থেকে PDF আপলোড হয়, এই অ্যাপ সেটা API-র মাধ্যমে এনে রেন্ডার করে, আইটেমে
ক্লিক করে কার্টে যোগ করা যায়, অর্ডার দেওয়া যায়, এবং (future) আইটেমের ছবি/ভিডিও দেখা যায়।

## এই ফোল্ডারের ফাইল

| ফাইল | বিষয় |
|---|---|
| [00-overview.md](00-overview.md) | সামগ্রিক আর্কিটেকচার, ডেটা-ফ্লো, মাইলস্টোন |
| [01-flipbook-app.md](01-flipbook-app.md) | এই অ্যাপে (flipbook) কী কী কাজ |
| [02-admin-app.md](02-admin-app.md) | এডমিন প্যানেলে কী কী কাজ |
| [03-media-feature.md](03-media-feature.md) | আইটেমের ছবি/ভিডিও (media button) ফিচার |
| [api-contract.md](api-contract.md) | দুই অ্যাপের মধ্যে JSON API চুক্তি |

## বর্তমান অবস্থা (2026-07-11)

- **Stack:** Next.js 16, React 19, `pdfjs-dist`, `react-pageflip`, Tailwind
- **তৈরি (mock API দিয়ে চলছে):** API-driven PDF loading, PDF proxy, auto-detect
  hotspot, cart, checkout — বিস্তারিত [01-flipbook-app.md](01-flipbook-app.md)-এ।
- **বাকি:** এডমিন side (item catalog, hotspot editor, media manager), media
  lightbox, আসল API যুক্ত করা।

## মূল সিদ্ধান্ত

1. **Hotspot:** PDF text থেকে auto-detect (এডমিনে পরে ম্যানুয়াল সংশোধন-লেয়ার)।
2. **PDF fetch:** নিজের Next.js proxy (`/api/pdf-proxy`) দিয়ে — CORS এড়াতে।
3. **API:** এখন mock; আসল API পরে একই response-shape মেনে বানানো হবে।
4. **Media:** ভিডিও = YouTube/Vimeo embed, ছবি = এডমিন আপলোড → CDN।
