/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#dde6ff',
          200: '#c3d1fe',
          300: '#9ab2fd',
          400: '#6d8cfb',
          500: '#4a67f7',
          600: '#3449ec',
          700: '#2b38d5',
          800: '#2830ab',
          900: '#272e87',
          950: '#1a1d52',
        },
      },
    },
  },
  plugins: [],
};
