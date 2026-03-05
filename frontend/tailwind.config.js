/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#0f172a',
          primary: '#004a98',
          secondary: '#bdec24',
          accent: '#1a73e8',
        }
      }
    },
  },
  plugins: [],
}
