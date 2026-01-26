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
          bg: "#030303",        // Deep Black
          surface: "#111111",   // Panel/Card BG
          red: "#FF0000",       // Brand Accent
          redHover: "#CC0000",  // Darker Red
          text: {
            DEFAULT: "#EDEDED", // Primary White
            muted: "#666666",   // Subtitles
            error: "#EF4444",   // Error State
          },
          border: "#333333",    // Subtle lines
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