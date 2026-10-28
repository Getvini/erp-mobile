/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "rgb(243 136 32)", // #F38820 (Brand orange button background)
          hover: "rgb(219 116 20)",   // #DB7414
          pressed: "rgb(201 106 16)", // #C96A10
          text: "rgb(255 255 255)",   // #ffffff
          action: "rgb(243 136 32)",   // #F38820 (Brand orange for links/tabs/focus border)
          dark: "rgb(217 112 16)",    // #D97010
          light: "rgb(255 248 224)",  // #fff8e0
          border: "rgb(230 213 168)", // #e6d5a8
          soft: "rgb(255 240 194)",        // #fff0c2
          softHover: "rgb(255 226 149)",   // #ffe295
          softPressed: "rgb(255 208 106)", // #ffd06a
          onSoft: "rgb(154 52 18)",        // #9A3412
          softBorder: "rgb(194 84 10)",    // #C2540A
          softBorderPressed: "rgb(168 70 8)", // #A84608
        },
        surface: {
          DEFAULT: "rgb(255 255 255)",
          subtle: "rgb(237 237 237)", // #ededed
        },
        background: "rgb(250 250 250)", // #fafafa
        text: {
          primary: "rgb(31 31 31)",   // #1f1f1f
          secondary: "rgb(74 74 74)", // #4a4a4a
          muted: "rgb(106 106 106)",  // #6a6a6a
        },
        border: {
          DEFAULT: "rgb(229 229 229)",// #e5e5e5
          control: "rgb(138 138 138)",// #8a8a8a
        },
        success: {
          DEFAULT: "rgb(16 185 129)", // #10B981
          strong: "rgb(4 120 87)",    // #047857
          light: "rgb(236 253 245)",  // #ECFDF5
        },
        warning: {
          DEFAULT: "rgb(245 158 11)", // #F59E0B
          strong: "rgb(180 83 9)",    // #B45309
          light: "rgb(255 251 235)",  // #FFFBEB
        },
        info: {
          DEFAULT: "rgb(59 130 246)", // #3B82F6
          strong: "rgb(29 78 216)",   // #1D4ED8
          light: "rgb(239 246 255)",  // #EFF6FF
        },
        danger: {
          DEFAULT: "rgb(239 68 68)",  // #EF4444
          strong: "rgb(185 28 28)",   // #B91C1C
          light: "rgb(254 242 242)",  // #FEF2F2
        },
        neutral: {
          strong: "rgb(74 74 74)",   // #4a4a4a
          light: "rgb(237 237 237)",  // #ededed
        },
      },
      borderRadius: {
        control: "10px",
        card: "18px",
        overlay: "18px",
      },
    },
  },
  plugins: [],
};
