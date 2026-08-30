/**
 * Phase 9 acceptance journey, end to end through the real browser path.
 *
 * This class of test has caught a real bug in each of the last three phases,
 * every one of which passed the unit suites:
 *   - Phase 5: /compare returned 200 direct and 404 through the proxy
 *   - Phase 7: tau was reported on two different scales by two endpoints
 *   - Phase 8: the exported Merkle root was not the one anchored on chain
 *
 * Run:  node e2e/journey.mjs
 * Needs: web on :3000, engine on :8000, anvil + a deployed contract for sealing.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const results = [];
const log = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

// Emoji and decorative glyphs banned from rendered UI (DEC-002).
const BANNED = /[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}]|[✓✔✗✘⚠↳←]/u;

async function visibleText(page) {
  return page.evaluate(() => {
    const out = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walk.nextNode())) {
      const el = n.parentElement;
      if (!el || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(el.tagName)) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const t = n.textContent.trim();
      if (t) out.push(t);
    }
    return out;
  });
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "officer@mp.gov.in");
  await page.fill('input[type="password"]', "prahari123");
  await Promise.all([
    page.waitForURL("**/dashboard", { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);
}

const run = async () => {
  const browser = await chromium.launch();

  // ---------------------------------------------------------------- journey
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  console.log("\n== JOURNEY: login -> dashboard -> evidence trail -> audit ==");
  await login(page);
  log("login lands on /dashboard", page.url().includes("dashboard"));
  await page.waitForTimeout(9000);

  const body = await page.evaluate(() => document.body.innerText);
  log("threat level reaches CRITICAL", /CRITICAL/.test(body));
  log("in-zone city rendered", /Jabalpur|Katni|Narsinghpur/.test(body));

  // The pitch: 0.84 against a naive 0.999.
  log("evidence trail shows PRAHARI score", /0\.8[0-9]/.test(body), "expects ~0.840");
  log("evidence trail shows naive baseline", /0\.99[0-9]/.test(body), "expects ~0.999");
  log("likelihood-ratio table rendered", /LR\^r|Likelihood ratios/i.test(body));
  log("root causes named", /Identity key|Infrastructure|Linguistic/.test(body));

  // Audit panel.
  log("audit ledger rendered", /Audit Ledger/i.test(body));
  log("hash chain shows prev links", /prev 0x/.test(body));
  log("merkle root shown", /Merkle root/i.test(body));

  // ------------------------------------------------------------ three-way mode
  console.log("\n== MODE TOGGLE ==");
  const modes = await page.evaluate(() =>
    [...document.querySelectorAll('[role="radio"]')]
      .filter((b) => b.offsetParent !== null)
      .map((b) => b.innerText.trim())
  );
  log("DEMO / DATASET / LIVE visible", JSON.stringify(modes) === '["DEMO","DATASET","LIVE"]',
      JSON.stringify(modes));

  // ------------------------------------------------------------ accessibility
  console.log("\n== ACCESSIBILITY ==");
  const dialogsBefore = await page.locator('[role="dialog"]').count();
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) =>
      x.querySelector("svg.lucide-bell")
    );
    b?.click();
  });
  await page.waitForTimeout(1200);
  log("drawer exposes role=dialog", (await page.locator('[role="dialog"]').count()) > dialogsBefore);

  const focusInside = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return Boolean(d && d.contains(document.activeElement));
  });
  log("focus moves into the dialog", focusInside);

  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const stillInside = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return Boolean(d && d.contains(document.activeElement));
  });
  log("Tab stays trapped inside the dialog", stillInside);

  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  log("Escape closes the dialog",
      (await page.locator('[role="dialog"]').count()) <= dialogsBefore);

  log("alert feed is a live region",
      (await page.locator('[aria-live]').count()) > 0);

  // ------------------------------------------------------------ reduced motion
  console.log("\n== PREFERS-REDUCED-MOTION ==");
  const rm = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const rmPage = await rm.newPage();
  await login(rmPage);
  await rmPage.waitForTimeout(4000);
  const anim = await rmPage.evaluate(() => {
    let moving = 0;
    for (const el of document.querySelectorAll("*")) {
      const cs = getComputedStyle(el);
      if (cs.animationName !== "none" && parseFloat(cs.animationDuration) > 0.01) moving++;
    }
    return moving;
  });
  log("no long-running animation under reduced motion", anim === 0, `${anim} animating`);
  const rmBody = await rmPage.evaluate(() => document.body.innerText);
  log("information is NOT reduced with motion", /CRITICAL|BREACH|Jabalpur/i.test(rmBody));
  await rm.close();

  // ------------------------------------------------------------- responsive
  console.log("\n== RESPONSIVE ==");
  for (const [w, h, label] of [[1440, 900, "desktop"], [1024, 768, "tablet"], [390, 844, "phone"]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(900);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    log(`no horizontal overflow @ ${w}px (${label})`, overflow <= 1, `${overflow}px`);

    const hits = (await visibleText(page)).filter((t) => BANNED.test(t));
    log(`no banned glyph @ ${w}px`, hits.length === 0, hits.slice(0, 2).join(" | "));
  }

  // Touch targets, measured with a COARSE pointer so the assertion matches the
  // CSS gate. Testing this on a mouse-driven 390px window would assert a rule
  // that deliberately does not apply there.
  const touch = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const tPage = await touch.newPage();
  await login(tPage);
  await tPage.waitForTimeout(6000);
  const small = await tPage.evaluate(() => {
    const bad = [];
    for (const b of document.querySelectorAll("button, a[href]")) {
      const r = b.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.width < 44 || r.height < 44) {
        bad.push(`${(b.innerText || b.getAttribute("aria-label") || b.tagName).trim().slice(0, 16)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    return bad;
  });
  log("touch targets >= 44px on a touch device", small.length === 0,
      small.slice(0, 3).join(" | "));
  await touch.close();

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n===== ${results.length - failed.length}/${results.length} passed =====`);
  if (failed.length) {
    console.log("FAILED:");
    failed.forEach((f) => console.log(`  - ${f.name}`));
  }
  process.exit(failed.length ? 1 : 0);
};

run().catch((e) => {
  console.error("harness error:", e.message);
  process.exit(2);
});
