/** @type {import('tailwindcss').Config} */
// Design tokens from devsync-design.md: white surfaces, black text, one green
// accent, 1px borders instead of shadows, Mona Sans type scale.
// Colours are CSS variables (src/index.css) so light and dark themes share every class.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: token('brand'), // primary action fill, accents
          strong: token('brand-strong'), // primary action hover
          fg: token('brand-fg'), // green text and icons
          soft: token('brand-soft'), // selected / success backgrounds
          muted: token('brand-muted'), // text selection
        },
        ink: {
          DEFAULT: token('ink'), // on-surface
          muted: token('ink-muted'), // muted-text
          subtle: token('ink-subtle'), // placeholders, metadata
        },
        line: {
          DEFAULT: token('line'), // border: cards, dividers
          strong: token('line-strong'), // tertiary: control outlines
          emphasis: token('line-emphasis'), // hovered control outlines
        },
        canvas: {
          DEFAULT: token('canvas'),
          subtle: token('canvas-subtle'), // sidebars, panels
          muted: token('canvas-muted'), // hover fills
        },
        danger: {
          DEFAULT: token('danger'), // red text and borders
          solid: token('danger-solid'), // destructive button fill
          strong: token('danger-strong'), // destructive button hover
          soft: token('danger-soft'),
        },
      },
      fontFamily: {
        sans: ['"Mona Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        mono: ['"Monaspace Neon"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        // Headlines scale down fluidly on small screens, capped at the spec size
        display: ['clamp(2.5rem, 4vw + 1.25rem, 3.5rem)', { lineHeight: '1.1', fontWeight: '440' }],
        'headline-lg': ['clamp(1.75rem, 2vw + 1rem, 2.125rem)', { lineHeight: '1.3' }],
        'headline-md': ['28px', { lineHeight: '1.35' }],
        'headline-sm': ['18px', { lineHeight: '1.22' }],
        'body-lg': ['18px', { lineHeight: '1.55', letterSpacing: '0.18px' }],
        'body-md': ['16px', { lineHeight: '1.69', letterSpacing: '0.18px' }],
        'body-sm': ['14px', { lineHeight: '1.5' }],
        'label-lg': ['16px', { lineHeight: '1.2', fontWeight: '500' }],
        'label-md': ['14px', { lineHeight: '1.2', fontWeight: '500' }],
        'label-sm': ['12px', { lineHeight: '1.2', fontWeight: '500', letterSpacing: '0.02em' }],
        'code-md': ['14px', { lineHeight: '1.4' }],
        'code-sm': ['12px', { lineHeight: '1.4' }],
      },
      borderRadius: {
        sm: '4px', // md 6px, lg 8px, xl 12px already match Tailwind's defaults
      },
      boxShadow: {
        // Flat UI: only floating layers (menus, dialogs) get a shadow
        overlay: 'var(--shadow-overlay)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(0.98)' }, to: { opacity: '1', transform: 'none' } },
        blink: { '50%': { opacity: '0' } },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'fade-up': 'fade-up 500ms cubic-bezier(0.2, 0, 0, 1) both',
        'scale-in': 'scale-in 120ms cubic-bezier(0.2, 0, 0, 1)',
        blink: 'blink 1.1s step-end infinite',
      },
    },
  },
  plugins: [],
};
