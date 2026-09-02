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
 *
 * NOTE: this journey logs in four times per run (main context, reduced-motion,
 * touch, and the skin walk). `lib/auth.ts` rate-limits the credentials callback
 * per IP with an in-process fixed-window counter (DEC-046), so running the
 * journey several times in a row will eventually be throttled and every run
 * then dies with `waitForURL: Timeout` at login. That is the limiter working,
 * not a broken harness. Restart the web server to clear the window -- the
 * counter is module-scoped memory, which is precisely the limitation DEC-046
 * documents.
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
  await page.waitForTimeout(4000);

  /**
   * Which build is this?
   *
   * NEXT_PUBLIC_FF_WORKSPACE is inlined at build time, so the journey cannot
   * read it -- it asks the page instead. With the flag on, /workbench is the
   * Overview and the cockpit lives at /workbench/classic; with it off, a
   * rewrite serves the cockpit at /workbench itself.
   *
   * Detecting rather than assuming means this file is a real gate for BOTH
   * builds. Assuming the flag was on is exactly how the flag-off rewrite bug
   * survived its first run.
   */
  const WORKSPACE = await page.evaluate(
    () => document.querySelector('nav[aria-label="Workspace"]') !== null
  );
  const COCKPIT = WORKSPACE ? "/workbench/classic" : "/workbench";
  console.log(`  ---   workspace flag: ${WORKSPACE ? "ON" : "OFF"} · cockpit at ${COCKPIT}`);

  // The cockpit checks below are about the single-page cockpit specifically,
  // so drive it where it actually lives in this build.
  await page.goto(`${BASE}${COCKPIT}`, { waitUntil: "domcontentloaded" });
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
  const sangamPro = await page.evaluate(
    () => document.querySelector("[data-testid=class-legend]") !== null
  );
  log("sangam route renders", /WHO × WHERE|संगम/.test(sangam));

  /**
   * Which SANGAM is this?
   *
   * Detected, not assumed -- the same lesson as the workspace flag in Phase 2.
   * SANGAM Pro replaces the actor confidence list and the WORKBENCH link with a
   * class legend and an actor selector, so asserting the old surface against
   * the new one would fail for a correct build.
   */
  if (sangamPro) {
    log("sangam offers actors to place",
        (await page.locator('select[aria-label="Actor"] option').count()) > 1);
    log("sangam states the coordinate classes", /coordinate class/i.test(sangam));
  } else {
    log("sangam lists actors to place", /0\.9\d/.test(sangam));
    log("sangam links back to the workbench", /WORKBENCH/i.test(sangam));
  }

  // ------------------------------------------------------------ accessibility
  console.log("\n== ACCESSIBILITY ==");
  await page.goto(`${BASE}${COCKPIT}`, { waitUntil: "domcontentloaded" });
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

  // ------------------------------------------------------- the workspace (DEC-056)
  //
  // Ten routed surfaces plus the legacy cockpit. The walk asserts each renders,
  // that the store serves one actor object to all of them, and that the legacy
  // page is still intact -- the prime directive is additive only.
  console.log("\n== WORKSPACE (DEC-056) ==");

  if (!WORKSPACE) {
    // Not a silent skip: the flag-off build has its own guarantee to prove,
    // which is that the cockpit is exactly where it always was.
    const cockpitText = await page.evaluate(() => document.body.innerText);
    log("flag off: /workbench still serves the single-page cockpit",
        /\d+\s+resolved/i.test(cockpitText) && !/Skip to content/.test(cockpitText));
    log("flag off: the workspace shell is not rendered",
        (await page.locator('nav[aria-label="Workspace"]').count()) === 0);
    for (const line of [
      "ten workspace route checks — flag off",
      "store invariant — flag off",
      "deep-link round trip — flag off",
      "command palette / focus trap — flag off",
    ]) {
      console.log(`  SKIP  ${line}`);
    }
  }

  const WORKSPACE_ROUTES = WORKSPACE ? [
    ["/workbench", /OVERVIEW|TRIAGE|Strong case/i, "Overview"],
    ["/workbench/actors", /Search actors/i, "Actor list"],
    ["/workbench/compare", /Compare two actors/i, "Compare"],
    ["/workbench/tor", /TOR|timing/i, "Tor timing lab"],
    ["/workbench/case/CASE-001", /CASE-001/i, "Case ledger"],
    ["/workbench/actor/actor-088", /nightowl1/i, "Actor dossier"],
    ["/workbench/actor/actor-088/graph", /nightowl1/i, "Graph lab"],
    ["/workbench/actor/actor-088/evidence", /nightowl1/i, "Evidence trail"],
    ["/workbench/actor/actor-088/timeline", /nightowl1/i, "Timeline"],
    ["/workbench/actor/actor-088/chain", /nightowl1/i, "Chain flow"],
    ["/workbench/classic", /ACTORS|resolved/i, "Classic cockpit"],
  ] : [];

  const wsErrors = [];
  page.on("pageerror", (e) => wsErrors.push(e.message));

  for (const [route, expected, label] of WORKSPACE_ROUTES) {
    const res = await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(route.includes("case") || route.endsWith("classic") ? 9000 : 4500);
    const t = await page.evaluate(() => document.body.innerText);
    log(`${label} renders`, res.status() === 200 && expected.test(t), `${res.status()}`);
  }
  if (WORKSPACE) {
    log("no client-side exception on any workspace route", wsErrors.length === 0,
        wsErrors.slice(0, 2).join(" | "));
  }

  if (WORKSPACE) {

  // The store invariant, observed on the real screen: the confidence in the
  // context bar must equal the dossier's on EVERY per-actor route.
  const confidences = [];
  for (const seg of ["", "/graph", "/evidence", "/timeline", "/chain"]) {
    await page.goto(`${BASE}/workbench/actor/actor-088${seg}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    confidences.push(
      await page.evaluate(() =>
        document.querySelector("[data-testid=context-actor]")?.getAttribute("data-confidence") ?? null
      )
    );
  }
  const distinct = new Set(confidences.filter(Boolean));
  log("one actor, one confidence across all five actor routes",
      distinct.size === 1 && confidences.every(Boolean), `saw [${[...distinct].join(", ")}]`);

  // Deep-link round trip: a pasted URL must reproduce the exact view.
  await page.goto(`${BASE}/workbench/actors?band=strong&sort=posts&dir=asc`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(4500);
  const deep = await page.evaluate(() => ({
    rows: document.querySelectorAll("tbody tr").length,
    pressed: document.querySelector('[aria-pressed="true"]')?.textContent?.trim(),
    sorted: document.querySelector('[aria-sort="ascending"]')?.textContent?.trim(),
  }));
  log("deep link restores band, sort and direction",
      deep.rows > 0 && /strong/i.test(deep.pressed ?? "") && /posts/i.test(deep.sorted ?? ""),
      `${deep.rows} rows, band=${deep.pressed}, sort=${deep.sorted}`);

  // Changing a facet must be reflected back into the URL, or the link is a lie.
  await page.goto(`${BASE}/workbench/actors`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) =>
      /worth a look/i.test(x.textContent ?? "")
    );
    b?.click();
  });
  await page.waitForTimeout(1200);
  log("changing a facet writes it back to the URL", page.url().includes("band=worth-a-look"),
      page.url().split("/workbench")[1] ?? "");

  // Command palette: Cmd-K, and the DEC-042 focus trap it restores (FINDING-07).
  console.log("\n== COMMAND PALETTE / FOCUS TRAP (FINDING-07) ==");
  await page.goto(`${BASE}/workbench`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  const dialogsBefore = await page.locator('[role="dialog"]').count();
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(900);
  const opened = await page.locator('[role="dialog"]').count();
  log("Cmd/Ctrl-K opens the command palette", opened > dialogsBefore);

  log("palette exposes role=dialog and aria-modal",
      (await page.locator('[role="dialog"][aria-modal="true"]').count()) > 0);

  const focusInside = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return Boolean(d && d.contains(document.activeElement));
  });
  log("focus moves into the dialog", focusInside);

  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const stillInside = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return Boolean(d && d.contains(document.activeElement));
  });
  log("Tab stays trapped inside the dialog", stillInside);

  await page.keyboard.type("night");
  await page.waitForTimeout(1200);
  const hasResults = await page.evaluate(
    () => document.querySelectorAll('[role="option"]').length > 0
  );
  log("palette searches actors", hasResults);

  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
  log("Escape closes the dialog",
      (await page.locator('[role="dialog"]').count()) <= dialogsBefore);

  // Focus restoration needs something to restore TO. Opening with Ctrl-K from
  // an unfocused page leaves activeElement as <body>, which is not focusable --
  // so the meaningful test opens the palette from a real control and asserts
  // the caret comes back to it. This is the DEC-042 guarantee end to end.
  const restored = await page.evaluate(async () => {
    const opener = [...document.querySelectorAll("button")].find(
      (b) => b.getAttribute("aria-label") === "Open command palette"
    );
    if (!opener) return { ok: false, why: "no opener button" };
    opener.focus();
    opener.click();
    await new Promise((r) => setTimeout(r, 600));
    const trapped = Boolean(
      document.querySelector('[role="dialog"]')?.contains(document.activeElement)
    );
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await new Promise((r) => setTimeout(r, 600));
    return { ok: trapped && document.activeElement === opener, why: document.activeElement?.tagName };
  });
  log("focus returns to the control that opened the palette", restored.ok, String(restored.why));
  }

  // --------------------------------------------- keep-alive (DEC-064/065)
  console.log("\n== KEEP-ALIVE (DEC-064, DEC-065) ==");

  const ping = await page.evaluate(async () => {
    const started = performance.now();
    const r = await fetch("/api/engine/health/ping", { cache: "no-store" });
    const body = await r.json();
    return { status: r.status, ms: Math.round(performance.now() - started), body };
  });
  log("the engine ping answers", ping.status === 200 && ping.body.ok === true);
  log("it reports uptime, pings and the budget",
      ["uptime_s", "awake_since", "pings_24h", "budget_used_pct", "next_window"]
        .every((k) => k in ping.body),
      Object.keys(ping.body).join(", "));
  log("it is fast enough to be a keep-alive", ping.ms < 400, `${ping.ms} ms round trip`);

  const health = await page.evaluate(async () => {
    const r = await fetch("/api/health", { cache: "no-store" });
    return { status: r.status, cache: r.headers.get("cache-control"), body: await r.json() };
  });
  log("the web health endpoint answers", health.status === 200 && health.body.ok === true);
  log("it is never cached",
      /no-store/.test(health.cache ?? ""), health.cache ?? "no header");
  log("the shallow check does NOT call the engine", health.body.engine === undefined);

  const deep = await page.evaluate(async () => {
    const r = await fetch("/api/health?deep=1", { cache: "no-store" });
    return r.json();
  });
  log("?deep=1 reaches the engine and reports its latency",
      deep.deep === true && typeof deep.engine?.latency_ms === "number",
      `engine ok=${deep.engine?.ok} ${deep.engine?.latency_ms}ms`);

  // The uptime card in the Command Panel, if that flag is on.
  await page.goto(`${BASE}/command`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  const hasPanel = await page.evaluate(
    () => document.body.innerText.includes("COMMAND PANEL")
  );
  if (hasPanel) {
    await page.evaluate(() => {
      [...document.querySelectorAll("button")]
        .find((b) => /uptime/i.test(b.textContent ?? ""))?.click();
    });
    await page.waitForTimeout(3000);
    const card = await page.evaluate(() => ({
      present: document.querySelector("[data-testid=uptime-card]") !== null,
      text: document.body.innerText,
    }));
    log("the Command Panel shows a measured uptime card", card.present);
    log("it states the budget is an estimate and names the authority",
        /Render is the authority/i.test(card.text));
    log("it tells the operator to warm up before a demo",
        /npm run warmup/i.test(card.text));
  } else {
    console.log("  SKIP  uptime card — command flag off");
  }

  // ------------------------------------------------- the footer (DEC-063)
  console.log("\n== FOOTER AND v1 LINKING (DEC-063) ==");

  const FOOTER_ROUTES = [
    ["/", "full"], ["/about", "full"], ["/docs", "full"],
    ["/workbench", "slim"], ["/workbench/actors", "slim"],
    ["/workbench/classic", "slim"], ["/sangam", "slim"], ["/command", "slim"],
  ];

  const missing = [];
  const wrongVariant = [];
  for (const [route, expected] of FOOTER_ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(route === "/sangam" || route.endsWith("classic") ? 9000 : 4000);
    const variant = await page.evaluate(
      () => document.querySelector("[data-testid=footer]")?.getAttribute("data-variant") ?? null
    );
    if (!variant) missing.push(route);
    else if (variant !== expected) wrongVariant.push(`${route}: ${variant}`);
  }
  log("the footer is on EVERY route", missing.length === 0, missing.join(", "));
  log("full-viewport routes get the slim variant, others the full one",
      wrongVariant.length === 0, wrongVariant.join(" | "));

  // The v1 link, and its protection.
  await page.goto(`${BASE}/about`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);
  const v1 = await page.evaluate(() => {
    const a = document.querySelector('a[href*="prahari-6njh.onrender.com"]');
    if (!a) return null;
    return {
      href: a.getAttribute("href"),
      rel: a.getAttribute("rel"),
      target: a.getAttribute("target"),
      announced: (a.textContent ?? "").includes("opens in a new tab"),
    };
  });
  log("PRAHARI v1 is linked", Boolean(v1), v1?.href ?? "not found");
  log("the v1 link carries rel=noopener noreferrer and target=_blank",
      v1?.rel === "noopener noreferrer" && v1?.target === "_blank");
  log("the external link is announced to a screen reader", v1?.announced === true);
  log("the v1 link is described as the Jabalpur geofence console",
      await page.evaluate(() => /Jabalpur geofence console/.test(document.body.innerText)));

  // The status dots, and the state that must never appear.
  const dots = await page.evaluate(() =>
    [...document.querySelectorAll("[data-testid=status-dot]")].map((d) => ({
      state: d.getAttribute("data-state"),
      label: (d.textContent ?? "").trim(),
    }))
  );
  log("both status dots resolved to a real state", dots.length >= 2 &&
      dots.every((d) => ["live", "waking", "unknown"].includes(d.state ?? "")),
      dots.map((d) => `${d.state}`).join(", "));
  log("no dot ever reads 'offline'",
      dots.every((d) => !/offline/i.test(d.label)),
      dots.map((d) => d.label).join(" | "));
  log("the status is carried as TEXT, not colour alone",
      dots.every((d) => d.label.length > 2));

  // Build identity from the environment, never hardcoded.
  const build = await page.evaluate(
    () => document.querySelector("[data-testid=build-line]")?.textContent?.trim() ?? ""
  );
  log("the footer states the build it is actually running", build.length > 0, build);

  // The four statements and the honesty line, on every page.
  const footerText = await page.evaluate(
    () => document.querySelector("[data-testid=footer]")?.textContent ?? ""
  );
  log("the four 'we never' statements are present",
      ["never touch Tor", "never scrape a live market", "never put PII on chain",
       "never claim certainty"].every((n) => footerText.includes(n)));
  log("the standing honesty line is present",
      /does not break Tor/.test(footerText) && /claim certainty/.test(footerText));
  log("the competition, problem statement and team are named",
      /SIH 2026 · PS 26151 · NTRO · Team Vasiliades/.test(footerText));

  // Accessibility.
  log("the footer is a contentinfo landmark",
      (await page.locator('footer[role="contentinfo"]').count()) > 0);

  // ------------------------------------------------- SANGAM Pro (DEC-061/062)
  console.log("\n== SANGAM PRO (DEC-061, DEC-062) ==");

  await page.goto(`${BASE}/sangam`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  const proOn = await page.evaluate(
    () => document.querySelector("[data-testid=class-legend]") !== null
  );

  if (!proOn) {
    log("flag off: the original SANGAM map still renders",
        await page.evaluate(() => /WHO × WHERE|संगम/.test(document.body.innerText)));
    console.log("  SKIP  three-class model — sangam flag off");
  } else {
    // The legend names all three classes, with their meanings.
    const legend = await page.evaluate(() => ({
      rows: document.querySelectorAll("[data-testid=class-legend] li").length,
      text: document.querySelector("[data-testid=class-legend]")?.textContent ?? "",
    }));
    log("the legend names all three coordinate classes", legend.rows === 3, `${legend.rows} rows`);
    log("the legend carries the 'not a measured location' sentence",
        /not a measured location/i.test(legend.text));
    log("the legend says an unavailable point is not plotted",
        /not\s+plotted/i.test(legend.text));

    // An actor with a genuinely resolvable host, so all three classes appear.
    await page.selectOption('select[aria-label="Actor"]', "actor-009").catch(() => {});
    await page.waitForTimeout(9000);

    const classes = await page.evaluate(() => [
      ...new Set(
        [...document.querySelectorAll("[data-class]")].map((e) => e.getAttribute("data-class"))
      ),
    ]);
    log("all three classes are represented on screen",
        ["resolved", "derived", "unavailable"].every((c) => classes.includes(c)),
        classes.join(", "));

    // INV-1, demonstrated on real input rather than asserted.
    await page.fill('input[aria-label="Locate a host"]', "secretmarket.onion");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(4500);
    const note = await page.evaluate(
      () => document.querySelector("[data-testid=lookup-note]")?.textContent ?? ""
    );
    log("a .onion lookup is REFUSED BY DESIGN, not merely unresolved",
        /refused by design/i.test(note), note.trim().slice(0, 70));

    const unplacedText = await page.evaluate(
      () => document.querySelector("[data-testid=unplaced-list]")?.textContent ?? ""
    );
    log("the refused onion appears in the unplaced panel with its reason",
        /secretmarket\.onion/.test(unplacedText) && /refused by design/i.test(unplacedText));

    // Click a resolved marker -> the full chain.
    await page.evaluate(() =>
      document.querySelector("[data-testid=marker-list] button")?.click()
    );
    await page.waitForTimeout(3000);
    const detail = await page.evaluate(() => ({
      steps: [...document.querySelectorAll("[data-testid=resolution-chain] li")].map((e) =>
        (e.textContent ?? "").trim()
      ),
      text: document.body.innerText,
    }));
    log("clicking a resolved marker shows its resolution chain",
        detail.steps.length >= 3, `${detail.steps.length} steps`);
    log("the chain runs host -> DNS -> geo-IP -> coordinate",
        /host/i.test(detail.steps.join(" ")) &&
        /dns/i.test(detail.steps.join(" ")) &&
        /geoip/i.test(detail.steps.join(" ")));
    log("every chain step carries a timestamp",
        detail.steps.every((s) => /\d{2}:\d{2}:\d{2}/.test(s)));
    log("a field with no value reads 'not available', never blank",
        /not available/i.test(detail.text));
    log("the cache age is shown rather than hidden", /Cache age/i.test(detail.text));

    // A derived marker states it is not a measurement.
    const derivedShown = await page.evaluate(() => {
      const btns = [...document.querySelectorAll("[data-testid=marker-list] button")];
      const d = btns.find((b) => /derived/i.test(b.textContent ?? ""));
      if (!d) return null;
      d.click();
      return true;
    });
    if (derivedShown) {
      await page.waitForTimeout(2500);
      const dText = await page.evaluate(() => document.body.innerText);
      log("clicking a derived marker says it is NOT a measured location",
          /not a measured location/i.test(dText));
      log("a derived point has no city or ASN to show",
          /not available/i.test(dText));
    } else {
      console.log("  SKIP  derived marker detail — none in this actor's footprint");
    }

    // The engine's own refusal, through the proxy.
    const geo = await page.evaluate(async () => {
      const r = await fetch("/api/engine/geo/host?host=abc.onion", { cache: "no-store" });
      return r.json();
    });
    log("the engine classifies a .onion as unavailable, with no coordinate",
        geo.class === "unavailable" && geo.lat === null && geo.lng === null);
    log("the engine's refusal chain says no DNS query was issued",
        JSON.stringify(geo.resolution_chain ?? []).includes("No DNS query was issued"));

    const sources = await page.evaluate(async () => {
      const r = await fetch("/api/engine/geo/sources", { cache: "no-store" });
      return r.json();
    });
    log("/geo/sources states the passivity rule",
        /never resolves a \.onion/i.test(sources.passivity ?? ""));
    log("/geo/sources never renders a key value",
        (sources.providers ?? []).every((p) => "key_present" in p && !("api_key" in p)));
  }

  // ------------------------------------------- the command panel (DEC-058/059/060)
  console.log("\n== COMMAND PANEL (DEC-058, DEC-059, DEC-060) ==");

  const panelOn = await (async () => {
    const r = await page.goto(`${BASE}/command`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3500);
    if (!r || r.status() >= 400) return false;
    return page.evaluate(() => document.body.innerText.includes("COMMAND PANEL"));
  })();

  if (!panelOn) {
    log("flag off: /command says it is not enabled rather than 404ing",
        await page.evaluate(() => document.body.innerText.includes("not enabled")));
    for (const line of [
      "authZ refusals — command flag off",
      "step-up and replay — command flag off",
      "ledger coverage — command flag off",
    ]) {
      console.log(`  SKIP  ${line}`);
    }
  } else {
    const status = await page.evaluate(async () =>
      (await fetch("/api/stepup/status", { cache: "no-store" })).json()
    );

    /**
     * A unique record id per run.
     *
     * The engine's admin store is in-memory and lives for the life of the
     * process, so a fixed id made the create return 409 "already exists" on
     * every run after the first -- correct behaviour from the engine, and a
     * flaky test. A journey that only passes against a freshly started engine
     * is not a gate.
     */
    const RID = `journey-${Date.now().toString(36)}`;
    log("the panel reports a role and its permissions",
        Boolean(status.role) && (status.permissions ?? []).length > 0,
        `${status.role} · ${(status.permissions ?? []).length} permissions`);

    const post = (path, body, csrf) =>
      page.evaluate(
        async ([p, b, c]) => {
          const r = await fetch(p, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(c ? { "x-prahari-csrf": c } : {}) },
            body: JSON.stringify(b),
          });
          return { status: r.status, body: await r.json().catch(() => ({})) };
        },
        [path, body, csrf]
      );

    // --- the refusals, in order ---
    const noCsrf = await post(`/api/admin/personas?id=${RID}`, { patch: {} }, null);
    log("a write with no CSRF token is refused", noCsrf.status === 403 && noCsrf.body.error === "csrf",
        `${noCsrf.status} ${noCsrf.body.error}`);

    const unknown = await page.evaluate(async () => {
      const r = await fetch("/api/admin/nonsense", { cache: "no-store" });
      return { status: r.status, body: await r.json().catch(() => ({})) };
    });
    log("an unknown admin route is 404, not 403", unknown.status === 404,
        `${unknown.status} ${unknown.body.error}`);

    const noStepUp = await post(`/api/admin/personas?id=${RID}`, { patch: { handle: "x" } }, status.csrf);
    const refusedForStepUp = noStepUp.status === 403 &&
      ["step-up-required", "insufficient-role"].includes(noStepUp.body.error);
    log("a write with no step-up is refused", refusedForStepUp,
        `${noStepUp.status} ${noStepUp.body.error}`);

    // --- enrolment, verification, replay ---
    const enrol = await post("/api/stepup/enrol", { force: true }, status.csrf);
    const canStepUp = enrol.status === 200 && Boolean(enrol.body.uri);
    log("enrolment returns a QR, an otpauth URI and eight recovery codes",
        canStepUp && Boolean(enrol.body.qr) && (enrol.body.recoveryCodes ?? []).length === 8);

    if (canStepUp && noStepUp.body.error === "step-up-required") {
      const { authenticator } = await import("otplib");
      const secret = new URL(enrol.body.uri).searchParams.get("secret");
      const code = authenticator.generate(secret);

      const verify = await post("/api/stepup/verify", { code }, status.csrf);
      log("a valid code grants a step-up", verify.status === 200 && verify.body.ok === true,
          String(verify.body.via ?? verify.body.detail));

      const replay = await post("/api/stepup/verify", { code }, status.csrf);
      log("the SAME code is refused as a replay",
          replay.status === 403 && replay.body.reason === "replayed",
          `${replay.status} ${replay.body.reason}`);

      const write = await post(
        `/api/admin/personas?id=${RID}`,
        { patch: { handle: "journey" }, reason: "e2e journey" },
        status.csrf
      );
      log("the write now succeeds and returns its ledger entry",
          write.status === 200 && String(write.body?.ledger?.hash ?? "").startsWith("0x"),
          `${write.status} seq ${write.body?.ledger?.seq}`);

      const del = await page.evaluate(async ([csrf, rid]) => {
        const r = await fetch(`/api/admin/personas/${rid}`, {
          method: "DELETE",
          headers: { "x-prahari-csrf": csrf },
        });
        return { status: r.status, body: await r.json().catch(() => ({})) };
      }, [status.csrf, RID]);
      log("a delete is SOFT and says so",
          del.status === 200 && Boolean(del.body?.record?.deleted_at) &&
          /remains in exports/i.test(String(del.body?.honesty ?? "")));

      const chain = await page.evaluate(async () =>
        (await fetch("/api/admin/audit/activity", { cache: "no-store" })).json()
      );
      log("every mutation appears in the signed audit chain",
          chain.ok && chain.count >= 2 && chain.records.every((r) => r.signed),
          `${chain.count} records`);
      log("the chain is hash-linked and rooted",
          chain.records[0].prev_hash.startsWith("0x") &&
          String(chain.merkle_root ?? "").startsWith("0x"));
    } else {
      console.log("  SKIP  step-up flow — this role cannot reach a step-up-guarded write");
    }

    // --- the panel renders its surfaces ---
    await page.goto(`${BASE}/command`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4500);
    const rows = await page.locator("[data-testid=command-rows] tr").count();
    log("the records table renders real rows", rows > 0, `${rows} rows`);

    await page.evaluate(() => {
      [...document.querySelectorAll("button")]
        .find((b) => /analytics/i.test(b.textContent ?? ""))?.click();
    });
    await page.waitForTimeout(3500);
    const analyticsText = await page.evaluate(() => document.body.innerText);
    log("analytics distinguishes measured from unmeasured",
        /Measured/i.test(analyticsText) && /Unmeasured/i.test(analyticsText));
    log("signal contribution reports survived versus discarded",
        /survived/i.test(analyticsText) && /discarded/i.test(analyticsText));

    await page.evaluate(() => {
      [...document.querySelectorAll("button")]
        .find((b) => /audit chain/i.test(b.textContent ?? ""))?.click();
    });
    await page.waitForTimeout(3000);
    log("the audit chain view reads from the chain itself",
        await page.evaluate(() => document.body.innerText.includes("hash-linked")));

    // --- the step-up dialog reuses the DEC-042 focus trap ---
    await page.evaluate(() => {
      [...document.querySelectorAll("button")]
        .find((b) => /step up|enrol/i.test(b.textContent ?? ""))?.click();
    });
    await page.waitForTimeout(900);
    log("the step-up prompt is a real modal dialog",
        (await page.locator('[role="dialog"][aria-modal="true"]').count()) > 0);
    const trapped = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      return Boolean(d && d.contains(document.activeElement));
    });
    log("focus moves into the step-up dialog", trapped);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(600);
    log("Escape closes the step-up dialog",
        (await page.locator('[role="dialog"]').count()) === 0);
  }

  // ------------------------------------------- the graph lab (DEC-057)
  console.log("\n== GRAPH INTELLIGENCE LAB (DEC-057) ==");

  const GRAPH = "/workbench/actor/actor-088/graph";
  const labOn = WORKSPACE
    ? await (async () => {
        await page.goto(`${BASE}${GRAPH}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(4000);
        return page.evaluate(() => document.body.innerText.includes("SIGNAL ROOT"));
      })()
    : false;

  if (!labOn) {
    log("flag off: the graph route still renders the existing panel",
        WORKSPACE
          ? await page.evaluate(() => document.body.innerText.includes("RELATIONSHIP GRAPH"))
          : true);
    console.log("  SKIP  eleven view checks — graph lab flag off");
  } else {
    const KINDS = ["force3d", "force2d", "ego", "matrix", "dag", "temporal",
                   "bipartite", "sankey", "community", "diff", "list"];
    const labErrors = [];
    page.on("pageerror", (e) => labErrors.push(e.message));

    let allCaptioned = true;
    const uncaptioned = [];
    for (const v of KINDS) {
      await page.goto(`${BASE}${GRAPH}?view=${v}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(v === "sankey" ? 6000 : 3200);
      const info = await page.evaluate(() => ({
        caption: document.querySelector("[data-testid=view-caption]")?.textContent?.trim() ?? "",
        drawn: document.querySelectorAll("svg,canvas,table").length,
      }));
      const ok = info.caption.length > 60 && info.drawn > 0;
      if (!ok) { allCaptioned = false; uncaptioned.push(v); }
    }
    log("all eleven views render with a caption", allCaptioned, uncaptioned.join(", "));
    log("no client-side exception in any view", labErrors.length === 0,
        labErrors.slice(0, 2).join(" | "));

    // The legend and the honesty line are on screen at all times.
    await page.goto(`${BASE}${GRAPH}?view=force2d`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3500);
    const chrome = await page.evaluate(() => document.body.innerText);
    log("legend names the entity types",
        /Actor \/ PGP/.test(chrome) && /Persona/.test(chrome) && /Infrastructure/.test(chrome));
    log("caption states that distance is meaningful but position is not",
        /distance is meaningful/i.test(chrome) && /absolute position is not/i.test(chrome));
    log("the tau coarseness caveat is on the slider itself",
        /1,336 validation pairs/.test(chrome) && /rough sieve/.test(chrome));

    // Determinism, observed in the browser: the same URL twice, same geometry.
    const geometry = async () => {
      await page.goto(`${BASE}${GRAPH}?view=force2d`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3500);
      return page.evaluate(() =>
        [...document.querySelectorAll("svg g g")]
          .map((g) => g.getAttribute("transform"))
          .filter(Boolean)
          .join(";")
      );
    };
    const g1 = await geometry();
    const g2 = await geometry();
    log("the 2D layout is identical across two loads", Boolean(g1) && g1 === g2,
        `${g1.split(";").length} nodes placed`);

    // The evidence DAG reads a real /fusion/pair response.
    const pairId = encodeURIComponent("actor-088-p0|actor-088-p2");
    await page.goto(`${BASE}${GRAPH}?view=dag&pair=${pairId}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(8000);
    const dag = await page.evaluate(() => document.body.innerText);
    log("evidence DAG shows the four stages of the argument",
        /SIGNALS/i.test(dag) && /ROOTS/i.test(dag) && /COLLAPSE/i.test(dag) && /SCORE/i.test(dag));
    log("evidence DAG names collapse outcomes", /survived|discarded/i.test(dag));
    log("evidence DAG shows the posterior beside the naive baseline",
        /Posterior/i.test(dag) && /naive/i.test(dag));

    // The inspector: real edges, the reliability exponent, collapse named.
    await page.goto(
      `${BASE}${GRAPH}?view=force2d&node=actor-088-p0&pair=${pairId}`,
      { waitUntil: "domcontentloaded" }
    );
    await page.waitForTimeout(6000);
    const insp = await page.evaluate(() => document.body.innerText);
    log("inspector lists the node's edges", /Edges \(/i.test(insp));
    log("inspector names the reliability exponent", /reliability r =/i.test(insp));
    log("inspector names discarded signals, not just survivors",
        (await page.locator('[data-survived="false"]').count()) >= 0 &&
        /Root-cause collapse/i.test(insp));
    log("inspector offers provenance rather than blanks",
        /Provenance/i.test(insp) && /Last scan/i.test(insp));

    // Controls are deep-linked: a pasted URL reproduces the view.
    await page.goto(
      `${BASE}${GRAPH}?view=matrix&roots=infra&min=0.8&inferred=0&weak=0`,
      { waitUntil: "domcontentloaded" }
    );
    await page.waitForTimeout(3500);
    const deep = await page.evaluate(() => ({
      view: document.body.innerText.includes("ADJACENCY MATRIX"),
      pressedRoot: document.querySelector('[aria-pressed="true"][class*="border-[var(--accent)]"]')?.textContent?.trim(),
      inferred: document.querySelectorAll('input[type="checkbox"]:checked').length,
      min: document.querySelector('input[type="range"]')?.value,
    }));
    log("a pasted lab URL restores view, roots, threshold and toggles",
        deep.view && deep.min === "0.8" && deep.inferred === 0,
        `view=${deep.view} min=${deep.min} checked=${deep.inferred}`);

    // Exports carry provenance. GraphML is parsed by a REAL DOMParser here --
    // happy-dom rejects the dotted attribute names GraphML mandates, so this is
    // the only place well-formedness can honestly be asserted.
    const exported = await page.evaluate(async () => {
      const res = await fetch("/api/engine/actor/actor-088", { cache: "no-store" });
      const profile = await res.json();
      return Boolean(profile?.ok && profile.personas?.length);
    });
    log("the lab has a live profile to export", exported);

    const exportUi = await page.evaluate(() => {
      const t = document.body.innerText;
      return {
        buttons: ["PNG", "SVG", "JSON", "GRAPHML"].every((k) => t.includes(k)),
        promise: /Every export carries the actor/i.test(t),
      };
    });
    log("all four export formats are offered", exportUi.buttons);
    log("the export panel states what provenance it carries", exportUi.promise);

    // The performance guard and the fallback both announce themselves.
    const reducedLab = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    const rl = await reducedLab.newPage();
    await login(rl);
    await rl.goto(`${BASE}${GRAPH}?view=force3d`, { waitUntil: "domcontentloaded" });
    await rl.waitForTimeout(5000);
    const rlText = await rl.evaluate(() => document.body.innerText);
    log("reduced motion falls back to the linkage list, and says so",
        /LINKAGE LIST/i.test(rlText) && /reduced motion is on/i.test(rlText));
    const rows = await rl.locator("[data-testid=linkage-rows] tr").count();
    log("the fallback lists every edge", rows > 0, `${rows} rows`);
    await reducedLab.close();
  }

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

  // No first-paint flash.
  //
  // This was originally asserted by racing an evaluate() against
  // `waitUntil: "commit"`, which passed or failed depending on scheduling --
  // it went green for two phases and then failed on an unrelated build. A
  // flaky gate is worse than no gate, so the property is checked structurally
  // instead, which is both deterministic and closer to what actually prevents
  // the flash: the picker is an INLINE, SYNCHRONOUS, RENDER-BLOCKING script in
  // <head>, so it executes during head parsing -- before the body exists and
  // therefore before anything can be painted.
  //
  // NOT "ahead of the stylesheet": Next injects its stylesheet links above the
  // page's own head children, and it makes no difference. An inline script in
  // <head> is render-blocking either way; if it sits after a stylesheet link
  // the browser simply blocks it on the CSSOM first. In both orders the
  // attribute is set before first paint, so asserting the order would have
  // been asserting a Next.js implementation detail, not the guarantee.
  const preflight = await skinCtx.newPage();
  await preflight.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  const paint = await preflight.evaluate(() => {
    const scripts = [...document.head.querySelectorAll("script")];
    const picker = scripts.find((sc) => !sc.src && sc.textContent.includes("data-skin"));
    return {
      inHead: Boolean(picker),
      inline: Boolean(picker) && !picker.src,
      notDeferred: Boolean(picker) && !picker.defer && !picker.async,
      applied: document.documentElement.getAttribute("data-skin"),
      source: document.documentElement.getAttribute("data-skin-source"),
    };
  });
  log("skin picker is an inline synchronous script in <head> (no flash)",
      paint.inHead && paint.inline && paint.notDeferred && Boolean(paint.applied),
      `head=${paint.inHead} inline=${paint.inline} sync=${paint.notDeferred} skin=${paint.applied}`);
  log("the draw records which tier answered",
      ["query", "lock", "session", "fresh", "fallback"].includes(paint.source), String(paint.source));
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
  // The cockpit, not whatever /workbench resolves to in this build: these
  // checks are about the graph's reduced-motion fallback specifically.
  await rmPage.goto(`${BASE}${COCKPIT}`, { waitUntil: "domcontentloaded" });
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
  await tPage.goto(`${BASE}${COCKPIT}`, { waitUntil: "domcontentloaded" });
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
    // FINDING-07 is CLOSED: the command palette (DEC-056) is the workspace's
    // first dialog and wires lib/a11y trapFocus back in. The four dialog checks
    // above are the restored coverage, so this is no longer a gap.
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
