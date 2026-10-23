import type { Config } from "tailwindcss";

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        clay: {
          DEFAULT: "#d97757",
          hover: "#cc5a36",
          light: "#fbf3ef",
          dark: "#e08264",
        },
        surface: {
          0: "var(--cds-surface-0)",
          1: "var(--cds-surface-1)",
          2: "var(--cds-surface-2)",
          3: "var(--cds-surface-3)",
          popover: "var(--cds-surface-popover)",
        },
        primary: {
          DEFAULT: "rgb(var(--primary-rgb) / <alpha-value>)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--background-muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
      },
      fontFamily: {
        sans: [
          "AnthropicSans",
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "PingFang SC",
          "sans-serif",
        ],
        serif: [
          "AnthropicSerif",
          "Newsreader",
          "ui-serif",
          "Georgia",
          "Times New Roman",
          "serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SF Mono",
          "Menlo",
          "monospace",
        ],
      },
      borderRadius: {
        xs: "var(--radius-xs, 2px)",
        sm: "var(--radius-sm, 4px)",
        md: "var(--radius-md, 6px)",
        lg: "var(--radius-lg, 8px)",
        panel: "var(--cds-panel-radius, 10px)",
        xl: "var(--radius-xl, 12px)",
        "2xl": "var(--radius-2xl, 16px)",
        bubble: "var(--cds-message-bubble-radius, 18px)",
        composer: "var(--cds-radius-composer, 20px)",
        pill: "var(--df-radius-pill, 999px)",
        card: "var(--radius-card, calc(var(--radius-lg, 8px) + calc(4px * var(--cds-rem-scale, 1))))",
      },
      boxShadow: {
        sm: "var(--cds-shadow-sm)",
        md: "var(--cds-shadow-md)",
        lg: "var(--cds-shadow-lg)",
        popover: "var(--cds-shadow-popover)",
        composer: "var(--cds-shadow-composer)",
        "composer-hover": "var(--cds-shadow-composer-hover)",
        "composer-focus": "var(--cds-shadow-composer-focus)",
        "focus-glow": "var(--cds-focus-shadow)",
        "drop-glow": "var(--cds-shadow-drop-glow)",
        panel: "var(--cds-panel-shadow)",
        "panel-hover": "var(--cds-panel-shadow-hover)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;
