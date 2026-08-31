import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 4173 },
  preview: { port: 4173 },
  build: { sourcemap: false },
  test: { environment: "jsdom", globals: true, include: ["src/**/*.test.ts"] },
});
