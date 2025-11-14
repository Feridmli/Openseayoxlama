// vite.config.js
import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: "./index.html",
      manualChunks(id) {
        if (id.includes("node_modules")) return "vendor";
      },
      external: ["http", "https", "os", "url"]
    }
  },
  server: {
    port: 5173
  }
});