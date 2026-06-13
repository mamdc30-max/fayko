/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Accent principal (terra) — remplace l'orange ──────────────────
        primary: {
          DEFAULT: '#BF492C',   // terra
          light:   '#FAE8E4',   // terra très clair — badges, fonds légers
          dark:    '#A03B20',   // terra sombre — hover
          50:  '#FAE8E4',
          100: '#F5C9BE',
          200: '#EAAB9C',
          500: '#BF492C',
          600: '#A03B20',
          700: '#7D2D14',
        },
        // ── Fonds chauds ──────────────────────────────────────────────────
        beige: {
          DEFAULT: '#FFD7BD',   // paper — fond principal (abricot)
          50:  '#FFF0E6',       // hover très léger sur cards blanches
          100: '#FBC8A8',       // sand — panneaux chauds
          200: '#F5B890',       // sand foncé
        },
        // ── Composants ────────────────────────────────────────────────────
        surface: '#FFF0E6',     // card — beige chaud, harmonieux avec fond
        border:  '#E0CEBC',     // line warm
        muted:   '#7E756C',     // warm — texte secondaire
        // ── Tokens portfolio complets ────────────────────────────────────
        terra:        '#BF492C',
        'terra-light':'#D4582E',
        navy:         '#1E2A4F',
        'navy-deep':  '#16203E',
        ink:          '#1B2540',
        paper:        '#FFD7BD',
        sand:         '#FBC8A8',
        warm:         '#7E756C',
        line:         '#E4DBCC',
        card:         '#FFF0E6',
      },
      fontFamily: {
        sans:    ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 16px rgba(191,73,44,.07)',
        'card-hover': '0 6px 28px rgba(191,73,44,.13)',
      },
      letterSpacing: {
        eyebrow: '0.18em',
      },
    },
  },
  plugins: [],
}
