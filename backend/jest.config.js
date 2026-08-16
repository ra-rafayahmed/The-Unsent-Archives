/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  setupFiles: ["<rootDir>/tests/helpers/env.js"],
  setupFilesAfterEnv: ["<rootDir>/tests/helpers/db.js"],
  testTimeout: 30000,
  clearMocks: true,
  coverageDirectory: "coverage",
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
