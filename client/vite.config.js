import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  test: { globals: true, environment: "jsdom", setupFiles: "./vitest.setup.js" },
  server: { proxy: { "/api": "http://localhost:3001" } },
});
