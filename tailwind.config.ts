import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // on the restaurant page; the fallback matches the ref's multi-tenant value.
        highlightColor: "var(--main-color, #f36805)",
        // Kept from the flipbook's own config — used for page copy.
        titleColor: "#1F293B",
        descriptionColor: "#242e30",
        disableColor: "#dddddd",
        disableTextColor: "#4a4a4a",
      },
      fontFamily: {
        titleFont: ["Acumin Pro", "sans-serif"], // title font
        descriptionFont: ["Fivo Sans", "sans-serif"], // Description font
      },
      boxShadow: {
        book: "0 25px 60px -15px rgba(0,0,0,0.55)",
      },
    },
  },
  plugins: [],
};

export default config;
