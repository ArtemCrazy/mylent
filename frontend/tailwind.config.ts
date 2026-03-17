import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 12px 2px rgba(96,165,250,0.20)" },
          "50%": { boxShadow: "0 0 28px 6px rgba(96,165,250,0.45)" },
        },
      },
      animation: {
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
