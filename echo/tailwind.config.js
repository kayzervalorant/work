/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Custom dark palette — never pure black
        surface: {
          base: "#0d1117",   // app background
          1: "#161b27",      // sidebar
          2: "#1e2a3b",      // cards / message bubbles
          3: "#243044",      // hover states
        },
        border: "#2d3a50",
        accent: {
          DEFAULT: "#22d3ee", // cyan-400
          dim: "#0891b2",     // cyan-600
          glow: "#06b6d4",    // cyan-500
        },
        text: {
          primary: "#e2e8f0",
          secondary: "#94a3b8",
          muted: "#475569",
        },
        status: {
          online: "#34d399",  // emerald-400
          offline: "#f87171", // red-400
          loading: "#fbbf24", // amber-400
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.25s ease-out",
        "blink": "blink 1s step-end infinite",
        "pulse-slow": "pulse 2.5s cubic-bezier(0.4,0,0.6,1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
      },
      boxShadow: {
        glow: "0 0 12px rgba(34, 211, 238, 0.15)",
        "glow-lg": "0 0 24px rgba(34, 211, 238, 0.2)",
      },
    },
  },
  plugins: [],
};
