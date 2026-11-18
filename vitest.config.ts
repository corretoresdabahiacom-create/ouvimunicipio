import { defineConfig } from "vitest/config";

// Testes do app (funções e telas). Os testes das regras do Firestore ficam em rules-tests/ (precisam do emulador).
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}", "functions/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    restoreMocks: true,
  },
});
