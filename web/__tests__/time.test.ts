/**
 * Relative timestamps (`lib/time.ts`).
 *
 * Small, but it renders on every freshness chip in the product -- "last scan
 * 4m", "resolved 1h". INV-5 makes staleness a first-class fact: a location or
 * a scan presented as current when it is hours old is a false statement, and
 * this is the function that says how old.
 */
import { describe, it, expect } from "vitest";
import { relativeTime, clockString } from "@/lib/time";

const NOW = Date.parse("2026-09-02T12:00:00Z");
const ago = (ms: number) => relativeTime(NOW - ms, NOW);

describe("relativeTime", () => {
  it("reads 'now' inside the first three seconds", () => {
    expect(ago(0)).toBe("now");
    expect(ago(2_999)).toBe("now");
  });

  it("switches to seconds at three", () => {
    expect(ago(3_000)).toBe("3s");
    expect(ago(59_000)).toBe("59s");
  });

  it("switches to minutes at sixty seconds", () => {
    expect(ago(60_000)).toBe("1m");
    expect(ago(59 * 60_000)).toBe("59m");
  });

  it("switches to hours at sixty minutes", () => {
    expect(ago(60 * 60_000)).toBe("1h");
    expect(ago(25 * 60 * 60_000)).toBe("25h");
  });

  it("clamps a future timestamp to 'now' rather than showing a negative age", () => {
    // Clock skew between the engine and the browser must not render "-4m".
    expect(relativeTime(NOW + 60_000, NOW)).toBe("now");
  });

  it("truncates rather than rounds, so an age is never overstated", () => {
    expect(ago(119_000)).toBe("1m");
  });

  it("defaults to the current time when no reference is given", () => {
    expect(relativeTime(Date.now())).toBe("now");
  });
});

describe("clockString", () => {
  it("zero-pads to HH:MM:SS", () => {
    expect(clockString(new Date(2026, 0, 1, 4, 5, 6))).toBe("04:05:06");
  });

  it("renders midnight and the last second of the day", () => {
    expect(clockString(new Date(2026, 0, 1, 0, 0, 0))).toBe("00:00:00");
    expect(clockString(new Date(2026, 0, 1, 23, 59, 59))).toBe("23:59:59");
  });

  it("is 24-hour, not 12-hour", () => {
    expect(clockString(new Date(2026, 0, 1, 13, 0, 0))).toBe("13:00:00");
  });
});
