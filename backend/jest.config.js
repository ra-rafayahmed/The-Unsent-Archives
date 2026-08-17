/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  setupFiles: ["<rootDir>/tests/helpers/env.js"],
  setupFilesAfterEnv: ["<rootDir>/tests/helpers/db.js"],
  testTimeout: 30000,
  clearMocks: true,
  coverageDirectory: "coverage",
  coverageReporters: ["text", "text-summary", "lcov"],
  // Ratchet: raise these as coverage grows; CI fails below them.
  coverageThreshold: {
    global: { statements: 84, branches: 71, functions: 80, lines: 86 },
  },
  collectCoverageFrom: [
    "controllers/**/*.js",
    "middleware/**/*.js",
    "models/**/*.js",
    "services/**/*.js",
    "utils/**/*.js",
    "validators/**/*.js",
    "app.js",
  ],
};
