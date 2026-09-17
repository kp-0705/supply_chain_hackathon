/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        micron: {
          blue: '#005596',
          cyan: '#00A3E0',
          dark: '#0A0F1D',
          card: '#111827',
          border: '#1F2937',
          accent: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444'
        }
      }
    },
  },
  plugins: [],
}
