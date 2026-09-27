/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "rgb(243 136 32)",
          dark: "rgb(217 112 16)",
          light: "rgb(255 247 237)",
          border: "rgb(253 203 158)",
        },
        surface: "rgb(255 255 255)",
        background: "rgb(248 250 252)",
        text: {
          primary: "rgb(15 23 42)",
          secondary: "rgb(100 116 139)",
          muted: "rgb(148 163 184)",
        },
        border: "rgb(226 232 240)",
        success: {
          DEFAULT: "rgb(16 185 129)",
          light: "rgb(236 253 245)",
        },
        warning: {
          DEFAULT: "rgb(245 158 11)",
          light: "rgb(255 251 235)",
        },
        info: {
          DEFAULT: "rgb(59 130 246)",
          light: "rgb(239 246 255)",
        },
        danger: {
          DEFAULT: "rgb(239 68 68)",
          light: "rgb(254 242 242)",
        },
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
        xl: "18px",
      },
    },
  },
  plugins: [],
};
