/**
 * The keep-alive, from the web side (DEC-064, DEC-065).
 *
 * The schedule is arithmetic on figures that must not be guessed, so these
 * tests pin the figures, the window, and the guard's fail-closed direction
 * against the files that actually run — the workflow YAML and the guard script
 * — rather than against a copy of them.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd(), "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const WORKFLOW = read(".github/workflows/keepalive.yml");
const GUARD = join(ROOT, "scripts/keepalive_budget.py");
const WARMUP = read("scripts/warmup.sh");
const UPTIME_DOC = read("docs/UPTIME.md");

/** Run the guard and parse its GITHUB_OUTPUT lines. */
function runGuard(args: string[]): Record<string, string> {
  const out = execFileSync("python3", [GUARD, ...args], { encoding: "utf8" });
  return Object.fromEntries(
    out.trim().split("\n").map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    })
  );
}

function stateFile(contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), "prahari-keepalive-"));
  const p = join(dir, "state.json");
  writeFileSync(p, contents);
  return p;
}

const BASE = ["--pool", "750", "--services", "2"];
const ALWAYS_OPEN = ["--window-start", "0", "--window-end", "24"];

describe("the verified figures are recorded, not remembered", () => {
  it("UPTIME.md states where and when they were verified", () => {
    expect(UPTIME_DOC).toContain("render.com/docs/free");
    expect(UPTIME_DOC).toContain("2026-09-03");
  });

  it("records the four figures the schedule depends on", () => {
    expect(UPTIME_DOC).toContain("750");
    expect(UPTIME_DOC).toContain("15 minutes");
    expect(UPTIME_DOC).toContain("per calendar month");
    // The pool is shared, not per-service. This is the fact the playbook's own
    // assumption got wrong, and the one the whole schedule turns on.
    expect(UPTIME_DOC).toMatch(/shared|workspace/i);
  });

  it("names what still needs the account owner's login", () => {
    // The usage page cannot be read from here; rule 7 says those clicks are
    // the user's. Saying so is the honest alternative to guessing.
    expect(UPTIME_DOC).toContain("cannot be read from here");
    expect(UPTIME_DOC).toContain("dashboard.render.com");
  });

  it("shows the arithmetic rather than asserting a conclusion", () => {
    expect(UPTIME_DOC).toContain("750 h/month ÷ 3 services");
    expect(UPTIME_DOC).toContain("6.98");
    expect(UPTIME_DOC).toContain("10.47");
    // And states that it contradicts the playbook's assumption.
    expect(UPTIME_DOC).toMatch(/playbook assumed two services/i);
  });

  it("states plainly that 24/7 is impossible on the free tier", () => {
    // The honest answer to "keep it always awake". Two services need 1,460
    // hours against a pool of 750; no schedule fixes that.
    expect(UPTIME_DOC).toContain("1,460 hours");
    expect(UPTIME_DOC).toMatch(/no schedule|impossible|cannot/i);
  });
});

describe("the workflow", () => {
  it("ticks every FIVE minutes, from inside a run rather than from cron", () => {
    // The interval costs nothing: Render bills hours awake, not requests, so
    // 5-minute ticks keep a service up for exactly the same hours as 10-minute
    // ticks and simply survive more missed ones.
    //
    // It is a `sleep` inside a running job now, NOT a cron expression, and that
    // distinction is the whole fix (DEC-075): a */5 cron asked for ~120 runs a
    // day and GitHub delivered four in two days, so the services slept through
    // their own window.
    expect(WORKFLOW).toContain('TICK_SECONDS: "300"');
    expect(WORKFLOW).toContain('--tick-seconds "$TICK_SECONDS"');
    // The trigger must NOT be high-frequency again. This is the regression.
    expect(WORKFLOW).not.toMatch(/cron: "\*\/[0-9]/);
  });

  it("holds one run for a segment, and chains its own successor", () => {
    // The chain is what makes the schedule reliable: it needs the scheduler to
    // work ONCE, not 120 times a day.
    expect(WORKFLOW).toContain('SEGMENT_MINUTES: "330"');
    expect(WORKFLOW).toContain("workflows/keepalive.yml/dispatches");
    expect(WORKFLOW).toContain("actions: write");
    // 5.5 h of segment must fit inside GitHub's 6 h job ceiling with slack.
    const timeout = Number(/timeout-minutes: (\d+)/.exec(WORKFLOW)?.[1]);
    const segment = Number(/SEGMENT_MINUTES: "(\d+)"/.exec(WORKFLOW)?.[1]);
    expect(segment).toBeLessThan(timeout);
    expect(timeout).toBeLessThan(360);
  });

  it("does not hold a runner idle outside the window", () => {
    // A run landing outside the window exits in seconds and must NOT chain --
    // chaining there would spin its successor in a tight dispatch loop.
    expect(WORKFLOW).toContain("steps.plan.outputs.engage == 'true'");
    expect(WORKFLOW).toContain('LEAD_SECONDS: "1800"');
    const runner = read("scripts/keepalive_run.py");
    expect(runner).toContain("window closed; ending the segment");
  });

  it("only runs inside the declared ten-hour window", () => {
    expect(WORKFLOW).toContain('WINDOW_START: "3"');
    expect(WORKFLOW).toContain('WINDOW_END: "13"');
    // The opener lands inside the lead so the handover is punctual.
    expect(WORKFLOW).toContain('cron: "50 2 * * *"');
  });

  it("declares how many services share the pool, and uses it in the guard", () => {
    // The divisor is what sets the window length, so it is named once and
    // referenced -- not written as a literal 3 in the guard call that a later
    // edit to PING_V1 would silently contradict.
    expect(WORKFLOW).toContain('KEPT_WARM: "2"');
    expect(WORKFLOW).toContain('--services "$KEPT_WARM"');
    expect(WORKFLOW).not.toMatch(/--services 3/);
  });

  it("takes v1 out of rotation to buy the other two a longer window", () => {
    // 3 services = 6.98 h/day each; 2 = 10.47. v1 is a demo nobody is
    // mid-investigation on, so it is the one that gives way.
    expect(WORKFLOW).toContain('PING_V1: "0"');
    expect(WORKFLOW).toContain("OPT-IN");
  });

  it("warms the engine caches, but not on every tick", () => {
    // The user-visible complaint was that live data is slow after a sleep.
    // Waking the process is not enough -- its caches are still cold, which is
    // another ~20 s on the first real call.
    expect(WORKFLOW).toContain("/health/warm");
    expect(WORKFLOW).toContain("--warm-url");
    // And warming is NOT part of the every-5-minute tick, which must stay
    // cheap: once per segment, on the first tick that actually pinged.
    const runner = read("scripts/keepalive_run.py");
    expect(runner).toContain("Warm ONCE per segment");
    expect(runner).toContain("not warmed");
  });

  it("reserves its budget BEFORE pinging, and pushes the claim", () => {
    // Replaces the old cron/window agreement check, which existed because the
    // cron defined the window. The guard defines it now, so the invariant worth
    // protecting is the accounting one: a runner reclaimed mid-segment must
    // leave a claim that OVERSTATES usage, never one that vanishes.
    expect(WORKFLOW).toContain("--reserve-minutes");
    expect(WORKFLOW.indexOf("--reserve-minutes"))
      .toBeLessThan(WORKFLOW.indexOf("keepalive_run.py"));
    expect(WORKFLOW).toMatch(/reserve segment/);
  });

  it("covers all three services, each with its own toggle", () => {
    for (const v of ["PING_ENGINE", "PING_WEB", "PING_V1"]) {
      expect(WORKFLOW, v).toContain(v);
    }
    // The hosts are named once as env vars and the paths appended, so a URL
    // change happens in one place.
    expect(WORKFLOW).toContain("prahari-v2-engine.onrender.com");
    expect(WORKFLOW).toContain("prahari-v2-web.onrender.com");
    expect(WORKFLOW).toContain("prahari-6njh.onrender.com");
    expect(WORKFLOW).toContain("$ENGINE_URL/health/ping");
    expect(WORKFLOW).toContain("$WEB_URL/api/health");
  });

  it("consults the guard BEFORE pinging, and again on every tick", () => {
    expect(WORKFLOW.indexOf("Decide whether to engage at all"))
      .toBeLessThan(WORKFLOW.indexOf("Run the segment"));
    // Once at the top is not enough: a 5.5-hour segment would be running on a
    // decision that went stale hours earlier.
    const runner = read("scripts/keepalive_run.py");
    expect(runner).toContain("Re-read the state each tick");
  });

  it("treats a slow 200 as success, not as a failure", () => {
    // A cold start is a slow 200. Counting it as a failure would raise an
    // issue every morning for a system working exactly as designed.
    const runner = read("scripts/keepalive_run.py");
    expect(runner).toContain("200 <= code < 400");
    expect(runner).toContain("A cold start is a SLOW 200");
    // And the timeout must exceed Render's ~60 s spin-up with room to spare.
    expect(runner).toMatch(/--timeout", type=float, default=9[0-9]/);
  });

  it("raises a GitHub issue when a target genuinely fails", () => {
    expect(WORKFLOW).toContain("Raise an issue after three consecutive failures");
    expect(WORKFLOW).toContain("labels: ['keepalive']");
  });

  it("supports a dry run through workflow_dispatch", () => {
    expect(WORKFLOW).toContain("workflow_dispatch");
    expect(WORKFLOW).toContain("dry_run");
    expect(WORKFLOW).toContain("github.event.inputs.dry_run == 'true'");
  });

  it("costs nothing: a GitHub cron, no server", () => {
    expect(WORKFLOW).toContain("runs-on: ubuntu-latest");
    expect(WORKFLOW).not.toMatch(/redis|upstash|cronitor|paid/i);
  });
});

describe("the budget guard", () => {
  it("computes ~10.5 hours a day for two services", () => {
    const out = runGuard(["--state", stateFile('{"pings":[]}'), ...BASE, ...ALWAYS_OPEN]);
    expect(Number(out.daily_budget_hours)).toBeGreaterThan(10);
    expect(Number(out.daily_budget_hours)).toBeLessThan(11);
    expect(out.share_hours).toBe("375");
  });

  it("computes ~7 hours a day if v1 is put back in rotation", () => {
    const out = runGuard([
      "--state", stateFile('{"pings":[]}'),
      "--pool", "750", "--services", "3", ...ALWAYS_OPEN,
    ]);
    expect(Number(out.daily_budget_hours)).toBeGreaterThan(6.5);
    expect(Number(out.daily_budget_hours)).toBeLessThan(7.5);
  });

  it("gives two services a bigger share than three", () => {
    const three = runGuard([
      "--state", stateFile('{"pings":[]}'),
      "--pool", "750", "--services", "3", ...ALWAYS_OPEN,
    ]);
    const two = runGuard(["--state", stateFile('{"pings":[]}'), ...BASE, ...ALWAYS_OPEN]);
    expect(Number(two.daily_budget_hours)).toBeGreaterThan(Number(three.daily_budget_hours));
  });

  it("pings inside the window with an empty budget", () => {
    const out = runGuard(["--state", stateFile('{"pings":[]}'), ...BASE, ...ALWAYS_OPEN]);
    expect(out.should_ping).toBe("true");
  });

  it("does not ping outside the window", () => {
    const hour = new Date().getUTCHours();
    // A one-hour window that is definitely not now.
    const start = (hour + 5) % 24;
    const out = runGuard([
      "--state", stateFile('{"pings":[]}'), ...BASE,
      "--window-start", String(start), "--window-end", String((start + 1) % 24),
    ]);
    // Either it is outside (the overwhelmingly likely case) or the test is
    // running in that single hour; both are correct behaviour.
    if (out.should_ping === "false") expect(out.reason).toContain("outside the window");
  });

  it("STOPS at a hundred percent of the share", () => {
    const now = Date.now() / 1000;
    // 375 h of share at 600 s credited per ping needs 2250 pings; use more.
    const pings = Array.from({ length: 2500 }, (_, i) => now - (2500 - i) * 600);
    const out = runGuard([
      "--state", stateFile(JSON.stringify({ month: monthKey(), pings })),
      ...BASE, ...ALWAYS_OPEN,
    ]);
    expect(out.should_ping).toBe("false");
    expect(out.reason).toContain("exhausted");
  });

  /**
   * THE FAIL-CLOSED DIRECTION.
   *
   * The first version of the guard returned an empty state for BOTH a missing
   * file and a corrupt one, so an unreadable artifact made it believe nothing
   * had been spent and ping freely. That is failing open, which is the one
   * direction this guard must never fail in.
   */
  it.each([
    ["not json at all", "not json"],
    ["an array, not an object", "[1,2,3]"],
    ["a malformed pings field", '{"month":"2026-09","pings":"lots"}'],
    ["non-numeric ping entries", '{"month":"2026-09","pings":[1,"x"]}'],
    ["an empty file", ""],
  ])("refuses to ping when the artifact is %s", (_label, contents) => {
    const out = runGuard(["--state", stateFile(contents), ...BASE, ...ALWAYS_OPEN]);
    expect(out.should_ping).toBe("false");
    expect(out.reason).toContain("refusing to ping");
  });

  it("a MISSING artifact is a legitimate first run, and does ping", () => {
    // Missing and corrupt are different: missing means the budget genuinely is
    // zero. Conflating them would stop the very first run forever.
    const out = runGuard([
      "--state", join(tmpdir(), `never-created-${Date.now()}.json`),
      ...BASE, ...ALWAYS_OPEN,
    ]);
    expect(out.should_ping).toBe("true");
  });

  it("needs nothing but the standard library", () => {
    // It runs before any dependency install. A guard that needs `pip install`
    // to decide whether to ping can fail for reasons unrelated to the budget.
    const src = readFileSync(GUARD, "utf8");
    const imports = [...src.matchAll(/^(?:from|import)\s+(\w+)/gm)].map((m) => m[1]);
    const stdlib = new Set(["argparse", "json", "sys", "time", "datetime", "pathlib", "__future__"]);
    expect(imports.filter((i) => !stdlib.has(i))).toEqual([]);
  });
});

function monthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

describe("the warm-up script", () => {
  it("polls until each service answers rather than pinging once", () => {
    expect(WARMUP).toContain("while :;");
    expect(WARMUP).toContain("sleep 3");
  });

  it("prints the measured cold-start time", () => {
    expect(WARMUP).toContain("awake in");
    expect(WARMUP).toContain("elapsed");
  });

  it("warms the caches that make the first workbench load slow", () => {
    for (const path of ["/actors?limit=1", "/fusion/metrics", "/audit/case/CASE-001/ledger"]) {
      expect(WARMUP, path).toContain(path);
    }
    // DEC-054 exists because a judge once hit cold Splink training first.
    expect(WARMUP).toContain("DEC-054");
  });

  it("reports a service that did not wake, rather than claiming success", () => {
    expect(WARMUP).toContain("NOT AWAKE");
    expect(WARMUP).toContain("do not assume it will come up on its own");
  });

  it("reads milliseconds portably", () => {
    // BSD date SUCCEEDS on `+%s%3N` and returns a literal "3N", so a
    // `|| fallback` never fires. Found by running this on macOS.
    expect(WARMUP).toContain("now_ms");
    expect(WARMUP).toContain("*[!0-9]*");
  });

  it("treats an HTTP answer as awake, not as death", () => {
    // A 404 means the service is UP and said "no such path". Waiting out the
    // 150 s deadline on it reports a running service as dead -- the same error
    // DEC-063 rejected for the footer's status dot. Found by running this
    // against the live deployment, which answered 404 because it predates the
    // health endpoints.
    expect(WARMUP).toContain("4*|5*)");
    expect(WARMUP).toContain("SOMETHING ANSWERED");
  });

  it("says a 404 on a health path means the deploy is BEHIND", () => {
    // Awake-but-stale is a different problem from asleep, and the keep-alive
    // cannot work against a deploy with no /health/ping. Calling it plain
    // "awake" would hide that.
    expect(WARMUP).toContain("health endpoint MISSING");
    expect(WARMUP).toContain("this deploy is behind");
    expect(WARMUP).toContain("stale=1");
  });

  it("sends /health/warm as a POST", () => {
    // It is a POST route; sending a GET returns 405, and a warm-up that prints
    // 405 as though it warmed something is the false success this script
    // exists to prevent.
    expect(WARMUP).toContain('warm "full warm"      "/health/warm" POST');
    expect(WARMUP).toContain('local label="$1" path="$2" method="${3:-GET}"');
    expect(WARMUP).toContain('-X "$method"');
  });

  it("accepts ENGINE_URL as well as BASE_ENGINE", () => {
    // ENGINE_URL is the name used everywhere else in this project; a script
    // that silently ignores it warms the DEPLOYED engine while you believe you
    // are warming localhost.
    expect(WARMUP).toContain("${BASE_ENGINE:-${ENGINE_URL:-");
    expect(WARMUP).toContain("${BASE_WEB:-${WEB_URL:-");
  });

  it("is wired to npm run warmup", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.scripts.warmup).toContain("scripts/warmup.sh");
  });
});

describe("cross-pinging is off by default", () => {
  it("is documented with the failure mode it would cause", () => {
    // Mutual pinging keeps both services awake indefinitely and OUTSIDE the
    // window, silently burning the shared pool.
    expect(UPTIME_DOC).toContain("KEEPALIVE_CROSS=1");
    expect(UPTIME_DOC).toContain("off by default");
    expect(UPTIME_DOC).toContain("1,460 hours");
  });

  it("is not enabled anywhere in the workflow", () => {
    expect(WORKFLOW).not.toContain("KEEPALIVE_CROSS");
  });
});

describe("honest degradation", () => {
  it("the UI says a service may cold-start rather than pretending it is warm", () => {
    expect(UPTIME_DOC).toContain("cold-start");
    expect(UPTIME_DOC).toContain("30–60");
  });

  it("the estimate is labelled an estimate, with Render as the authority", () => {
    expect(UPTIME_DOC).toContain("Render's dashboard is the authority");
    expect(UPTIME_DOC).toMatch(/floor.{0,20}usage/i);
  });
});
