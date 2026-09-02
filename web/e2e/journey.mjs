/**
 * Acceptance journey, end to end through the real browser path.
 *
 * This class of test has caught a real bug in each of the last three phases,
 * every one of which passed the unit suites:
 *   - Phase 5: /compare returned 200 direct and 404 through the proxy
 *   - Phase 7: tau was reported on two different scales by two endpoints
 *   - Phase 8: the exported Merkle root was not the one anchored on chain
 *   - Phase 9: the focus trap was a no-op on every dialog (DEC-042)
 *
 * REWRITTEN IN PHASE 0b of the v2.1 upgrade. The previous version drove v1: it
 * logged in as officer@mp.gov.in and waited for a "/dashboard" URL, a route the
 * v2 rebuild removed. It died on its first navigation, so not one of its 25 checks
 * -- including the BANNED glyph regex enforcing INV-7/DEC-002 -- had run since
 * `aa8789e`. It reported a harness error, not a failure, which is why it read
 * as an environment problem rather than a dead test.
 *
 * Four of the old checks tested features v2 does not have (the CRITICAL threat
 * level, the in-zone city, the DEMO/DATASET/LIVE mode toggle, and the
 * notification drawer's focus trap). They are not silently dropped -- see
 * GAPS at the bottom, which prints them on every run.
 *
 * Run:  node web/e2e/journey.mjs
 * Needs: web on :3000 (ENABLE_DEMO_ACCOUNT=1), engine on :8000.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.DEMO_EMAIL ?? "analyst@prahari.local";
const PASSWORD = process.env.DEMO_PASSWORD ?? "prahari123";

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

const loginOn = (page) => login(page);

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await Promise.all([
    // LoginForm does a hard navigation to /workbench, not a router push.
    page.waitForURL("**/workbench", { timeout: 45000 }),
    page.click('button[type="submit"]'),
  ]);
}

/** Click a panel tab by its label. The tabs are plain buttons, not role=tab. */
async function openPanel(page, label) {
  await page.evaluate((l) => {
    [...document.querySelectorAll("button")]
      .find((b) => b.innerText.trim().toUpperCase() === l)
      ?.click();
  }, label);
}

const run = async () => {
  const browser = await chromium.launch();

  // ---------------------------------------------------------------- journey
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  console.log("\n== JOURNEY: login -> workbench -> evidence trail -> ledger ==");
  await login(page);
  log("login lands on /workbench", page.url().includes("workbench"));
  // The workbench polls the engine on a 30 s timer, so the network is never
  // idle: settle on a timer rather than waiting for networkidle.
  await page.waitForTimeout(9000);

  const body = await page.evaluate(() => document.body.innerText);

  // Actor list — the triage surface.
  log("actor list renders a resolved count", /\d+\s+resolved/i.test(body));
  log("confidence thresholds offered", /≥\s*0\.40/.test(body) && /≥\s*0\.90/.test(body));
  log("actor selected by default", /ATTRIBUTION CONFIDENCE/i.test(body));

  // The pitch: 0.84 against a naive 0.999.
  log("evidence trail shows PRAHARI score", /0\.8[0-9]/.test(body), "expects ~0.840");
  log("evidence trail shows naive baseline", /0\.99[0-9]/.test(body), "expects ~0.999");
  log("likelihood-ratio table rendered", /LR\^R|Likelihood ratios/i.test(body));
  log("root causes named", /Identity key|Infrastructure|Linguistic/.test(body));
  log("trail states whether it recomputes the score", /Trail recomputes score/i.test(body));

  // The graph, and its legend — colour carries meaning, so the key must be up.
  log("relationship graph mounted", (await page.locator("canvas").count()) > 0);
  log("graph legend names the entity types",
      /Actor \/ PGP/.test(body) && /Persona/.test(body) && /Infra/.test(body));

  // Ledger — chain of custody.
  await openPanel(page, "LEDGER");
  await page.waitForTimeout(14000);
  const ledger = await page.evaluate(() => document.body.innerText);
  log("audit ledger rendered", /CHAIN OF CUSTODY/i.test(ledger));
  log("hash chain shows prev links", /prev 0x/.test(ledger));
  log("merkle root shown", /Merkle root/i.test(ledger));
  log("leaf count stated", /Leaves/i.test(ledger));

  // Every panel is reachable.
  console.log("\n== PANELS ==");
  for (const tab of ["EVIDENCE", "TOR TIMING", "CHAIN FLOW"]) {
    await openPanel(page, tab);
    await page.waitForTimeout(2500);
    const t = await page.evaluate(() => document.body.innerText);
    log(`${tab} panel opens`, t.length > 200);
  }

  // ------------------------------------------------------------------ sangam
  console.log("\n== SANGAM (WHO x WHERE) ==");
  await page.goto(`${BASE}/sangam`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);
  const sangam = await page.evaluate(() => document.body.innerText);
  log("sangam route renders", /WHO × WHERE|संगम/.test(sangam));
  log("sangam lists actors to place", /0\.9\d/.test(sangam));
  log("sangam links back to the workbench", /WORKBENCH/i.test(sangam));

  // ------------------------------------------------------------ accessibility
  console.log("\n== ACCESSIBILITY ==");
  await page.goto(`${BASE}/workbench`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);

  log("a status region is live",
      (await page.locator("[aria-live]").count()) > 0);

  // Keyboard reachability: Tab from the top must land on a real control.
  await page.evaluate(() => document.body.focus());
  await page.keyboard.press("Tab");
  const firstStop = await page.evaluate(() => {
    const a = document.activeElement;
    return a ? { tag: a.tagName, name: (a.innerText || a.getAttribute("aria-label") || "").trim() } : null;
  });
  log("Tab reaches a focusable control", Boolean(firstStop && firstStop.tag !== "BODY"),
      firstStop ? `${firstStop.tag} ${firstStop.name.slice(0, 24)}` : "nothing focused");

  // Focus must be visible, or keyboard navigation is unusable in practice.
  const hasFocusVisible = await page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return false;
    const cs = getComputedStyle(a);
    return cs.outlineStyle !== "none" || cs.boxShadow !== "none" || a.matches(":focus-visible");
  });
  log("focused control is visibly focused", hasFocusVisible);

  const unnamed = await page.evaluate(() =>
    [...document.querySelectorAll("button, a[href]")]
      .filter((b) => b.getBoundingClientRect().width > 0)
      .filter((b) => !(b.innerText || "").trim() && !b.getAttribute("aria-label") && !b.getAttribute("title"))
      .map((b) => b.className.toString().slice(0, 30))
  );
  log("every visible control has an accessible name", unnamed.length === 0,
      unnamed.slice(0, 3).join(" | "));

  // ------------------------------------------------------- skin: once per visit
  //
  // DEC-055. The draw is a property of the VISIT. Walk every route, hard-reload
  // in the middle, and assert the skin, the rail layout and the type pair are
  // identical at every step. Then open a FRESH context and assert the draw is
  // independent -- that difference is the feature, not a failure.
  console.log("\n== SKIN: DRAWN ONCE PER VISIT (DEC-055) ==");

  const drawOf = (p) =>
    p.evaluate(() => {
      const d = document.documentElement;
      const cs = getComputedStyle(d);
      return {
        skin: d.getAttribute("data-skin"),
        layout: d.getAttribute("data-layout"),
        font: d.getAttribute("data-font"),
        source: d.getAttribute("data-skin-source"),
        accent: cs.getPropertyValue("--accent").trim(),
        disp: cs.getPropertyValue("--font-disp").trim(),
      };
    });

  const skinCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const sp = await skinCtx.newPage();
  await sp.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await sp.waitForTimeout(900);
  const first = await drawOf(sp);
  log("first load draws a skin", Boolean(first.skin), `${first.skin}/${first.layout}/font ${first.font}`);
  log("first load records it as a fresh draw", first.source === "fresh", first.source);

  const ROUTES = ["/about", "/docs", "/login", "/"];
  let stable = true;
  const drift = [];
  for (const r of ROUTES) {
    await sp.goto(`${BASE}${r}`, { waitUntil: "domcontentloaded" });
    await sp.waitForTimeout(700);
    const d = await drawOf(sp);
    const same =
      d.skin === first.skin && d.layout === first.layout &&
      d.font === first.font && d.accent === first.accent && d.disp === first.disp;
    if (!same) { stable = false; drift.push(`${r}: ${d.skin}/${d.layout}/${d.font}`); }
  }
  log("skin, layout and type hold across public routes", stable, drift.join(" | "));
  log("later loads resolve from the session, not a new draw",
      (await drawOf(sp)).source === "session");

  // Authenticated routes, then a HARD reload -- the exact case that repainted
  // the product mid-investigation before DEC-055.
  await loginOn(sp);
  await sp.waitForTimeout(4000);
  const afterLogin = await drawOf(sp);
  log("draw survives login and the workbench",
      afterLogin.skin === first.skin && afterLogin.layout === first.layout &&
      afterLogin.font === first.font,
      `${afterLogin.skin}/${afterLogin.layout}/${afterLogin.font}`);

  await sp.goto(`${BASE}/sangam`, { waitUntil: "domcontentloaded" });
  await sp.waitForTimeout(2500);
  const atSangam = await drawOf(sp);
  log("draw survives /sangam",
      atSangam.skin === first.skin && atSangam.layout === first.layout && atSangam.font === first.font);

  await sp.goto(`${BASE}/workbench`, { waitUntil: "domcontentloaded" });
  await sp.reload({ waitUntil: "domcontentloaded" });
  await sp.waitForTimeout(4000);
  const afterReload = await drawOf(sp);
  log("draw survives a HARD RELOAD of /workbench",
      afterReload.skin === first.skin && afterReload.layout === first.layout &&
      afterReload.font === first.font && afterReload.accent === first.accent,
      `${afterReload.skin}/${afterReload.layout}/${afterReload.font}`);

  // ?skin= applies for that request and does NOT overwrite the visit.
  await sp.goto(`${BASE}/?skin=plasma`, { waitUntil: "domcontentloaded" });
  await sp.waitForTimeout(700);
  const forced = await drawOf(sp);
  log("?skin= applies for that request", forced.skin === "plasma" && forced.source === "query");
  await sp.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await sp.waitForTimeout(700);
  log("?skin= did NOT overwrite the visit's draw", (await drawOf(sp)).skin === first.skin);

  // No first-paint flash: the pre-paint script must have run before any body
  // paint, so data-skin is present on the very first evaluation of a new page.
  const preflight = await skinCtx.newPage();
  await preflight.goto(`${BASE}/`, { waitUntil: "commit" });
  const atCommit = await preflight
    .evaluate(() => document.documentElement.getAttribute("data-skin"))
    .catch(() => null);
  log("skin is applied before first paint (no flash)", Boolean(atCommit), String(atCommit));
  await preflight.close();

  // Semantic colour is NOT skin colour: the six signal-root tokens must be
  // byte-identical under every skin.
  const SIG = ["--sig-identity", "--sig-infra", "--sig-financial",
               "--sig-temporal", "--sig-linguistic", "--sig-social"];
  const perSkin = {};
  for (const id of ["ember", "abyss", "verdant", "plasma", "solar", "arctic"]) {
    await sp.goto(`${BASE}/?skin=${id}`, { waitUntil: "domcontentloaded" });
    await sp.waitForTimeout(500);
    perSkin[id] = await sp.evaluate((vars) => {
      const cs = getComputedStyle(document.documentElement);
      return vars.map((v) => cs.getPropertyValue(v).trim());
    }, SIG);
  }
  const base = JSON.stringify(perSkin.ember);
  const differing = Object.entries(perSkin).filter(([, v]) => JSON.stringify(v) !== base);
  log("signal-root colours are identical across all six skins",
      differing.length === 0 && perSkin.ember.every(Boolean),
      differing.map(([k]) => k).join(", "));

  // The accent, by contrast, SHOULD move between skins -- otherwise the test
  // above proves nothing.
  const accents = new Set();
  for (const id of ["ember", "abyss", "verdant"]) {
    await sp.goto(`${BASE}/?skin=${id}`, { waitUntil: "domcontentloaded" });
    await sp.waitForTimeout(400);
    accents.add((await drawOf(sp)).accent);
  }
  log("decorative accent DOES vary by skin (control)", accents.size === 3, `${accents.size} distinct`);

  await skinCtx.close();

  // A new visit is an independent draw. Sample several contexts: one differing
  // draw proves independence without depending on a 1-in-36 coincidence.
  const draws = new Set();
  for (let i = 0; i < 6; i++) {
    const c = await browser.newContext({ viewport: { width: 800, height: 600 } });
    const p2 = await c.newPage();
    await p2.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await p2.waitForTimeout(500);
    const d = await drawOf(p2);
    draws.add(`${d.skin}/${d.layout}/${d.font}`);
    await c.close();
  }
  log("a new visit draws independently", draws.size > 1, `${draws.size} distinct draws in 6 visits`);

  // ------------------------------------------------------------ reduced motion
  console.log("\n== PREFERS-REDUCED-MOTION ==");
  const rm = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const rmPage = await rm.newPage();
  await login(rmPage);
  await rmPage.waitForTimeout(9000);
  const anim = await rmPage.evaluate(() => {
    let moving = 0;
    for (const el of document.querySelectorAll("*")) {
      const cs = getComputedStyle(el);
      if (cs.animationName !== "none" && parseFloat(cs.animationDuration) > 0.01) moving++;
    }
    return moving;
  });
  log("no long-running animation under reduced motion", anim === 0, `${anim} animating`);

  // INV-11: motion is gated, information is not.
  const rmBody = await rmPage.evaluate(() => document.body.innerText);
  log("information is NOT reduced with motion",
      /ATTRIBUTION CONFIDENCE/i.test(rmBody) && /0\.8[0-9]/.test(rmBody));
  log("the graph degrades to a readable fallback, not a blank panel",
      /RELATIONSHIP GRAPH|LINKAGE/i.test(rmBody));
  await rm.close();

  // ------------------------------------------------------------- responsive
  console.log("\n== RESPONSIVE ==");
  for (const [w, h, label] of [[1440, 900, "desktop"], [1024, 768, "tablet"], [390, 844, "phone"]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(1200);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    log(`no horizontal overflow @ ${w}px (${label})`, overflow <= 1, `${overflow}px`);

    const hits = (await visibleText(page)).filter((t) => BANNED.test(t));
    log(`no banned glyph @ ${w}px`, hits.length === 0, hits.slice(0, 2).join(" | "));
  }

  // Touch targets, measured with a COARSE pointer so the assertion matches the
  // CSS gate (DEC-043). Testing this on a mouse-driven 390px window would
  // assert a rule that deliberately does not apply there.
  const touch = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const tPage = await touch.newPage();
  await login(tPage);
  await tPage.waitForTimeout(9000);
  const small = await tPage.evaluate(() => {
    const bad = [];
    for (const b of document.querySelectorAll("button, a[href]")) {
      const r = b.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.width < 44 || r.height < 44) {
        bad.push(
          `${(b.innerText || b.getAttribute("aria-label") || b.tagName).trim().slice(0, 16)} ${Math.round(r.width)}x${Math.round(r.height)}`
        );
      }
    }
    return bad;
  });
  log("touch targets >= 44px on a touch device", small.length === 0, small.slice(0, 3).join(" | "));
  await touch.close();

  await browser.close();

  /**
   * Coverage this journey USED to have and no longer can, printed every run so
   * it cannot quietly become "we always tested that".
   */
  console.log("\n== GAPS (v1 checks with no v2 equivalent) ==");
  for (const gap of [
    "threat level reaches CRITICAL — v2 has no threat-level widget",
    "in-zone city rendered — v2 has no geofence city list",
    "DEMO / DATASET / LIVE toggle — v2 has no mode switch",
    "dialog focus trap (4 checks) — v2 renders no role=dialog anywhere, so " +
      "lib/a11y.ts trapFocus/focusableWithin are currently unreferenced. " +
      "Any drawer or modal added in Phase 2/3 must wire them back in and " +
      "restore these checks.",
  ]) {
    console.log(`  GAP   ${gap}`);
  }

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
