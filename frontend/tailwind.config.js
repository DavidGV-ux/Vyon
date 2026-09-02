/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'vyon-dark': '#0A0A1A',
        'vyon-navy': '#101828',
        'vyon-slate': '#1A1F35',
        'vyon-yellow': '#FFC837',
        'vyon-orange': '#FF8008',
        'vyon-gradient-start': '#FFC837',
        'vyon-gradient-end': '#FF8008',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'vyon-gradient': 'linear-gradient(135deg, #FFC837 0%, #FF8008 100%)',
        'vyon-gradient-soft': 'linear-gradient(135deg, rgba(255,200,55,0.1) 0%, rgba(255,128,8,0.1) 100%)',
      },
      boxShadow: {
        'vyon-glow': '0 0 40px rgba(255, 200, 55, 0.15)',
      },
    },
  },
  plugins: [],
}
