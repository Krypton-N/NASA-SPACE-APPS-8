import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

// La API del motor de evidencia (research/scripts/serve_scientific_console.py) escucha en 8765.
const proxy = { "/api": { target: "http://127.0.0.1:8765", changeOrigin: false } };

export default defineConfig({
  base: "./",
  resolve: {
    alias: {
      // consola científica de Liam; sus imports de fuentes se resuelven con los paquetes de app/
      "@console": here("../research/apps/scientific-console/src"),
      "@fontsource": here("./node_modules/@fontsource"),
    },
  },
  server: {
    port: 5173,
    open: true,
    proxy,
    fs: { allow: [here("..")] },
    watch: { usePolling: true, interval: 300 },
  },
  preview: { port: 4173, proxy },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 800,
    rollupOptions: { input: { main: here("./index.html"), lab: here("./lab.html") } },
  },
});
