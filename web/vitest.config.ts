import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Web unit suite.
 *
 * Rebuilt in Phase 0b of the v2.1 upgrade. `aa8789e` deleted `web/__tests__/`
 * in full when it removed the v1 console, and nothing replaced it -- so this
 * config kept pointing at `__tests__/**` and `vitest run` reported "No test
 * files found" and exited 1 for every run since. The two environmentMatchGlobs
 * it carried named v1 files that no longer existed.
 *
 * Default environment is `node`. happy-dom is opted into per file, because it
 * is slower and because DEC-042 is a standing reminder that it is not a
 * browser: it reports layout differently, which is how a no-op focus trap
 * passed nine unit tests. Anything that depends on real layout belongs in
 * `e2e/journey.mjs`, not here.
 */
export default defineConfig({
  test: {
    environment: "node",
    environmentMatchGlobs: [
      ["__tests__/report.test.ts", "happy-dom"],
      ["__tests__/a11y.test.ts", "happy-dom"],
      ["__tests__/reportPdf.test.ts", "happy-dom"],
    ],
    include: ["__tests__/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
