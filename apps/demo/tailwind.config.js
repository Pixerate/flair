/** @type {import('tailwindcss').Config} */

// shadcn-style theme tokens used by the @pixerate/editor-react components (`bg-background`,
// `border-input`, `ring-primary`, ...). The values live in `src/index.css` as RGB channels
// so opacity modifiers work.
const token = (name) => `rgb(var(--${name}-rgb) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}", "./node_modules/@pixerate/editor-react/dist/**/*.js"],
  theme: {
    extend: {
      colors: {
        background: token("background"),
        foreground: token("foreground"),
        border: token("border"),
        input: token("input"),
        ring: token("ring"),
        muted: { DEFAULT: token("muted"), foreground: token("muted-foreground") },
        primary: { DEFAULT: token("primary"), foreground: token("primary-foreground") },
        destructive: { DEFAULT: token("destructive"), foreground: token("destructive-foreground") },
      },
      keyframes: {
        gradient: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
      animation: {
        gradient: "gradient 6s ease infinite",
      },
    },
  },
  plugins: [],
};
