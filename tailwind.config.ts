import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        "paper-raised": "var(--paper-raised)",
        ink: "var(--ink)",
        "ink-soft": "var(--ink-soft)",
        line: "var(--line)",
        brand: "var(--brand)",
        "brand-foreground": "var(--brand-foreground)",
        accent: "var(--accent)",
        info: "var(--info)",
        caution: "var(--caution)",
        warning: "var(--warning)",
        critical: "var(--critical)",
        ok: "var(--ok)",
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
