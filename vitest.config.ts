import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/uploads/**",
      // These tests require Python cv2 (OpenCV) which is not available in CI
      "tests/temporal-smoothing.test.ts",
      "tests/manual-corners.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
    },
  },
});
