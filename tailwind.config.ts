import type { Config } from "tailwindcss";

/**
 * Nyx design tokens. The whole palette lives here; components must use
 * these tokens (blush-*, ink, dim, success, danger) and never hardcode hex.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Rose-pink brand scale on a white base.
        blush: {
          50: "#FFFBFB", // page background
          100: "#FBE9EC", // highlights, badges, selected rows
          200: "#F5E1E4", // subtle card borders
          300: "#EFC7CD", // stronger dividers
          400: "#E28B97", // light accents
          500: "#D9606F", // primary accent (buttons, active tabs, links)
          600: "#C24B5B", // hover / pressed state of the primary accent
          700: "#A63B49", // reserved for future emphasis
        },
        // Text
        ink: "#2B1F21", // headings and body
        dim: "#7A6568", // secondary text
        // Semantic states, chosen to stay readable next to the brand red.
        success: "#3E8E63",
        danger: "#B3261E",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "0.75rem",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(43 31 33 / 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
