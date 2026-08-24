import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Deep bottle green of the sidebar / top bar for Fender Steel, or
        // charcoal black for BS Supplies — CSS-variable backed (see
        // globals.css :root / [data-brand="bs-supplies"]) so the whole app
        // repaints on the company switch with no per-component changes.
        forest: {
          DEFAULT: 'rgb(var(--color-forest) / <alpha-value>)',
          900: 'rgb(var(--color-forest-900) / <alpha-value>)',
          800: 'rgb(var(--color-forest-800) / <alpha-value>)',
          700: 'rgb(var(--color-forest-700) / <alpha-value>)',
          600: 'rgb(var(--color-forest-600) / <alpha-value>)',
        },
        // Primary action colour — green for Fender Steel, orange for BS Supplies
        brand: {
          DEFAULT: 'rgb(var(--color-brand) / <alpha-value>)',
          600: 'rgb(var(--color-brand-600) / <alpha-value>)',
          700: 'rgb(var(--color-brand-700) / <alpha-value>)',
          500: 'rgb(var(--color-brand-500) / <alpha-value>)',
          100: 'rgb(var(--color-brand-100) / <alpha-value>)',
          50: 'rgb(var(--color-brand-50) / <alpha-value>)',
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
