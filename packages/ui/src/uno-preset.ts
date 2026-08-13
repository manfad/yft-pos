import { definePreset } from "unocss";

export const yfUiPreset = definePreset(() => ({
  name: "yf-ui",
  theme: {
    colors: {
      cream: "#f1e9db",
      surface: "#fffdf8",
      panel: "#f8f1e4",
      tile: "#fbf6ec",
      ink: "#2c2620",
      muted: "#81745f",
      faint: "#b9aa90",
      border: "#e1d4bd",
      borderSoft: "#eee4d3",
      olive: "#6e8a4e",
      oliveDark: "#536d38",
      terracotta: "#c4753f",
      terracottaDark: "#9f5125",
      warm: "#f3ead3",
      warmBorder: "#d9c6a3",
      occupied: "#f5c957",
      danger: "#c84d42",
      dangerSoft: "#f8e5e1",
      successSoft: "#e8f0dc"
    },
    fontFamily: {
      display: "'Fredoka Variable', sans-serif",
      sans: "'Nunito Variable', sans-serif"
    }
  },
  shortcuts: {
    press: "transition-transform active:scale-96",
    "yf-focus": "focus-visible:outline-3 focus-visible:outline-olive focus-visible:outline-offset-3",
    "yf-card": "bg-surface border-2 border-border rounded-20px shadow-[0_3px_0_theme(colors.border)]",
    "yf-card-button": "yf-card yf-focus press cursor-pointer text-ink",
    "yf-btn": "yf-focus press min-h-48px px-18px rounded-14px border-2 border-border bg-surface text-ink font-800 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed",
    "yf-btn-primary": "yf-focus press min-h-52px px-22px rounded-15px border-0 bg-olive text-white font-900 cursor-pointer shadow-[0_4px_0_theme(colors.oliveDark)] active:shadow-none disabled:opacity-45 disabled:cursor-not-allowed",
    "yf-btn-danger": "yf-focus press min-h-48px px-18px rounded-14px border-2 border-danger bg-dangerSoft text-danger font-900 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed",
    "yf-input": "yf-focus w-full min-h-52px px-16px rounded-14px border-2 border-border bg-surface text-18px font-700 text-ink",
    "yf-chip": "inline-flex items-center min-h-34px px-12px rounded-full text-14px font-900"
  },
  preflights: [{ getCSS: () => "*,::before,::after{box-sizing:border-box;border-width:0;border-style:solid;border-color:#e1d4bd}button,input,select,textarea{font:inherit}" }]
}));
