import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "color-mix(in srgb, var(--paper) calc(<alpha-value> * 100%), transparent)",
        "paper-raised": "color-mix(in srgb, var(--paper-raised) calc(<alpha-value> * 100%), transparent)",
        ink: "color-mix(in srgb, var(--ink) calc(<alpha-value> * 100%), transparent)",
        "ink-soft": "color-mix(in srgb, var(--ink-soft) calc(<alpha-value> * 100%), transparent)",
        line: "color-mix(in srgb, var(--line) calc(<alpha-value> * 100%), transparent)",
        brand: "color-mix(in srgb, var(--brand) calc(<alpha-value> * 100%), transparent)",
        "brand-foreground": "color-mix(in srgb, var(--brand-foreground) calc(<alpha-value> * 100%), transparent)",
        accent: "color-mix(in srgb, var(--accent) calc(<alpha-value> * 100%), transparent)",
        info: "color-mix(in srgb, var(--info) calc(<alpha-value> * 100%), transparent)",
        caution: "color-mix(in srgb, var(--caution) calc(<alpha-value> * 100%), transparent)",
        warning: "color-mix(in srgb, var(--warning) calc(<alpha-value> * 100%), transparent)",
        critical: "color-mix(in srgb, var(--critical) calc(<alpha-value> * 100%), transparent)",
        ok: "color-mix(in srgb, var(--ok) calc(<alpha-value> * 100%), transparent)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Avenir Next", "Segoe UI", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      borderRadius: {
        lygo: "var(--radius)",
      },
    },
  },
  plugins: [],
};

export default config;
