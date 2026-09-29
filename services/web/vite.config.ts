/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The production path is nginx (http://localhost) proxying /api to the
// gateway. The dev server proxies /api too, so opening :5173 directly
// works the same way instead of 404ing on /api/session/start. Inside
// docker compose the gateway is reachable as http://gateway:8000.
const gateway = process.env.VITE_GATEWAY_URL ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": { target: gateway, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, "") },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
