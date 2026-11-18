import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

// Verificação de qualidade do código (roda no GitHub a cada envio). Só regras que pegam erros reais.
export default tseslint.config(
  { ignores: ["dist", "node_modules", "rules-tests", "scripts/node_modules", "coverage"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}", "functions/**/*.ts"],
    languageOptions: { globals: { ...globals.browser, ...globals.worker } },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  { files: ["scripts/**/*.mjs"], languageOptions: { globals: globals.node } },
  { files: ["public/**/*.js"], languageOptions: { globals: { ...globals.serviceworker, ...globals.browser } } },
);
