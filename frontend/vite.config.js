import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API_TARGET = process.env.VITE_DEV_API_TARGET || "http://localhost:5001";

/**
 * Stamps a unique build id into dist/sw.js so every deploy produces a new
 * service worker (browsers only update a SW when its bytes change).
 */
const serviceWorkerVersion = () => ({
  name: "blinkchat-sw-version",
  apply: "build",
  closeBundle() {
    const file = path.resolve("dist/sw.js");
    if (!fs.existsSync(file)) return;
    const id = `${Date.now().toString(36)}`;
    fs.writeFileSync(file, fs.readFileSync(file, "utf8").replaceAll("__BUILD_ID__", id));
  },
});

export default defineConfig({
  plugins: [react(), serviceWorkerVersion()],
  server: {
    port: 5173,
    // In development the browser only ever talks to the Vite origin; API,
    // websocket and uploads are proxied, exactly like the single-domain
    // production setup (first-party cookies, no CORS surprises).
    proxy: {
      "/api": { target: API_TARGET },
      "/uploads": { target: API_TARGET },
      "/socket.io": { target: API_TARGET, ws: true },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      "/api": { target: API_TARGET },
      "/uploads": { target: API_TARGET },
      "/socket.io": { target: API_TARGET, ws: true },
    },
  },
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Vendor code changes rarely: keep it in separate long-cached chunks.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|@remix-run)[\\/]/.test(id)) return "react";
          if (/[\\/]node_modules[\\/](socket\.io-client|socket\.io-parser|engine\.io-client|engine\.io-parser|@socket\.io|axios|zustand)[\\/]/.test(id)) return "realtime";
          if (/[\\/]node_modules[\\/]lucide-react[\\/]/.test(id)) return "icons";
          return undefined;
        },
      },
    },
  },
});
