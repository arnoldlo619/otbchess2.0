import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    include: [
      "client/**/*.test.{ts,tsx}",
      "server/**/*.test.{ts,tsx}",
      "shared/**/*.test.{ts,tsx}",
      "tests/**/*.test.{ts,tsx}",
      "scripts/**/*.test.{ts,tsx}",
    ],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/uploads/**",
      "e2e/**",
      "tests/temporal-smoothing.test.ts",
      "tests/manual-corners.test.ts",
      "server/platformEmail.test.ts",
      "tests/lichess-token-validation.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
});
