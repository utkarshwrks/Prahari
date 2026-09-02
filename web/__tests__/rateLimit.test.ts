/**
 * The in-process rate limiter (`lib/rateLimit.ts`).
 *
 * It guards the only two routes reachable without a session -- `/api/signup`
 * and the credentials callback -- which makes it the only thing standing
 * between an attacker and unlimited password guesses. v1 had no limit at all.
 *
 * DEC-046: a fixed-window counter in module scope, deliberately. The playbook
 * forbids Redis and a single-node district deployment does not need it. The
 * limitation is real and stated, not hidden: behind multiple instances each
 * process keeps its own window, so the effective limit multiplies by instance
 * count. The last test here pins that honesty.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { rateLimit, clientKey, resetAll } from "@/lib/rateLimit";

beforeEach(() => resetAll());
afterEach(() => vi.useRealTimers());

const req = (headers: Record<string, string>) => new Request("https://x.test", { headers });

describe("rateLimit", () => {
  it("allows the first request and reports the remaining budget", () => {
    expect(rateLimit("k", 3, 1000)).toEqual({ ok: true, remaining: 2, retryAfterSeconds: 0 });
  });

  it("allows exactly `limit` requests in a window", () => {
    const results = [1, 2, 3].map(() => rateLimit("k", 3, 60_000).ok);
    expect(results).toEqual([true, true, true]);
    expect(rateLimit("k", 3, 60_000).ok).toBe(false);
  });

  it("never reports negative remaining once over the limit", () => {
    for (let i = 0; i < 8; i++) rateLimit("k", 3, 60_000);
    expect(rateLimit("k", 3, 60_000).remaining).toBe(0);
  });

  it("reports a retry-after only once the caller is inside a live window", () => {
    expect(rateLimit("k", 1, 60_000).retryAfterSeconds).toBe(0);
    expect(rateLimit("k", 1, 60_000).retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keys are independent, so one client cannot lock out another", () => {
    for (let i = 0; i < 5; i++) rateLimit("a", 2, 60_000);
    expect(rateLimit("a", 2, 60_000).ok).toBe(false);
    expect(rateLimit("b", 2, 60_000).ok).toBe(true);
  });

  it("opens a fresh window once the old one expires", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    expect(rateLimit("k", 1, 1000).ok).toBe(true);
    expect(rateLimit("k", 1, 1000).ok).toBe(false);

    vi.setSystemTime(new Date("2026-01-01T00:00:02Z"));
    expect(rateLimit("k", 1, 1000).ok).toBe(true);
  });

  it("is a FIXED window, not a sliding one", () => {
    // Stated so nobody reads a sliding-window guarantee into it: a burst
    // straddling a boundary can spend two windows back to back.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    expect(rateLimit("k", 2, 1000).ok).toBe(true);
    expect(rateLimit("k", 2, 1000).ok).toBe(true);

    vi.setSystemTime(new Date("2026-01-01T00:00:01Z"));
    expect(rateLimit("k", 2, 1000).ok).toBe(true);
    expect(rateLimit("k", 2, 1000).ok).toBe(true);
  });

  it("bounds its memory so a flood of unique keys cannot exhaust the heap", () => {
    // MAX_BUCKETS is 10_000. Past it the oldest window is evicted: the worst
    // case is an attacker regaining a few attempts, which beats an OOM.
    for (let i = 0; i < 10_050; i++) rateLimit(`k${i}`, 1, 600_000);
    // The earliest keys were evicted, so they get a fresh allowance.
    expect(rateLimit("k0", 1, 600_000).ok).toBe(true);
    // A recent key is still limited.
    expect(rateLimit("k10049", 1, 600_000).ok).toBe(false);
  });
});

describe("clientKey", () => {
  it("prefers the first x-forwarded-for hop", () => {
    expect(clientKey(req({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }), "signup")).toBe(
      "signup:1.2.3.4"
    );
  });

  it("trims whitespace around the hop", () => {
    expect(clientKey(req({ "x-forwarded-for": "  1.2.3.4 , 5.6.7.8" }), "login")).toBe(
      "login:1.2.3.4"
    );
  });

  it("falls back to x-real-ip", () => {
    expect(clientKey(req({ "x-real-ip": "9.9.9.9" }), "signup")).toBe("signup:9.9.9.9");
  });

  it("falls back to a constant when the client cannot be identified", () => {
    // Everyone unidentifiable shares one bucket. That is the safe direction:
    // it over-limits rather than handing out an unlimited allowance.
    expect(clientKey(req({}), "signup")).toBe("signup:unknown");
  });

  it("scopes keys so the signup and login budgets do not share a counter", () => {
    const h = { "x-real-ip": "1.1.1.1" };
    expect(clientKey(req(h), "signup")).not.toBe(clientKey(req(h), "login"));
  });
});
