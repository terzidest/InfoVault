/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // KEEP IN SYNC with src/theme/colors.ts (the JS-side source of truth).
      colors: {
        primary: '#006E90',
        secondary: '#FFC107',
        dark: '#333333',
        light: '#FFFFFF',
        danger: '#F44336',
        success: '#4CAF50',
        muted: '#999999',
        'note-work': '#2196F3',
        'note-other': '#9C27B0',
      },
    },
  },
  plugins: [],
}
