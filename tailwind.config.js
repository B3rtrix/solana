/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // Neutral, slightly warm greys — no hue tint.
        ink: {
          950: '#0a0a0a',
          900: '#0e0e0e',
          850: '#131313',
          800: '#171717',
          750: '#1f1f1f',
          700: '#262626',
          600: '#333333',
          500: '#555555',
          400: '#8a8a8a',
          300: '#a8a8a8',
          200: '#d4d4d4',
          100: '#ededed',
        },
        accent: { DEFAULT: '#ededed', dim: '#cfcfcf', soft: 'rgba(237,237,237,0.07)' },
        up: '#5bb98c',
        down: '#e5636a',
        warn: '#d1a254',
      },
      keyframes: {
        in: { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'none' } },
        pop: { from: { opacity: 0, transform: 'scale(.98)' }, to: { opacity: 1, transform: 'none' } },
      },
      animation: { in: 'in .2s ease-out', pop: 'pop .16s ease-out' },
    },
  },
  plugins: [],
}
