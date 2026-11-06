/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          subtle: 'rgb(var(--surface-subtle) / <alpha-value>)',
          variant: 'rgb(var(--surface-variant) / <alpha-value>)',
          elevated: 'rgb(var(--surface-elevated) / <alpha-value>)',
        },
        'on-surface': {
          DEFAULT: 'rgb(var(--on-surface) / <alpha-value>)',
          variant: 'rgb(var(--on-surface-variant) / <alpha-value>)',
        },
        outline: {
          DEFAULT: 'rgb(var(--outline) / <alpha-value>)',
          variant: 'rgb(var(--outline-variant) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          foreground: 'rgb(var(--primary-foreground) / <alpha-value>)',
          container: 'rgb(var(--primary-container) / <alpha-value>)',
          on: 'rgb(var(--on-primary) / <alpha-value>)',
          'on-container': 'rgb(var(--on-primary-container) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'rgb(var(--secondary) / <alpha-value>)',
          container: 'rgb(var(--secondary-container) / <alpha-value>)',
          on: 'rgb(var(--on-secondary) / <alpha-value>)',
          'on-container': 'rgb(var(--on-secondary-container) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--success) / <alpha-value>)',
          container: 'rgb(var(--success-container) / <alpha-value>)',
          on: 'rgb(var(--on-success-container) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--warning) / <alpha-value>)',
          container: 'rgb(var(--warning-container) / <alpha-value>)',
          on: 'rgb(var(--on-warning-container) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--danger) / <alpha-value>)',
          container: 'rgb(var(--danger-container) / <alpha-value>)',
          on: 'rgb(var(--on-danger-container) / <alpha-value>)',
        },
        error: {
          DEFAULT: 'rgb(var(--danger) / <alpha-value>)',
          container: 'rgb(var(--danger-container) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'rgb(var(--info) / <alpha-value>)',
          container: 'rgb(var(--info-container) / <alpha-value>)',
          on: 'rgb(var(--on-info-container) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'Segoe UI',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        soft: '0 1px 2px rgb(var(--shadow) / 0.04), 0 8px 24px -12px rgb(var(--shadow) / 0.18)',
        card: '0 1px 3px rgb(var(--shadow) / 0.05), 0 12px 32px -16px rgb(var(--shadow) / 0.22)',
      },
      borderRadius: {
        '4xl': '1.75rem',
      },
    },
  },
  plugins: [],
};
