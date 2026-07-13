# 02 — Admin (tomafood-net, CodeIgniter + MySQL)

**সুখবর:** মেনু-ডেটা DB-তে আগে থেকেই আছে (`rcs_recipe`, `rcs_recipe_category`,
`rcs_recipe_images`, `rcs_restaurant_table` ...)। তাই বেশিরভাগ কাজ = বিদ্যমান ডেটাকে
JSON API-তে expose করা + কয়েকটা নতুন জিনিস (QR, video ফিল্ড)।

পূর্ণ টেবিল→JSON ম্যাপিং: [04-data-mapping.md](04-data-mapping.md)।

## ১. Menu JSON API endpoint (মূল কাজ)
- নতুন controller, যেমন `api/application/controllers/v2/Flipbook.php`।
- `GET /api/v2/flipbook/menu?restaurant={id}` → `{ restaurant, categories[], items[] }`।
- সোর্স:
  - `categories` ← `rcs_recipe_category` (restaurant_id, sort_order, name, color;
    subcategory দরকার হলে `rcs_recipe_subcategory`)।
  - `items` ← `rcs_recipe` (name, shortdesc, longdesc, out_price, discount_price,
    category_id, veg/hot/nut, sort_order; শুধু active/available)।
  - `media` ← `rcs_recipe_images` / `rcs_recipe_photo` + নতুন video ফিল্ড।
- ছবির পূর্ণ URL বানানো (CDN/uploads path)।
- শুধু কাস্টমারকে দেখানোর মতো আইটেম (available, price > 0) ফিল্টার।

## ২. Table QR generate / print
- ডেটা রেডি: `rcs_restaurant_table` (id, restaurant_id, name, area_id)।
- প্রতি টেবিলের জন্য QR = `https://menu.tomafood.net/r/{restaurantId}?t={tableId}`।
- এডমিন UI: টেবিল তালিকায় "QR ডাউনলোড/প্রিন্ট" (PNG/PDF, নাম-সহ)।
- QR জেনারেশন সার্ভার-সাইড (PHP QR lib) বা ফ্রন্টে।

## ৩. Item video ফিল্ড (এখন নেই)
- ভিডিও রাখার জায়গা যোগ করা — দুইভাবে:
  - সহজ: `rcs_recipe`-এ `video_url` + `video_provider` কলাম, বা
  - পরিষ্কার: নতুন `rcs_recipe_media` টেবিল (recipe_id, type, url, provider,
    thumbnail, sort_order) — image+video একসাথে।
- এডমিন recipe-edit ফর্মে YouTube/Vimeo লিংক ইনপুট।

## ৪. Branding (রঙ + logo)
- Logo সাধারণত `rcs_restaurant`-এ; brand রঙ `rcs_restaurant_theme`/website টেবিলে
  (না থাকলে একটা `brand_color` কলাম)।
- API `restaurant` অবজেক্টে `logoUrl`, `brandColor` রিটার্ন।

## ৫. Order API (reuse)
- বিদ্যমান order ফ্লো আছে (`Order_model`, `rcs_order`/`rcs_order_item`,
  v1/v2 `Orderpad.php`)।
- flipbook থেকে আসা অর্ডার এই ফ্লোতে যুক্ত: `restaurant_id` + `table_id` +
  items[{recipeId, qty, options}] + note।
- অর্ডার-উৎস "flipbook/QR" মার্ক করা (রিপোর্টিং-এর জন্য)।
- কিচেন/অর্ডার-স্ক্রিনে টেবিল অনুযায়ী দেখানো (বিদ্যমান)।

## ৬. (ঐচ্ছিক) PDF import টুল
- পুরনো flipbook-এর `detect.ts` লজিক দিয়ে PDF মেনু পড়ে দ্রুত `rcs_recipe` seed —
  শুধু ডেটা-এন্ট্রি সহায়ক, কাস্টমার ফ্লোতে নয়।

## নিরাপত্তা/নোট
- এন্ডপয়েন্ট পাবলিক (QR যে কেউ স্ক্যান করবে) — শুধু পড়ার ডেটা, কোনো সংবেদনশীল তথ্য নয়।
- restaurant_id দিয়ে scoping; rate-limit; ছবি/ভিডিও URL validate।
- CORS: flipbook ডোমেইন allow করা (নয়তো আগের মতো proxy)।
