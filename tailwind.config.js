/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "sage-green": "#7D926B",
        "sage-light": "#A2B392",
        "warm-beige": "#F9F7F2",
        "item-blue": "#EBF1F9",
        "border-blue": "#A7C7E7",
        "game-yellow": "#FBBF24",
      },
      borderRadius: {
        'default': '1rem',
        'lg': '1.5rem',
        'xl': '2rem',
      }
    },
  },
  plugins: [],
}
