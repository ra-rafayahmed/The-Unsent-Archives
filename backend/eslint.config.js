const js = require("@eslint/js");
const globals = require("globals");
const jest = require("eslint-plugin-jest");
const prettier = require("eslint-config-prettier");

module.exports = [
  { ignores: ["node_modules/**", "coverage/**"] },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
    rules: {
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_|^next$|^req$|^res$", caughtErrors: "none" },
      ],
      "no-console": "warn",
    },
  },
  {
    files: ["tests/**/*.js"],
    ...jest.configs["flat/recommended"],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
    rules: {
      ...jest.configs["flat/recommended"].rules,
      // Some suites assert through shared helpers; teach the rule about them
      // instead of losing the check everywhere.
      "jest/expect-expect": ["warn", { assertFunctionNames: ["expect", "expectValidationError"] }],
    },
  },
  prettier,
];
