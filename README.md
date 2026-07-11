# FlipBook — PDF to Flipbook

Heyzine-এর মতো একটি ফ্লিপবুক ভিউয়ার। PDF আপলোড করলে প্রতিটি পেজ রেন্ডার হয়ে
বাস্তব বই-এর মতো পেজ উল্টানোর অ্যানিমেশনসহ দেখা যায়। সম্পূর্ণ ক্লায়েন্ট-সাইড —
কোনো ফাইল সার্ভারে আপলোড হয় না।

## Tech Stack

- **Next.js 15** (App Router)
- **Tailwind CSS 3**
- **pdf.js** (`pdfjs-dist`) — PDF এর প্রতিটি পেজ ইমেজে রেন্ডার করে
- **react-pageflip** — পেজ-ফ্লিপ অ্যানিমেশন

## Features

- 📄 PDF আপলোড (ড্র্যাগ-ড্রপ বা ব্রাউজ)
- 📖 বাস্তব বই-এর মতো পেজ উল্টানো
- ◀ ▶ Prev / Next + কীবোর্ড (Arrow keys)
- 🔍 জুম ইন / আউট
- 🎚️ পেজ স্লাইডার দিয়ে দ্রুত নেভিগেশন
- ⛶ ফুলস্ক্রিন মোড
- 🔒 সব প্রসেসিং ব্রাউজারে — প্রাইভেসি সুরক্ষিত

## Getting Started

```bash
npm install
npm run dev
```

তারপর ব্রাউজারে http://localhost:3000 খুলুন।

## Production Build

```bash
npm run build
npm run start
```

## Project Structure

```
app/
  layout.tsx        # রুট লেআউট
  page.tsx          # আপলোড পেজ + অর্কেস্ট্রেশন
  globals.css       # Tailwind + ফ্লিপবুক স্টাইল
components/
  FlipbookViewer.tsx # ফ্লিপবুক + কন্ট্রোল বার
lib/
  pdf.ts            # pdf.js দিয়ে PDF → ইমেজ রেন্ডারিং
```
