/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#1a73e8',
        'primary-dark': '#1557b0',
        success: '#34a853',
        danger: '#ea4335',
        'neutral-50': '#f8f9fa',
        'neutral-900': '#1a1a2e',
        'text-primary': '#202124',
        'text-secondary': '#5f6368',
      },
    },
  },
  plugins: [],
}
