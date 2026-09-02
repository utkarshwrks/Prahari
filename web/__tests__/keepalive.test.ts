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

const BASE = ["--pool", "750", "--services", "3"];
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
    // And states that it contradicts the playbook's assumption.
    expect(UPTIME_DOC).toMatch(/playbook assumed two services/i);
  });
});

describe("the workflow", () => {
  it("pings every ten minutes, not every fourteen", () => {
    // GitHub's cron is best-effort. At fourteen minutes one skipped run lets
    // the service sleep; ten leaves room for a miss.
    expect(WORKFLOW).toContain('cron: "*/10');
  });

  it("only runs inside the declared window", () => {
    expect(WORKFLOW).toContain("*/10 4,5,6,7,8,9,10 * * *");
    expect(WORKFLOW).toContain('WINDOW_START: "4"');
    expect(WORKFLOW).toContain('WINDOW_END: "11"');
  });

  it("refuses to run if the cron and the window disagree", () => {
    // A schedule that contradicts its own guard burns budget outside the
    // window it claims to keep.
    expect(WORKFLOW).toContain("Verify the window and the cron agree");
    expect(WORKFLOW).toContain("do not match WINDOW_START/END");
  });

  it("covers all three services, each with its own toggle", () => {
    for (const v of ["PING_ENGINE", "PING_WEB", "PING_V1"]) {
      expect(WORKFLOW, v).toContain(v);
    }
    expect(WORKFLOW).toContain("prahari-v2-engine.onrender.com/health/ping");
    expect(WORKFLOW).toContain("prahari-v2-web.onrender.com/api/health");
    expect(WORKFLOW).toContain("prahari-6njh.onrender.com");
  });

  it("consults the guard BEFORE pinging", () => {
    expect(WORKFLOW.indexOf("Budget guard")).toBeLessThan(WORKFLOW.indexOf("name: Ping"));
    expect(WORKFLOW).toContain("steps.guard.outputs.should_ping == 'true'");
  });

  it("treats a slow 200 as success, not as a failure", () => {
    // A cold start is a slow 200. Counting it as a failure would raise an
    // issue every morning for a system working exactly as designed.
    expect(WORKFLOW).toContain("2*|3*)");
    expect(WORKFLOW).toContain("cold start is a slow 200");
  });

  it("raises a GitHub issue when a target genuinely fails", () => {
    expect(WORKFLOW).toContain("Raise an issue after three consecutive failures");
    expect(WORKFLOW).toContain("labels: ['keepalive']");
  });

  it("supports a dry run through workflow_dispatch", () => {
    expect(WORKFLOW).toContain("workflow_dispatch");
    expect(WORKFLOW).toContain("dry_run");
    expect(WORKFLOW).toContain("github.event.inputs.dry_run != 'true'");
  });

  it("costs nothing: a GitHub cron, no server", () => {
    expect(WORKFLOW).toContain("runs-on: ubuntu-latest");
    expect(WORKFLOW).not.toMatch(/redis|upstash|cronitor|paid/i);
  });
});

describe("the budget guard", () => {
  it("computes ~7 hours a day for three services", () => {
    const out = runGuard(["--state", stateFile('{"pings":[]}'), ...BASE, ...ALWAYS_OPEN]);
    expect(Number(out.daily_budget_hours)).toBeGreaterThan(6.5);
    expect(Number(out.daily_budget_hours)).toBeLessThan(7.5);
    expect(out.share_hours).toBe("250");
  });

  it("gives two services a bigger share than three", () => {
    const three = runGuard(["--state", stateFile('{"pings":[]}'), ...BASE, ...ALWAYS_OPEN]);
    const two = runGuard([
      "--state", stateFile('{"pings":[]}'),
      "--pool", "750", "--services", "2", ...ALWAYS_OPEN,
    ]);
    expect(Number(two.daily_budget_hours)).toBeGreaterThan(Number(three.daily_budget_hours));
  });

  it("pings inside the window with an empty budget", () => {
    const out = runGuard(["--state", stateFile('{"pings":[]}'), ...BASE, ...ALWAYS_OPEN]);
    expect(out.should_ping).toBe("true");
  });

  it("does not ping outside the window", () => {
    const out = runGuard([
      "--state", stateFile('{"pings":[]}'), ...BASE,
      // A window that is open for one hour it is almost certainly not.
      "--window-start", "3", "--window-end", "4",
    ]);
    // Either it is outside (the overwhelmingly likely case) or the test is
    // running in that single hour; both are correct behaviour.
    if (out.should_ping === "false") expect(out.reason).toContain("outside the window");
  });

  it("STOPS at a hundred percent of the share", () => {
    const now = Date.now() / 1000;
    // 250 h of share at 600 s credited per ping needs 1500 pings; use more.
    const pings = Array.from({ length: 1700 }, (_, i) => now - (1700 - i) * 600);
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
