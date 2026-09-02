/**
 * Feature flags (`lib/features.ts`), added in Phase 0.
 *
 * The prime directive of the v2.1 upgrade is "additive only". These flags are
 * how that is enforced: every new surface renders behind one, each defaults
 * OFF, and the legacy surface stays reachable while the flag is off.
 *
 * The default-OFF property is the one worth testing. A flag that quietly
 * defaults ON turns "additive" into "replaced" on the next deploy.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const ENV = { ...process.env };
beforeEach(() => vi.resetModules());
afterEach(() => {
  process.env = { ...ENV };
});

async function load(env: Record<string, string | undefined> = {}) {
  process.env = { ...ENV, ...env } as NodeJS.ProcessEnv;
  return (await import("@/lib/features")).FEATURES;
}

const ALL = ["workspaceRoutes", "graphLab", "commandPanel", "sangamPro"] as const;

describe("FEATURES", () => {
  it("declares one flag per upgrade phase", async () => {
    const f = await load();
    expect(Object.keys(f).sort()).toEqual([...ALL].sort());
  });

  it("every flag defaults OFF with no environment set", async () => {
    const f = await load({
      NEXT_PUBLIC_FF_WORKSPACE: undefined,
      NEXT_PUBLIC_FF_GRAPH_LAB: undefined,
      NEXT_PUBLIC_FF_COMMAND: undefined,
      NEXT_PUBLIC_FF_SANGAM_PRO: undefined,
    });
    for (const k of ALL) expect(f[k]).toBe(false);
  });

  it('only the exact value "1" enables a flag', async () => {
    // "true", "yes" and "0" must not switch a surface on by accident.
    for (const v of ["true", "yes", "on", "0", ""]) {
      const f = await load({ NEXT_PUBLIC_FF_WORKSPACE: v });
      expect(f.workspaceRoutes).toBe(false);
      vi.resetModules();
    }
  });

  it("enables exactly the flag that is set, and no other", async () => {
    const f = await load({
      NEXT_PUBLIC_FF_WORKSPACE: "1",
      NEXT_PUBLIC_FF_GRAPH_LAB: undefined,
      NEXT_PUBLIC_FF_COMMAND: undefined,
      NEXT_PUBLIC_FF_SANGAM_PRO: undefined,
    });
    expect(f.workspaceRoutes).toBe(true);
    expect(f.graphLab).toBe(false);
    expect(f.commandPanel).toBe(false);
    expect(f.sangamPro).toBe(false);
  });

  it("flags are booleans, never a truthy string", async () => {
    const f = await load({ NEXT_PUBLIC_FF_COMMAND: "1" });
    for (const k of ALL) expect(typeof f[k]).toBe("boolean");
  });
});
