import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#6366f1",
          dark: "#4f46e5",
        },
      },
      boxShadow: {
        book: "0 25px 60px -15px rgba(0,0,0,0.55)",
      },
    },
  },
  plugins: [],
};

export default config;
