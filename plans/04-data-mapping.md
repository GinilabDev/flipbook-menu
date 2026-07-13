# 04 — DB টেবিল → Flipbook JSON ম্যাপিং

tomafood-net (CodeIgniter/MySQL) এর বিদ্যমান টেবিল থেকে flipbook API কীভাবে JSON
বানাবে। এটাই ব্যাকএন্ড টিমের রেফারেন্স। টাইপ শেপ: [api-contract.md](api-contract.md)।

## Restaurant
| JSON | সোর্স | নোট |
|---|---|---|
| `id` | `rcs_restaurant.id` | |
| `name` | `rcs_restaurant.name` | |
| `logoUrl` | `rcs_restaurant.logo` (বা website টেবিল) | পূর্ণ URL |
| `brandColor` | `rcs_restaurant_theme` / website (না থাকলে নতুন কলাম) | cover/theme |
| `currencySymbol` | রেস্টুরেন্ট locale/সেটিং | যেমন `£` |

## Category ← `rcs_recipe_category`
| JSON | কলাম |
|---|---|
| `id` | `id` |
| `name` | `name` |
| `description` | `description` |
| `color` | `color` |
| `sortOrder` | `sort_order` |
| (parent) | `parent_category_id`, `has_subcategory` → দরকারে `rcs_recipe_subcategory` |

শুধু `restaurant_id = {id}`; `sort_order` অনুযায়ী সাজানো।

## MenuItem ← `rcs_recipe`
| JSON | কলাম | নোট |
|---|---|---|
| `id` | `id` | স্থায়ী — media/order-এ ব্যবহৃত |
| `name` | `name` | |
| `shortDesc` | `shortdesc` | কার্ডে |
| `longDesc` | `longdesc` | popup/lightbox-এ |
| `price` | `out_price` | কাস্টমার দাম |
| `discountPrice` | `discount_price` | > 0 হলে কাটা-দাম দেখাও |
| `categoryId` | `category_id` | |
| `subcategoryId` | `subcategory_id` | |
| `sortOrder` | `sort_order` | |
| `veg` / `hot` / `nut` | `veg` / `hot` / `nut` | ব্যাজ |
| `media` | নিচে দেখুন | |

ফিল্টার: `restaurant_id = {id}`, শুধু available/active, `out_price > 0`।

## Media ← `rcs_recipe_images` / `rcs_recipe_photo` (+ video)
| JSON | সোর্স |
|---|---|
| image `url` | `rcs_recipe_images.image` বা `rcs_recipe_photo.imagename` → পূর্ণ URL |
| image `thumbnail` | `rcs_recipe_photo.thumbnail` |
| featured ক্রম | `rcs_recipe_images.is_featured` আগে |
| video `url`/`provider` | **নতুন** `video_url`/`video_provider` কলাম বা `rcs_recipe_media` টেবিল |

## Table (QR) ← `rcs_restaurant_table`
| ব্যবহার | কলাম |
|---|---|
| QR টার্গেট | `id` (tableId) + `restaurant_id` |
| লেবেল/প্রিন্ট | `name`, `area_id`→`rcs_restaurant_table_area` |
| soft-delete | `deleted_at` NULL কেবল |

QR URL: `https://menu.tomafood.net/r/{restaurant_id}?t={table_id}`।

## Order → বিদ্যমান order ফ্লো
| পাঠানো | ম্যাপ |
|---|---|
| `restaurant` | `rcs_order.restaurant_id` |
| `table` | `rcs_order` টেবিল-ফিল্ড (dine-in) |
| `items[].itemId` | `rcs_order_item.recipe_id` |
| `items[].qty` | qty |
| `items[].options` | `rcs_order_item_attributes` / `rcs_option_item` |
| `note` | order note |
| উৎস | "flipbook/QR" মার্ক |

বিদ্যমান `Order_model` / `Orderpad.php` reuse; শুধু flipbook payload ম্যাপ করা।

## Options / variants (থাকলে) ← `rcs_recipe_option` / `rcs_option_item`
- আইটেমে size/addon থাকলে popup-এ দেখানো; দাম সেই অনুযায়ী।
- প্রথম ভার্সনে বাদ রেখে পরে যোগ করা যায়।
