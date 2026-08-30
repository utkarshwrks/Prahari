import { defineConfig } from "vitest/config";
import path from "path";

// Phase 1 test runner. Tests live at __tests__/ and move to web/__tests__/ in
// Phase 2 with the monorepo restructure (DEC-008).
export default defineConfig({
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
