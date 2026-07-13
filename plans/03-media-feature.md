# 03 — Media feature (আইটেমের ছবি/ভিডিও)

item কার্ডে media badge → ক্লিকে lightbox-এ ছবি/ভিডিও।

## সিদ্ধান্ত
| বিষয় | সিদ্ধান্ত | কারণ |
|---|---|---|
| ভিডিও | **YouTube/Vimeo embed** | server bandwidth নেই, রেডিমেড প্লেয়ার |
| ছবি | **এডমিনে আপলোড → CDN/সার্ভার URL** | নিয়ন্ত্রণ, লিংক ভাঙার ঝুঁকি নেই |

## ডেটা
data-driven approach-এ আইটেমের `id` স্থায়ী (`rcs_recipe.id`) — তাই আগের "unstable
id" সমস্যা নেই। media সরাসরি আইটেমের সাথে আসে:

```jsonc
"media": [
  { "type": "image", "url": "https://cdn.tomafood.net/recipe/12/a.jpg", "thumbnail": "..." },
  { "type": "video", "provider": "youtube", "url": "https://youtu.be/abc123" }
]
```
`Media = { type:'image'|'video', url, provider?:'youtube'|'vimeo'|'file', thumbnail? }`

সোর্স: ছবি ← `rcs_recipe_images`/`rcs_recipe_photo`; ভিডিও ← নতুন কলাম/টেবিল
(দেখুন [02-admin-app.md](02-admin-app.md#৩-item-video-ফিল্ড-এখন-নেই))।

## Flipbook view
- **Badge:** যেসব আইটেমে `media` আছে, তাদের কার্ডের কোণায় 📷/▶ আইকন।
- **ক্লিক → lightbox:** carousel (একাধিক media), image বড় করে, video = provider
  অনুযায়ী iframe (YouTube/Vimeo) বা `<video>` (file)।
- নিচে নাম, দাম, "Add to cart"।
- মোবাইলে fullscreen sheet, ডেস্কটপে centered modal; ভিডিও **lazy-load**।
- item-ক্লিক (cart) আর media-ক্লিক (lightbox) `stopPropagation` দিয়ে আলাদা।

## ধাপ
| ধাপ | কাজ | অ্যাপ |
|---|---|---|
| M1 | mock media দিয়ে টেস্ট | flipbook |
| M2 | কার্ডে media badge | flipbook |
| M3 | lightbox (carousel + embed, lazy) | flipbook |
| M4 | Admin: video ফিল্ড + media API | admin |
| M5 | আসল media ডেটা যুক্ত | দুই অ্যাপ |
