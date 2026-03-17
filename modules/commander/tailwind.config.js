module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: ['grid', 'flex', 'block', 'inline-flex', 'hidden'],
  theme: {
    extend: {
      colors: {
        lab: {
          midnight: '#0f0f23',
          indigo: '#1a1a3e',
          deep: '#232347',
          amber: '#f59e0b',
          peach: '#fb923c',
          lavender: '#c084fc',
          sky: '#7dd3fc',
          success: '#86efac',
          warning: '#fcd34d',
          error: '#fca5a5',
          text: {
            primary: '#fafafa',
            secondary: '#d4d4d8',
            muted: '#a1a1aa',
          },
        },
      },
      fontFamily: {
        serif: ['Crimson Pro', 'Georgia', 'serif'],
        sans: ['DM Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
