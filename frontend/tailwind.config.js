/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        coral:    { DEFAULT: "#FF6B6B", light: "#FFE5E5", dark: "#E85555" },
        mint:     { DEFAULT: "#4ECDC4", light: "#E8FAF9", dark: "#3AB5AC" },
        sky:      { DEFAULT: "#45B7D1", light: "#E3F6FB", dark: "#2E9DB8" },
        lemon:    { DEFAULT: "#FFE66D", light: "#FFFBE5", dark: "#E6CE55" },
        lavender: { DEFAULT: "#A8A4E6", light: "#F0EFF9", dark: "#8E89D4" },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "Inter", "sans-serif"],
      },
      keyframes: {
        blob: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%":       { transform: "translate(20px, -15px) scale(1.05)" },
          "66%":       { transform: "translate(-10px, 10px) scale(0.97)" },
        },
        pulseRing: {
          "0%":   { transform: "scale(1)", opacity: "0.8" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
      },
      animation: {
        blob:      "blob 8s ease-in-out infinite",
        pulseRing: "pulseRing 1.5s ease-out infinite",
      },
    },
  },
  plugins: [],
};

