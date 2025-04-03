/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: { 
      colors: {
      primary: '#006E90',
      secondary: '#FFC107',
      dark: '#333333',
      light: '#FFFFFF',
      danger: '#F44336',
      success: '#4CAF50',
     },
   },
  },
  plugins: [],
}
