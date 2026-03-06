/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', "Fira Code", "monospace"],
      },
      colors: {
        swap: {
          bg: "#0a0a0a",
          text: "#e0e0e0",
          accent: "#00ff88",
          dim: "#333333",
        },
      },
    },
  },
  plugins: [],
};
