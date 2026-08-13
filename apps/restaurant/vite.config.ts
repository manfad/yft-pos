import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import UnoCSS from "unocss/vite";
import { presetUno, transformerDirectives } from "unocss";
import { yfUiPreset } from "@yf/ui/uno-preset";

export default defineConfig({
  base: "./",
  plugins: [UnoCSS({ presets: [presetUno(), yfUiPreset], transformers: [transformerDirectives()] }), vue()]
});
