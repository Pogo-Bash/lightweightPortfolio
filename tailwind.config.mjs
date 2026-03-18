/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,md,mdx,ts}"],
  theme: {
    extend: {
      colors: {
        base: "#1e1e2e",
        mantle: "#181825",
        crust: "#11111b",
        surface0: "#313244",
        surface1: "#45475a",
        surface2: "#585b70",
        overlay0: "#6c7086",
        overlay1: "#7f849c",
        text: "#cdd6f4",
        subtext0: "#a6adc8",
        subtext1: "#bac2de",
        mauve: "#cba6f7",
        blue: "#89b4fa",
        sapphire: "#74c7ec",
        green: "#a6e3a1",
        peach: "#fab387",
        red: "#f38ba8",
        flamingo: "#f2cdcd",
        rosewater: "#f5e0dc",
        lavender: "#b4befe",
        teal: "#94e2d5",
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', "monospace"],
      },
    },
  },
  plugins: [],
};
