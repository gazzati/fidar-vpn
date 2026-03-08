const eslint = require("@eslint/js")
const globals = require("globals")
const tseslint = require("typescript-eslint")

module.exports = tseslint.config(
  {
    ignores: ["build/**", "node_modules/**"]
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "commonjs",
      globals: globals.node
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "preserve-caught-error": "off"
    }
  }
)
