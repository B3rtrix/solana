/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: {
          950: '#08090a',
          900: '#0d0f10',
          850: '#121416',
          800: '#16191b',
          750: '#1b1e21',
          700: '#22262a',
          600: '#2d3236',
          500: '#4a5157',
          400: '#6e767d',
          300: '#9aa2a8',
          200: '#c6ccd0',
          100: '#e9ecee',
        },
        lime: { DEFAULT: '#c8f560', dim: '#a6d147', soft: 'rgba(200,245,96,0.12)' },
        up: '#3ddc97',
        down: '#ff5c6c',
        warn: '#ffb547',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(200,245,96,.35), 0 8px 30px -10px rgba(200,245,96,.35)',
      },
      keyframes: {
        in: { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'none' } },
        pop: { from: { opacity: 0, transform: 'scale(.97)' }, to: { opacity: 1, transform: 'none' } },
      },
      animation: { in: 'in .18s ease-out', pop: 'pop .16s ease-out' },
    },
  },
  plugins: [],
}
