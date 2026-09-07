/**
 * The login form's hydration gate.
 *
 * THE BUG. `LoginForm` submits through React's `onSubmit`. That handler does
 * not exist until the bundle has arrived and hydrated, but the button is a
 * real `type="submit"` inside a real `<form>` the whole time -- so a click
 * before hydration did a NATIVE GET submission back to /login. The page
 * reloaded, no error was rendered, and the user was returned to the login
 * screen with nothing to explain it.
 *
 * It never reproduced against a local dev server, where the bundle beats any
 * possible click. It reproduced on EVERY run against the deployed free-tier
 * instance, where it does not. The acceptance journey reported it as
 * `waitForURL: Timeout`, which reads as a broken harness rather than a broken
 * login -- the same disguise DEC-042 wore.
 *
 * These tests follow the DEC-042 pattern deliberately: happy-dom cannot prove
 * a hydration race, so they pin the two source-level facts that prevent it and
 * leave the behavioural proof to `e2e/journey.mjs`, which is the thing that
 * actually caught it.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(process.cwd(), "components/auth/LoginForm.tsx"), "utf8");

/**
 * The source with comments removed.
 *
 * The comment explaining the old wording necessarily quotes it, so a naive
 * "the old string is gone" assertion fails on the explanation rather than on
 * the bug. Stripping comments asserts what is actually RENDERED.
 */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const PAGE = readFileSync(join(process.cwd(), "app/login/page.tsx"), "utf8");

describe("LoginForm hydration gate", () => {
  it("tracks hydration with an effect, which only runs on the client", () => {
    expect(SRC).toMatch(/const \[ready, setReady\] = useState\(false\)/);
    expect(SRC).toMatch(/useEffect\(\(\) => setReady\(true\), \[\]\)/);
  });

  it("disables the submit button until hydrated", () => {
    // The regression itself: `disabled={busy}` alone is what shipped the bug.
    expect(SRC).toMatch(/disabled=\{busy \|\| !ready\}/);
    expect(SRC).not.toMatch(/disabled=\{busy\}/);
  });

  it("says it is loading rather than inviting a click that cannot work", () => {
    expect(SRC).toMatch(/!ready \? "Loading"/);
  });

  it("still prevents the default submit once hydrated", () => {
    // The gate is the second line of defence, not a replacement for this one.
    expect(SRC).toMatch(/e\.preventDefault\(\)/);
  });

  it("keeps the inputs unnamed, so a pre-hydration GET leaks no credentials", () => {
    /**
     * The native submission that used to happen serialised nothing, because
     * an input with no `name` is not included in form data. That is the only
     * reason a password never reached the query string -- and a URL is logged
     * by every proxy in the path, so this is worth pinning rather than
     * relying on nobody adding a `name` later.
     */
    const field = SRC.slice(SRC.indexOf("function Field"));
    expect(field).not.toMatch(/\bname=/);
  });
});

describe("the demo-account notice", () => {
  it("reports which state is actually in force", () => {
    /**
     * It read "Disabled entirely in production" unconditionally, which was
     * false on the deployment most likely to be read: the public demo runs
     * with ENABLE_DEMO_ACCOUNT=1, so the account whose password is printed
     * directly above that line is live.
     */
    expect(SRC).toMatch(/demoEnabled/);
    expect(SRC).toMatch(/Enabled for this public demo deployment/);
    expect(SRC).toMatch(/Disabled on this deployment/);
    expect(CODE).not.toMatch(/Disabled entirely in production/);
  });

  it("is fed the real value by the server page, not a guess", () => {
    expect(PAGE).toMatch(/import \{ DEMO_ACCOUNT_ENABLED \} from "@\/lib\/authConfig"/);
    expect(PAGE).toMatch(/<LoginForm demoEnabled=\{DEMO_ACCOUNT_ENABLED\} \/>/);
  });
});

describe("e2e/journey.mjs waits for the gate", () => {
  const JOURNEY = readFileSync(join(process.cwd(), "e2e/journey.mjs"), "utf8");

  it("waits for the button to be enabled rather than sleeping a fixed time", () => {
    expect(JOURNEY).toMatch(/waitForFunction/);
    expect(JOURNEY).toMatch(/!b\.disabled/);
  });
});
