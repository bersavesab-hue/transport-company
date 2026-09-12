import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  base: "./",
  build: {
    target: "es2020",
    sourcemap: true,
    rollupOptions: mode === "mobile" ? {
      output: {
        entryFileNames: "assets/app.js",
        chunkFileNames: "assets/chunk-[name].js",
        assetFileNames: (asset) => asset.name?.endsWith(".css") ? "assets/app.css" : "assets/[name][extname]"
      }
    } : undefined
  }
}));
