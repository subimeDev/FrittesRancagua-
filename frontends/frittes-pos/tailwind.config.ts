import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1A1815",
        mustard: "#FFD23F",
        cream: "#F5F1E8",
        line: "#E2DCCC",
        forest: "#2D5A3F",
      },
    },
  },
  plugins: [],
};

export default config;
