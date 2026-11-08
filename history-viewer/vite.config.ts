import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  build: { outDir: "../coach/static/history", emptyOutDir: true },
});
