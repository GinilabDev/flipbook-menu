# 02 — Admin অ্যাপ (tomafood.net)

এই অংশটা আলাদা এডমিন প্যানেলে হবে। flipbook শুধু API consume করে, তাই এডমিনের
দায়িত্ব হলো নিচের ডেটা তৈরি করে [api-contract.md](api-contract.md)-এর shape-এ সার্ভ করা।

## ১. PDF আপলোড ও স্টোরেজ
- Menu-র সাথে PDF যুক্ত করে রাখা, একটা `pdfUrl` দেওয়া (CDN/সার্ভার)।
- একই রেস্টুরেন্টের একাধিক menu ভার্সন সাপোর্ট করলে ভালো।

## ২. Item catalog (media-র ভিত্তি)
- প্রতিটি আইটেমের **স্থায়ী `itemId`**, নাম, দাম, description।
- auto-detect ফলাফল import করে দ্রুত catalog বানানো যায় (flipbook-এর detect লজিক
  রেফারেন্স হিসেবে ব্যবহার করা যায়), তারপর ম্যানুয়ালি সংশোধন।

## ৩. Visual Hotspot editor (সবচেয়ে বড় কাজ)
- PDF পেজ রেন্ডার করে তার উপর mouse দিয়ে rectangle আঁকা।
- প্রতিটি box-এ একটা catalog item assign করা; box move / resize / delete।
- rect **অনুপাতে (0–1)** সেভ — যাতে যেকোনো screen size / zoom-এ মিলে যায়।
- ঐচ্ছিক: auto-detect দিয়ে খসড়া box বানিয়ে দিয়ে শুধু সংশোধন করানো (কম কাজ)।

## ৪. Media manager (per item)
- ছবি আপলোড → সার্ভার/S3 → CDN URL (`type:"image"`)।
- ভিডিও: YouTube/Vimeo লিংক পেস্ট (`type:"video", provider:"youtube"|"vimeo"`)।
- একাধিক media, ক্রম সাজানো, thumbnail। বিস্তারিত [03-media-feature.md](03-media-feature.md)।

## ৫. API endpoints
- `GET /api/menu?restaurant={id}` → `Menu` (items + hotspots + media সহ)।
- `POST /api/order` → অর্ডার গ্রহণ + confirmation।
- shape অবশ্যই [api-contract.md](api-contract.md) মানতে হবে।

## ৬. Order management
- আসা অর্ডারের তালিকা, স্ট্যাটাস (received → preparing → done), বিস্তারিত।
