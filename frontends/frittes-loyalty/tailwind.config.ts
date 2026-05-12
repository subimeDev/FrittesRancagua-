import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Tokens semanticos. Las variables las inyecta layout.tsx
        // desde lib/branding.ts (asi este mismo proyecto puede ser
        // re-skineado para otro restaurante editando un solo archivo).
        ink: "var(--brand-ink)",
        "ink-muted": "var(--brand-ink-muted)",
        cream: "var(--brand-cream)",
        "cream-elev": "var(--brand-cream-elev)",
        "cream-muted": "var(--brand-cream-muted)",
        mustard: "var(--brand-mustard)",
        "mustard-deep": "var(--brand-mustard-deep)",
        forest: "var(--brand-forest)",
        ember: "var(--brand-ember)",
        line: "var(--brand-line)",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
        script: ["var(--font-script)", "cursive"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        pass: "0 20px 50px -20px rgb(0 0 0 / 0.35), 0 8px 16px -8px rgb(0 0 0 / 0.15)",
        card: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 4px 16px -4px rgb(0 0 0 / 0.08)",
      },
      letterSpacing: {
        wider2: "0.18em",
      },
      borderRadius: {
        pass: "22px",
      },
      animation: {
        // Spin lento para el pill de "ver sellos" en el pase.
        "spin-slow": "spin-slow 3s linear infinite",
      },
      keyframes: {
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
