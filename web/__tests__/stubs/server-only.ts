/**
 * A no-op stand-in for Next's `server-only` package, for vitest.
 *
 * `server-only` has no runtime behaviour at all: importing it makes the Next
 * BUILD fail if the module ever reaches a client bundle. Vitest is not Next and
 * has no client boundary, so it cannot resolve the package and there is nothing
 * for it to enforce.
 *
 * Aliasing it away does not weaken the guarantee, because the guarantee was
 * never a runtime one -- but it does move where the guarantee is checked, so
 * `security.test.ts` asserts that every module holding a secret still carries
 * the import, and `next build` remains the thing that enforces it.
 */
export {};
