/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        lime:  { DEFAULT: '#c7dc91', dim: 'rgba(161,183,111,0.15)', glow: 'rgba(161,183,111,0.22)' },
        dark:  { DEFAULT: '#dedfdb', 2: '#eeefeb', 3: '#e2e3de', 4: '#d2d4cc' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'card':     '0 1px 3px rgba(28,30,25,0.06)',
        'card-md':  '0 8px 24px rgba(28,30,25,0.09)',
        'card-lg':  '0 16px 44px rgba(28,30,25,0.12)',
        'lime':     '0 0 24px rgba(161,183,111,0.18)',
        'lime-lg':  '0 0 40px rgba(161,183,111,0.24)',
      },
    },
  },
  plugins: [],
};

