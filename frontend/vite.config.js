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
    // jsdom setup is heavy; on a busy machine spawning one worker per core
    // can time out worker startup ("Failed to start threads worker"). Cap the
    // pool so `npm test` is reliable on modest hardware and in CI containers.
    // (Vitest 4 moved these out of the removed `poolOptions` block.)
    minWorkers: 1,
    maxWorkers: 4,
    // Never let an empty/failed collection pass as success.
    passWithNoTests: false,
    globals: true,
    setupFiles: ["./src/test/setup.js"],
    // The tests themselves are fast, but spinning up jsdom per file can take
    // seconds on a cold or busy machine; 5s (the default) flakes there.
    testTimeout: 15000,
    hookTimeout: 15000,
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/main.jsx", "src/test/**"],
      // Ratchet: raise these as coverage grows; CI fails below them.
      thresholds: { statements: 85, branches: 79, functions: 80, lines: 86 },
    },
  },
});
