/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['SFMono-Regular', 'Consolas', 'Liberation Mono', 'monospace']
      },
      colors: {
        bg: {
          DEFAULT: '#0b1120',
          soft: '#0f172a'
        },
        card: {
          DEFAULT: 'rgba(17, 24, 39, 0.86)',
          soft: '#172033'
        },
        border: {
          DEFAULT: 'rgba(148, 163, 184, 0.18)'
        },
        ink: {
          DEFAULT: '#e5e7eb',
          muted: '#94a3b8'
        }
      },
      borderRadius: {
        xl2: '1rem',
        xl3: '1.4rem'
      },
      boxShadow: {
        elev: '0 16px 50px rgba(0, 0, 0, 0.22)',
        lift: '0 24px 80px rgba(0, 0, 0, 0.35)'
      },
      keyframes: {
        'fade-in': { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        'scale-in': { '0%': { opacity: 0, transform: 'scale(0.96)' }, '100%': { opacity: 1, transform: 'scale(1)' } }
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'scale-in': 'scale-in 180ms cubic-bezier(.16,1,.3,1)'
      }
    }
  },
  plugins: []
};
