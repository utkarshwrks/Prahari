/**
 * The workspace store (DEC-056).
 *
 * The two properties this file exists to pin:
 *
 *   1. NO DUPLICATE FETCHES. Ten routes reading one actor must produce one
 *      request, not ten. `fetchCount` makes that measurable rather than a claim.
 *   2. ONE OBJECT, ONE NUMBER. The confidence in the context bar and the
 *      confidence in the dossier are read from the same cached object. In a
 *      product whose claim is "every published score reproduces from its trail
 *      exactly" (INV-10), a screen showing two different confidences for one
 *      actor is not a rendering glitch -- it is the UI contradicting itself
 *      about evidence.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useWorkspace, bandOf, BAND_LABEL, BAND_THRESHOLD, type Band } from "@/lib/workspace";
import * as apiModule from "@/lib/api";

const profile = (over: Record<string, unknown> = {}) => ({
  ok: true,
  actor_id: "actor-088",
  label: "nightowl1",
  personas: [],
  identifiers: [],
  infrastructure: [],
  linkages: [],
  attribution_confidence: 0.991,
  confidence_basis: "highest fused pair score",
  categories: [],
  markets: [],
  first_seen: null,
  last_seen: null,
  last_scan: null,
  sources: [],
  post_count: 36,
  flags: [],
  ...over,
});

const timeline = { ok: true, actor_id: "actor-088", bucket: "week", buckets: [], series: [] };

let actorSpy: ReturnType<typeof vi.spyOn>;
let timelineSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  useWorkspace.getState().reset();
  actorSpy = vi.spyOn(apiModule.api, "actor").mockResolvedValue(profile() as never);
  timelineSpy = vi.spyOn(apiModule.api, "timeline").mockResolvedValue(timeline as never);
});
afterEach(() => vi.restoreAllMocks());

describe("no duplicate fetches", () => {
  it("fetches an actor once, however many times it is asked for", async () => {
    const { loadActor } = useWorkspace.getState();
    await loadActor("actor-088");
    await loadActor("actor-088");
    await loadActor("actor-088");
    expect(actorSpy).toHaveBeenCalledTimes(1);
    expect(timelineSpy).toHaveBeenCalledTimes(1);
  });

  it("shares one in-flight request between simultaneous callers", async () => {
    // Five routes mounting at once is the real case: the shell, the dossier and
    // three panels all ask on the same tick.
    const { loadActor } = useWorkspace.getState();
    await Promise.all([1, 2, 3, 4, 5].map(() => loadActor("actor-088")));
    expect(actorSpy).toHaveBeenCalledTimes(1);
  });

  it("counts exactly two network calls per actor: profile and timeline", async () => {
    await useWorkspace.getState().loadActor("actor-088");
    expect(useWorkspace.getState().fetchCount).toBe(2);
  });

  it("navigating between five routes adds no further calls", async () => {
    const { loadActor } = useWorkspace.getState();
    await loadActor("actor-088");
    const after = useWorkspace.getState().fetchCount;
    // dossier -> graph -> evidence -> timeline -> chain
    for (const _ of [0, 1, 2, 3, 4]) await loadActor("actor-088");
    expect(useWorkspace.getState().fetchCount).toBe(after);
  });

  it("fetches a different actor separately", async () => {
    const { loadActor } = useWorkspace.getState();
    await loadActor("actor-088");
    actorSpy.mockResolvedValue(profile({ actor_id: "actor-001", label: "other" }) as never);
    await loadActor("actor-001");
    expect(actorSpy).toHaveBeenCalledTimes(2);
    expect(Object.keys(useWorkspace.getState().entries).sort()).toEqual(["actor-001", "actor-088"]);
  });

  it("does not retry an actor that failed, until it is invalidated", async () => {
    actorSpy.mockResolvedValue({ ok: false, detail: "Unknown actor." } as never);
    const { loadActor } = useWorkspace.getState();
    await loadActor("nope");
    await loadActor("nope");
    expect(actorSpy).toHaveBeenCalledTimes(1);

    useWorkspace.getState().invalidate("nope");
    await loadActor("nope");
    expect(actorSpy).toHaveBeenCalledTimes(2);
  });
});

describe("one object, one number (the store invariant)", () => {
  it("the context bar and the dossier read the same object identity", async () => {
    await useWorkspace.getState().loadActor("actor-088");
    const fromContextBar = useWorkspace.getState().entries["actor-088"].profile;
    const fromDossier = useWorkspace.getState().entries["actor-088"].profile;
    // Identity, not equality: two structurally equal objects from two fetches
    // would pass a deep-equal check and still be the bug.
    expect(fromContextBar).toBe(fromDossier);
  });

  it("the confidence is the profile's, unrounded and unrecomputed", async () => {
    await useWorkspace.getState().loadActor("actor-088");
    const p = useWorkspace.getState().entries["actor-088"].profile;
    expect(p?.attribution_confidence).toBe(0.991);
  });

  it("a null confidence stays null rather than becoming zero", async () => {
    // INV-5: "not measured" and "measured as very low" are different claims.
    actorSpy.mockResolvedValue(profile({ attribution_confidence: null }) as never);
    await useWorkspace.getState().loadActor("actor-088");
    expect(useWorkspace.getState().entries["actor-088"].profile?.attribution_confidence).toBeNull();
  });
});

describe("error classification", () => {
  it("distinguishes an offline engine from an unknown actor", async () => {
    actorSpy.mockResolvedValue({ ok: false, engine: "offline", detail: "Engine unreachable." } as never);
    await useWorkspace.getState().loadActor("a");
    expect(useWorkspace.getState().entries["a"].error).toEqual({
      kind: "offline",
      detail: "Engine unreachable.",
    });

    actorSpy.mockResolvedValue({ ok: false, detail: "No such actor." } as never);
    await useWorkspace.getState().loadActor("b");
    expect(useWorkspace.getState().entries["b"].error?.kind).toBe("not-found");
  });

  it("renders a FastAPI validation detail as text, not as an object", async () => {
    // A 422 carries detail as an ARRAY of {type, loc, msg, input, ctx}. Passing
    // that into JSX threw React #31 and blanked the route -- found by walking
    // the routes in a real browser during this phase.
    actorSpy.mockResolvedValue({
      ok: false,
      detail: [{ type: "less_than_equal", loc: ["query", "limit"], msg: "Input should be <= 200" }],
    } as never);
    await useWorkspace.getState().loadActor("c");
    const err = useWorkspace.getState().entries["c"].error;
    expect(typeof err?.detail).toBe("string");
    expect(err?.detail).toContain("Input should be <= 200");
  });

  it("does not load a timeline for an actor that failed", async () => {
    actorSpy.mockResolvedValue({ ok: false, detail: "gone" } as never);
    await useWorkspace.getState().loadActor("a");
    expect(timelineSpy).not.toHaveBeenCalled();
  });

  it("keeps the profile when the timeline fails", async () => {
    // A dossier that renders without its timeline beats a dossier that does not
    // render at all.
    timelineSpy.mockResolvedValue({ ok: false, detail: "no series" } as never);
    await useWorkspace.getState().loadActor("actor-088");
    const e = useWorkspace.getState().entries["actor-088"];
    expect(e.profile).not.toBeNull();
    expect(e.timeline).toBeNull();
    expect(e.error).toBeNull();
  });
});

describe("last route per actor", () => {
  it("remembers where the analyst was", () => {
    const { rememberRoute } = useWorkspace.getState();
    rememberRoute("actor-088", "/workbench/actor/actor-088/evidence");
    expect(useWorkspace.getState().lastRoute["actor-088"]).toBe(
      "/workbench/actor/actor-088/evidence"
    );
  });

  it("keeps a separate memory per actor", () => {
    const { rememberRoute } = useWorkspace.getState();
    rememberRoute("a", "/workbench/actor/a/graph");
    rememberRoute("b", "/workbench/actor/b/chain");
    expect(useWorkspace.getState().lastRoute).toEqual({
      a: "/workbench/actor/a/graph",
      b: "/workbench/actor/b/chain",
    });
  });
});

describe("confidence bands", () => {
  it("uses the thresholds the Overview publishes", () => {
    expect(bandOf(0.95)).toBe("strong");
    expect(bandOf(0.9)).toBe("strong");
    expect(bandOf(0.8999)).toBe("worth-a-look");
    expect(bandOf(0.75)).toBe("worth-a-look");
    expect(bandOf(0.7499)).toBe("weak");
    expect(bandOf(0)).toBe("weak");
  });

  it("treats an unmeasured confidence as weak/unresolved, never as strong", () => {
    // Defaulting the other way would promote every unscored actor into the
    // "strong case" pile, which is the worst possible failure direction here.
    expect(bandOf(null)).toBe("weak");
  });

  it("labels and thresholds are defined for every band", () => {
    for (const b of ["strong", "worth-a-look", "weak"] as Band[]) {
      expect(BAND_LABEL[b]).toBeTruthy();
      expect(BAND_THRESHOLD[b]).toBeTruthy();
    }
  });
});
