import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@ludo/shared": path.resolve(__dirname, "../shared/src"),
    },
  },
  server: {
    port: 3000,
   allowedHosts: ["a111-213-145-184-77.ngrok-free.app"],

   headers: {
  "X-Frame-Options": "ALLOWALL",
  "Content-Security-Policy": "frame-ancestors *",
  "ngrok-skip-browser-warning": "true",
},
    proxy: {
      "/api": {
        target: "http://localhost:2567",
        changeOrigin: true,
      },
      "/colyseus": {
        target: "ws://localhost:2567",
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/colyseus/, ""),
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});