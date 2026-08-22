import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Deep bottle green of the sidebar / top bar
        forest: {
          DEFAULT: '#0D4A42',
          900: '#06322C',
          800: '#0A3E37',
          700: '#0D4A42',
          600: '#125C52',
        },
        // Primary action green
        brand: {
          DEFAULT: '#16A085',
          600: '#16A085',
          700: '#128F76',
          500: '#2CB79C',
          100: '#DCF2EC',
          50: '#EFF9F6',
        },
        canvas: '#F4F6F5',
        hairline: '#E4E9E7',
        ink: {
          DEFAULT: '#12211E',
          muted: '#5C6B67',
          faint: '#8B9995',
        },
        // Fender red from the logo — used only for alerts and "Established 1981"
        signal: '#C0392B',
      },
      borderRadius: {
        card: '14px',
        pill: '999px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(6,50,44,0.04), 0 4px 16px rgba(6,50,44,0.05)',
        pop: '0 12px 40px rgba(6,50,44,0.18)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
