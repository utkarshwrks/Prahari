/**
 * Accessibility pass over every route the v2.1 upgrade added (Phase 8).
 *
 * axe-core injected into a REAL browser, not happy-dom — DEC-042 is the
 * standing reminder that happy-dom reports layout differently and that is
 * exactly how a no-op focus trap passed nine unit tests.
 *
 * Run: node web/e2e/axe.mjs
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const ROUTES = [
  "/", "/about", "/docs", "/login",
  "/workbench", "/workbench/actors", "/workbench/compare", "/workbench/tor",
  "/workbench/case/CASE-001", "/workbench/classic",
  "/workbench/actor/actor-009",
  "/workbench/actor/actor-009/graph",
  "/workbench/actor/actor-009/evidence",
  "/workbench/actor/actor-009/timeline",
  "/workbench/actor/actor-009/chain",
  "/sangam", "/command",
];

const run = async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', "analyst@prahari.local");
  await page.fill('input[type="password"]', "prahari123");
  await Promise.all([
    page.waitForURL("**/workbench", { timeout: 45000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(2500);

  let total = 0;
  const bad = [];

  for (const route of ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(route === "/sangam" || route.endsWith("classic") ? 8000 : 4000);
    await page.addScriptTag({ content: AXE });
    const res = await page.evaluate(async () =>
      // Serious and critical only. A release gate that fails on every "minor"
      // colour-contrast hint on a deliberately dim tactical palette would be a
      // gate nobody reads.
      window.axe.run(document, {
        resultTypes: ["violations"],
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
      })
    );
    const serious = res.violations.filter((v) => ["serious", "critical"].includes(v.impact));
    total += serious.length;
    const line = serious.length
      ? serious.map((v) => `${v.id}(${v.nodes.length})`).join(" ")
      : "clean";
    console.log(`  ${serious.length ? "FAIL" : "PASS"}  ${route.padEnd(38)} ${line}`);
    if (serious.length) bad.push({ route, serious });
  }

  await browser.close();

  console.log(`\n===== ${ROUTES.length - bad.length}/${ROUTES.length} routes clean of serious/critical =====`);
  if (bad.length) {
    for (const b of bad) {
      console.log(`\n${b.route}`);
      for (const v of b.serious) {
        console.log(`  [${v.impact}] ${v.id}: ${v.help}`);
        for (const n of v.nodes.slice(0, 2)) console.log(`      ${n.html.slice(0, 110)}`);
      }
    }
  }
  process.exit(total ? 1 : 0);
};

run().catch((e) => {
  console.error("axe harness error:", e.message);
  process.exit(2);
});
