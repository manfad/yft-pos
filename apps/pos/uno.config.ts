import { defineConfig, presetUno, transformerDirectives } from "unocss";

// Warm, high-contrast theme from the original design — tuned for elderly
// cashiers: big targets, gentle cream surfaces, chunky "pressed" buttons.
export default defineConfig({
  presets: [presetUno()],
  transformers: [transformerDirectives()],
  // Tailwind-style border utilities only set width; this makes every border
  // render solid (and zero-width by default) instead of the browser's beveled
  // <button> default, which showed up as a two-tone 3D ring.
  preflights: [
    {
      getCSS: () =>
        "*,::before,::after{border-width:0;border-style:solid;border-color:#e7dcc7}",
    },
  ],
  theme: {
    colors: {
      cream: "#f1e9db",
      surface: "#fffdf8",
      panel: "#f8f1e4",
      tile: "#fbf6ec",
      line: "#fbf7ef",
      ink: "#2c2620",
      muted: "#9a8d76",
      faint: "#c2b59c",
      border: "#e7dcc7",
      borderSoft: "#f0e7d6",
      olive: "#6e8a4e",
      oliveDark: "#5d763f",
      terracotta: "#c4753f",
      date: "#9f5125",
      chart: "#a9bf83",
      warm: "#f3ead3",
      warmBorder: "#d9c6a3",
    },
    fontFamily: {
      display: "'Fredoka Variable', sans-serif",
      sans: "'Nunito Variable', sans-serif",
    },
  },
  shortcuts: {
    // pressed-state feedback (mirrors the design's :active nudges)
    press: "transition-transform active:translate-y-2px",
    // primary green PAY button with its chunky bottom shadow
    "btn-pay":
      "border-none rounded-18px bg-olive text-white font-display font-600 cursor-pointer shadow-[0_5px_0_theme(colors.oliveDark)] transition-transform active:translate-y-4px active:shadow-[0_1px_0_theme(colors.oliveDark)]",
    // product/selection card with bottom shadow + press
    "card-tile":
      "bg-surface border-2 border-border rounded-18px cursor-pointer shadow-[0_3px_0_theme(colors.border)] transition-all active:translate-y-3px active:shadow-none",
    "tile-dark":
      "rounded-14px border-2 border-border bg-tile font-800 text-ink cursor-pointer press",
    "tile-warm":
      "rounded-14px border-2 border-warmBorder bg-warm font-800 text-ink cursor-pointer press",
    "adj-btn":
      "flex-none rounded-full border-none bg-[#efe6d6] font-700 text-ink cursor-pointer press",
    "pill-btn":
      "rounded-12px border-2 border-border bg-tile font-800 text-muted cursor-pointer press",
  },
});
