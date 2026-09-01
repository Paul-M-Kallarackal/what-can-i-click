import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { sites } from "@openai/sites-vite-plugin";

const hostingPlugins = process.env.VITEST ? [] : [sites(), ...cloudflare()];

export default defineConfig({
  plugins: [react(), ...hostingPlugins],
  server: { port: 4173 },
  preview: { port: 4173 },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(moduleId) {
          if (
            moduleId.includes("/node_modules/three/") ||
            moduleId.includes("/node_modules/@react-three/")
          ) {
            return "three-vendor";
          }

          if (
            moduleId.includes("/node_modules/react/") ||
            moduleId.includes("/node_modules/react-dom/") ||
            moduleId.includes("/node_modules/zustand/") ||
            moduleId.includes("/node_modules/zod/")
          ) {
            return "react-vendor";
          }
        },
      },
    },
  },
  test: { environment: "jsdom", globals: true, include: ["src/**/*.test.ts"] },
});
