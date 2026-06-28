import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          rust:     '#9A2811',
          orange:   '#F2542D',
          cream:    '#F5DFBB',
          teal:     '#19A2A2',
          deepTeal: '#127475',
        },
        surface: {
          dark:    '#0E1F1F',
          darker:  '#091414',
          charcoal:'#1C2B2B',
          card:    '#FDFAF4',
          base:    '#F5DFBB',
          muted:   '#EDE8DA',
        },
        ink: {
          primary:   '#1C2B2B',
          secondary: '#8A8070',
          ghost:     '#B5A99A',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        mono:    ['"DM Mono"', '"Fira Code"', 'monospace'],
        sans:    ['Lato', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm:  '6px',
        md:  '8px',
        lg:  '12px',
        xl:  '16px',
      },
      boxShadow: {
        card:  '0 1px 3px rgba(28,43,43,0.08), 0 1px 2px rgba(28,43,43,0.06)',
        panel: '0 4px 12px rgba(28,43,43,0.10)',
        input: '0 0 0 3px rgba(18,116,117,0.15)',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fadeUp 0.3s ease-out forwards',
      },
    },
  },
  plugins: [],
}

export default config