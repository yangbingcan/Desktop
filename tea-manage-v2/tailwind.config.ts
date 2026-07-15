import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        'gl-primary': 'var(--gl-primary)',
        'gl-primary-hover': 'var(--gl-primary-hover)',
        'gl-primary-active': 'var(--gl-primary-active)',
        'gl-primary-light': 'var(--gl-primary-light)',
        'gl-primary-bg': 'var(--gl-primary-bg)',
        'gl-success': 'var(--gl-success)',
        'gl-success-bg': 'var(--gl-success-bg)',
        'gl-warning': 'var(--gl-warning)',
        'gl-warning-bg': 'var(--gl-warning-bg)',
        'gl-error': 'var(--gl-error)',
        'gl-error-bg': 'var(--gl-error-bg)',
        'gl-info': 'var(--gl-info)',
        'gl-info-bg': 'var(--gl-info-bg)',
        'gl-content-bg': 'var(--gl-content-bg)',
        'gl-card-bg': 'var(--gl-card-bg)',
        'gl-sidebar-bg': 'var(--gl-sidebar-bg)',
        'gl-titlebar-bg': 'var(--gl-titlebar-bg)',
        'gl-text-primary': 'var(--gl-text-primary)',
        'gl-text-secondary': 'var(--gl-text-secondary)',
        'gl-text-tertiary': 'var(--gl-text-tertiary)',
        'gl-border': 'var(--gl-border)',
        'gl-border-light': 'var(--gl-border-light)',
      },
      spacing: {
        'sidebar': '220px',
        'sidebar-collapsed': '64px',
        'topbar': '52px',
        'tabbar': '38px',
      },
      borderRadius: {
        'gl-sm': 'var(--gl-radius-sm)',
        'gl-md': 'var(--gl-radius-md)',
        'gl-lg': 'var(--gl-radius-lg)',
        'gl-xl': 'var(--gl-radius-xl)',
      },
      fontSize: {
        'gl-xs': 'var(--gl-font-size-xs)',
        'gl-sm': 'var(--gl-font-size-sm)',
        'gl-base': 'var(--gl-font-size-base)',
        'gl-lg': 'var(--gl-font-size-lg)',
        'gl-xl': 'var(--gl-font-size-xl)',
        'gl-stat': 'var(--gl-font-size-stat)',
      },
      boxShadow: {
        'gl-sm': 'var(--gl-shadow-sm)',
        'gl-md': 'var(--gl-shadow-md)',
        'gl-lg': 'var(--gl-shadow-lg)',
      },
    },
  },
} satisfies Config
