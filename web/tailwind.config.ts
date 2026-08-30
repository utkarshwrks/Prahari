import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        black: "#131318",
        panel: "#1E1E25",
        "panel-2": "#2A2A32",
        border: "#3A3A44",
        "border-2": "#4C4C58",
        white: "#FFFFFF",
        text: "#F4F4F5",
        muted: "#B4B4BE",
        "muted-2": "#8A8A96",
        red: "#E10600",
        "red-bright": "#FF3B30",
        "red-deep": "#C11030",
      },
      fontFamily: {
        display: ["var(--font-anton)", "Impact", "sans-serif"],
        heading: ["var(--font-grotesk)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        none: "0",
        sm: "2px",
        DEFAULT: "4px",
        md: "4px",
        lg: "4px",
      },
      boxShadow: {
        glow: "0 0 24px rgba(225,6,0,0.35)",
        "glow-sm": "0 0 12px rgba(225,6,0,0.30)",
        "glow-lg": "0 0 48px rgba(225,6,0,0.45)",
        panel: "0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 30px rgba(0,0,0,0.5)",
      },
      keyframes: {
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        pulseRing: {
          "0%": { transform: "scale(0.6)", opacity: "0.8" },
          "100%": { transform: "scale(2.6)", opacity: "0" },
        },
        pulseDot: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.3" },
        },
        pulseGlow: {
          "0%,100%": { boxShadow: "0 0 12px rgba(225,6,0,0.3)" },
          "50%": { boxShadow: "0 0 32px rgba(225,6,0,0.7)" },
        },
        flicker: {
          "0%,100%": { opacity: "1" },
          "48%": { opacity: "1" },
          "50%": { opacity: "0.6" },
          "52%": { opacity: "1" },
        },
        tickerScroll: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        marqueeUp: {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(-50%)" },
        },
      },
      animation: {
        scanline: "scanline 8s linear infinite",
        pulseRing: "pulseRing 1.8s ease-out infinite",
        pulseDot: "pulseDot 1.6s ease-in-out infinite",
        pulseGlow: "pulseGlow 2s ease-in-out infinite",
        flicker: "flicker 4s linear infinite",
        ticker: "tickerScroll 30s linear infinite",
        marqueeUp: "marqueeUp 20s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
