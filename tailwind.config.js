/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './public/**/*.{html,ejs}',
    './views/**/*.{html,ejs}'
  ],
  theme: {
    extend: {
      colors: {
        'yt-red': '#fb0004'
      }
    },
  },
  plugins: [],
}

