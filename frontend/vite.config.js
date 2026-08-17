import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  test: {
    environment: "jsdom",
    // "forks" (the default) fails to start workers on Windows when the
    // project path contains spaces; threads is fine everywhere.
    pool: "threads",
    globals: true,
    setupFiles: ["./src/test/setup.js"],
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/main.jsx", "src/test/**"],
      // Ratchet: raise these as coverage grows; CI fails below them.
      thresholds: { statements: 44, branches: 37, functions: 38, lines: 44 },
    },
  },
});
