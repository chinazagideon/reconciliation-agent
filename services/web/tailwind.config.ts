import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Design tokens from PRD section 4.1
      colors: {
        // Surface
        surface: {
          DEFAULT: "#FFFFFF",
          dark: "#1A1D27",
        },
        background: {
          DEFAULT: "#FAFAFA",
          dark: "#0F1117",
        },
        // Semantic colours — map to reconciliation concepts
        matched: "#16A34A",     // green: deterministic match
        unmatched: "#DC2626",   // red: no match found
        explained: "#2563EB",   // blue: AI hypothesis
        review: "#D97706",      // amber: awaiting human
        fraud: "#DC2626",       // red: anomaly flag
        muted: "#6B7280",
        border: "#E5E7EB",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
