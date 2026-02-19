import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",        // Scans your app folder
    "./components/**/*.{js,ts,jsx,tsx,mdx}", // Scans your components folder
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",        // Scans your lib folder (if you use UI code there)
  ],
  theme: {
    extend: {
      fontFamily: {
        anton: ['Anton', 'sans-serif'],
        display: ["var(--font-anton)", "sans-serif"],
        mono: ["var(--font-roboto-mono)", "monospace"],
        sans: ["var(--font-inter)", "sans-serif"],
      },
      colors: {
        motion: {
          bg: "#030303",           // Deep Black
          surface: "#0F0F0F",     // Panel/Card BG
          surfaceHover: "#1A1A1A", // Hover BG
          red: "#E50914",         // Brand Accent (Premium)
          redHover: "#B91C1C",    // Deeper Red
          redGlow: "rgba(229, 9, 20, 0.15)", // Subtle glow
          text: {
            DEFAULT: "#EDEDED",   // Primary White
            muted: "#888888",     // Subtitles (softer)
            error: "#EF4444",     // Error State
          },
          border: "#222222",      // Subtle lines
        }
      },
      backgroundImage: {
        'studio-gradient': 'radial-gradient(circle at 50% 50%, #111111 0%, #030303 80%)',
      }
    },
  },
  plugins: [],
};
export default config;