/**
 * DEC-055 — the skin draw is a property of the VISIT, not the page load.
 *
 * The defect: the picker re-rolled on every document load, so any full
 * navigation or hard refresh repainted the product mid-investigation and moved
 * the rail from one side to the other.
 *
 * `resolveDraw` is the pure four-tier resolver. The pre-paint script is a
 * hand-written mirror of it (it must be dependency-free inline JS, so it cannot
 * import). These tests cover the resolver exhaustively; `skins.test.ts` asserts
 * the script carries the same keys, tiers and guards; and the e2e journey walks
 * the REAL script across six routes and a hard reload. No one of the three is
 * sufficient -- DEC-042 is the standing reminder of what a unit test alone
 * proves about code that only runs in a browser.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  resolveDraw,
  persistSession,
  parseSession,
  applyDraw,
  resetMemorySession,
  readMemorySession,
  STORAGE_KEYS,
  SESSION_VERSION,
  SKIN_IDS,
  LAYOUTS,
  FONT_PAIRS,
  type StorageLike,
} from "@/lib/skins";

/** A storage double. `mode` decides how it misbehaves. */
function store(
  initial: Record<string, string> = {},
  mode: "ok" | "throw-read" | "throw-write" | "throw-both" = "ok"
): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem(k) {
      if (mode === "throw-read" || mode === "throw-both") throw new Error("SecurityError");
      return k in data ? data[k] : null;
    },
    setItem(k, v) {
      if (mode === "throw-write" || mode === "throw-both") throw new Error("QuotaExceeded");
      data[k] = v;
    },
    removeItem(k) {
      delete data[k];
    },
  };
}

const record = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ skin: "abyss", layout: "b", fontPair: 2, drawnAt: 1, v: SESSION_VERSION, ...over });

/** Deterministic "random": always picks the first option. */
const first = () => 0;

beforeEach(() => resetMemorySession());

describe("tier 4 - a fresh draw", () => {
  it("draws when there is nothing stored, and asks to be persisted", () => {
    const d = resolveDraw({ session: store(), local: store(), random: first });
    expect(d.source).toBe("fresh");
    expect(d.persist).toBe(true);
    expect(SKIN_IDS).toContain(d.skin);
    expect(LAYOUTS).toContain(d.layout);
    expect(FONT_PAIRS).toContain(d.fontPair);
  });

  it("draws all three dimensions, not just the palette", () => {
    // A rail that jumps sides between routes is worse than a palette change.
    const d = resolveDraw({ session: store(), local: store(), random: () => 0.99 });
    expect(d.layout).toBe("b");
    expect(d.fontPair).toBe(2);
  });
});

describe("tier 3 - the visit (the fix)", () => {
  it("reuses the stored draw instead of re-rolling", () => {
    const s = store({ [STORAGE_KEYS.session]: record() });
    const d = resolveDraw({ session: s, local: store() });
    expect(d).toMatchObject({ skin: "abyss", layout: "b", fontPair: 2, source: "session" });
    expect(d.persist).toBe(false);
  });

  it("is stable across repeated resolutions, which is what a navigation is", () => {
    const s = store({ [STORAGE_KEYS.session]: record() });
    const runs = [1, 2, 3, 4, 5].map(() => resolveDraw({ session: s, local: store() }));
    for (const r of runs) {
      expect(r.skin).toBe("abyss");
      expect(r.layout).toBe("b");
      expect(r.fontPair).toBe(2);
    }
  });
});

describe("tier 2 - the lock", () => {
  it("beats the session draw", () => {
    const d = resolveDraw({
      session: store({ [STORAGE_KEYS.session]: record({ skin: "abyss" }) }),
      local: store({ [STORAGE_KEYS.lock]: "solar" }),
    });
    expect(d.skin).toBe("solar");
    expect(d.source).toBe("lock");
  });

  it("keeps the visit's layout and type, so only the palette is pinned", () => {
    const d = resolveDraw({
      session: store({ [STORAGE_KEYS.session]: record({ layout: "b", fontPair: 2 }) }),
      local: store({ [STORAGE_KEYS.lock]: "solar" }),
    });
    expect(d.layout).toBe("b");
    expect(d.fontPair).toBe(2);
  });

  it("honours a pre-DEC-055 lock key, so an existing lock is not lost", () => {
    const d = resolveDraw({
      session: store(),
      local: store({ [STORAGE_KEYS.legacyLock]: "verdant" }),
      random: first,
    });
    expect(d.skin).toBe("verdant");
    expect(d.source).toBe("lock");
  });

  it("prefers the new key when both are present", () => {
    const d = resolveDraw({
      session: store(),
      local: store({ [STORAGE_KEYS.lock]: "solar", [STORAGE_KEYS.legacyLock]: "verdant" }),
      random: first,
    });
    expect(d.skin).toBe("solar");
  });

  it("ignores a lock naming a skin that no longer exists", () => {
    const d = resolveDraw({
      session: store(),
      local: store({ [STORAGE_KEYS.lock]: "retired-skin" }),
      random: first,
    });
    expect(d.source).toBe("fresh");
    expect(SKIN_IDS).toContain(d.skin);
  });
});

describe("tier 1 - ?skin=", () => {
  it("wins over both the lock and the session draw", () => {
    const d = resolveDraw({
      forced: "plasma",
      session: store({ [STORAGE_KEYS.session]: record({ skin: "abyss" }) }),
      local: store({ [STORAGE_KEYS.lock]: "solar" }),
    });
    expect(d.skin).toBe("plasma");
    expect(d.source).toBe("query");
  });

  it("does NOT overwrite the session draw", () => {
    // A screenshot URL must not silently repaint the analyst's visit when they
    // navigate away from it.
    const d = resolveDraw({
      forced: "plasma",
      session: store({ [STORAGE_KEYS.session]: record({ skin: "abyss" }) }),
      local: store(),
    });
    expect(d.persist).toBe(false);
  });

  it("keeps the visit's layout and type", () => {
    const d = resolveDraw({
      forced: "plasma",
      session: store({ [STORAGE_KEYS.session]: record({ layout: "b", fontPair: 2 }) }),
      local: store(),
    });
    expect(d.layout).toBe("b");
    expect(d.fontPair).toBe(2);
  });

  it("ignores an unknown value rather than applying it", () => {
    const d = resolveDraw({
      forced: "'><script>alert(1)</script>",
      session: store({ [STORAGE_KEYS.session]: record() }),
      local: store(),
    });
    expect(d.skin).toBe("abyss");
    expect(d.source).toBe("session");
  });
});

describe("a corrupt or outdated session record", () => {
  const bad: [string, string][] = [
    ["not JSON at all", "{{{"],
    ["an older version", record({ v: 1 })],
    ["no version", JSON.stringify({ skin: "abyss", layout: "b", fontPair: 2 })],
    ["an unknown skin", record({ skin: "retired" })],
    ["an invalid layout", record({ layout: "z" })],
    ["an out-of-range font pair", record({ fontPair: 99 })],
    ["a string font pair", record({ fontPair: "1" })],
    ["null", "null"],
    ["an array", "[]"],
  ];

  it.each(bad)("discards %s and draws fresh, without throwing", (_label, raw) => {
    const d = resolveDraw({
      session: store({ [STORAGE_KEYS.session]: raw }),
      local: store(),
      random: first,
    });
    expect(d.source).toBe("fresh");
    expect(SKIN_IDS).toContain(d.skin);
  });

  it("parseSession returns null rather than throwing", () => {
    expect(parseSession("{{{")).toBeNull();
    expect(parseSession(null)).toBeNull();
    expect(parseSession(record({ v: 1 }))).toBeNull();
  });

  it("parseSession accepts a well-formed current record", () => {
    expect(parseSession(record())).toEqual({
      skin: "abyss",
      layout: "b",
      fontPair: 2,
      drawnAt: 1,
      v: SESSION_VERSION,
    });
  });
});

describe("storage that throws", () => {
  it("resolves without throwing when reading sessionStorage throws", () => {
    expect(() =>
      resolveDraw({ session: store({}, "throw-read"), local: store(), random: first })
    ).not.toThrow();
  });

  it("resolves without throwing when reading localStorage throws", () => {
    expect(() =>
      resolveDraw({ session: store(), local: store({}, "throw-read"), random: first })
    ).not.toThrow();
  });

  it("still produces a valid draw when both stores throw", () => {
    const d = resolveDraw({
      session: store({}, "throw-both"),
      local: store({}, "throw-both"),
      random: first,
    });
    expect(SKIN_IDS).toContain(d.skin);
    expect(LAYOUTS).toContain(d.layout);
  });

  it("persistSession does not throw when writing throws", () => {
    expect(() =>
      persistSession({ skin: "abyss", layout: "a", fontPair: 0 }, store({}, "throw-write"))
    ).not.toThrow();
  });

  it("falls back to an in-memory singleton, so the draw is stable anyway", () => {
    // Safari private mode and embedded webviews. A skin is not worth a blank
    // page; the draw stays stable for the SPA lifetime instead.
    persistSession({ skin: "solar", layout: "b", fontPair: 1 }, store({}, "throw-write"));
    expect(readMemorySession()).toMatchObject({ skin: "solar", layout: "b", fontPair: 1 });

    const d = resolveDraw({ session: store({}, "throw-read"), local: store() });
    expect(d).toMatchObject({ skin: "solar", layout: "b", fontPair: 1, source: "session" });
  });

  it("resolves with no storage objects at all", () => {
    const d = resolveDraw({ session: null, local: null, random: first });
    expect(SKIN_IDS).toContain(d.skin);
  });
});

describe("persistSession", () => {
  it("writes a versioned record", () => {
    const s = store();
    persistSession({ skin: "arctic", layout: "a", fontPair: 1 }, s, () => 1234);
    expect(JSON.parse(s.data[STORAGE_KEYS.session])).toEqual({
      skin: "arctic",
      layout: "a",
      fontPair: 1,
      drawnAt: 1234,
      v: SESSION_VERSION,
    });
  });

  it("round-trips through resolveDraw", () => {
    const s = store();
    persistSession({ skin: "arctic", layout: "b", fontPair: 2 }, s);
    expect(resolveDraw({ session: s, local: store() })).toMatchObject({
      skin: "arctic",
      layout: "b",
      fontPair: 2,
      source: "session",
    });
  });
});

describe("applyDraw", () => {
  it("writes all three attributes, so type and layout cannot drift from the skin", () => {
    const seen: Record<string, string> = {};
    applyDraw({ skin: "plasma", layout: "b", fontPair: 2 }, {
      setAttribute: (k, v) => {
        seen[k] = v;
      },
    });
    expect(seen).toEqual({ "data-skin": "plasma", "data-layout": "b", "data-font": "2" });
  });
});
