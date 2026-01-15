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
        sans: ['Inter', 'sans-serif'],
        anton: ['Anton', 'sans-serif'], // <--- Ensure this was added
      },
      colors: {
        background: "#050505",
      },
    },
  },
  plugins: [],
};
export default config;