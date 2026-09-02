/**
 * ESLint, configured in Phase 0b of the v2.1 upgrade.
 *
 * `npm run lint` was never configured. With no config file `next lint` opens an
 * interactive scaffold prompt and exits 1 in any non-TTY shell, so CI has never
 * linted this tree -- the release gate's "lint clean" was a command that failed
 * before it read a single file.
 *
 * `.eslintrc.js` rather than `.eslintrc.json` because the INV-6 rules below
 * need explaining and JSON has nowhere to put the reason.
 *
 * The rule set is deliberately small. It reports real defects, not style
 * opinions this codebase does not hold.
 */
module.exports = {
  root: true,
  extends: ["next/core-web-vitals"],
  ignorePatterns: ["node_modules/", ".next/", "e2e/__baseline__/", "next-env.d.ts"],
  rules: {
    "no-console": ["warn", { allow: ["warn", "error"] }],
  },
  overrides: [
    {
      // The e2e harnesses are Node scripts whose entire output is console logging.
      files: ["e2e/**/*.mjs"],
      rules: { "no-console": "off" },
    },
    {
      /**
       * INV-6, escape-by-construction, enforced by the linter as well as by the
       * static assertions in __tests__/security.test.ts.
       *
       * Two layers on purpose. The static test greps a file list, so it only
       * sees files someone remembered to point it at; the linter sees every
       * file the build compiles. FINDING-02 was exactly a call site someone
       * forgot about.
       */
      files: ["**/*.ts", "**/*.tsx"],
      rules: {
        "no-restricted-properties": [
          "error",
          {
            object: "document",
            property: "write",
            message:
              "INV-6: build DOM with createElement + textContent. document.write is banned (FINDING-02).",
          },
        ],
        "no-restricted-syntax": [
          "error",
          {
            selector: "MemberExpression[property.name='innerHTML']",
            message:
              "INV-6: innerHTML is banned. Use textContent (escape-by-construction, FINDING-02).",
          },
          {
            selector: "MemberExpression[property.name='outerHTML']",
            message: "INV-6: outerHTML is banned. Use textContent (FINDING-02).",
          },
          {
            selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
            message:
              "INV-6: dangerouslySetInnerHTML is banned, except the pre-paint skin picker in app/layout.tsx (DEC-002 / the CSP exception documented in DECISIONS.md).",
          },
        ],
      },
    },
  ],
};
