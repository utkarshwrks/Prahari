/**
 * Phase 0 baseline capture (v2.1 upgrade).
 *
 * Freezes the pre-upgrade appearance of the four routes the upgrade touches, so
 * later phases can diff against a real picture rather than a memory. The skin is
 * pinned with ?skin= so a re-run is comparable -- without that the generative
 * skin picker draws a different palette every run and every diff is noise.
 *
 * Needs: web on :3000, engine on :8000.
 * Run:   node web/e2e/baseline-shots.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SKIN = process.env.BASELINE_SKIN ?? "abyss";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "__baseline__");
const EMAIL = process.env.DEMO_EMAIL ?? "analyst@prahari.local";
const PASSWORD = process.env.DEMO_PASSWORD ?? "prahari123";

// Authenticated routes -- the middleware matcher covers /workbench and /sangam.
const GUARDED = new Set(["/workbench", "/sangam"]);
const ROUTES = ["/", "/login", "/workbench", "/sangam"];

const url = (path) => `${BASE}${path}${path.includes("?") ? "&" : "?"}skin=${SKIN}`;
const fileFor = (path) => join(OUT, `${path === "/" ? "home" : path.slice(1).replace(/\//g, "-")}.png`);

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await Promise.all([
    page.waitForURL("**/workbench", { timeout: 45000 }),
    page.click('button[type="submit"]'),
  ]);
}

const main = async () => {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  let authed = false;

  for (const route of ROUTES) {
    if (GUARDED.has(route) && !authed) {
      await login(page);
      authed = true;
    }
    // domcontentloaded, not networkidle: the workbench polls the engine on a
    // 30 s timer, so the network is never idle and networkidle always times out.
    await page.goto(url(route), { waitUntil: "domcontentloaded" });
    // Settle late-arriving engine panels and any entrance animation.
    await page.waitForTimeout(6000);
    const file = fileFor(route);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`  captured  ${route}  ->  ${file.replace(`${OUT}/`, "")}`);
  }

  await browser.close();
  console.log(`\nBaseline written to web/e2e/__baseline__ (skin=${SKIN}, 1440x900, fullPage).`);
};

main().catch((err) => {
  console.error("baseline capture failed:", err.message);
  process.exit(1);
});
