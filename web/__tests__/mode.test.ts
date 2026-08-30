import { describe, it, expect, beforeEach } from "vitest";
import { useIntel, FEED_MODES, type FeedMode } from "@/store/intel";
import { generateIntercept } from "@/lib/mockIntel";

// Phase 2 obj 6. The three-way toggle must keep v1's setDemoMode() semantics on
// every one of the six transitions, not just DEMO<->LIVE:
//   the feed and map CLEAR, the cumulative counters and alert log SURVIVE.
// That asymmetry is load-bearing - the counters are cumulative precisely because
// the dedup Sets live outside zustand (INV-5).

const reset = () => {
  useIntel.setState({
    mode: "DEMO",
    intercepts: [],
    cityHeat: {},
    alertLog: [],
    lastPulse: null,
    lastBreach: null,
    lastBreachAt: null,
    lastMpAt: null,
    threatLevel: "NOMINAL",
    datasetNotice: null,
    liveStatus: "idle",
  });
};

beforeEach(reset);

describe("FEED_MODES", () => {
  it("is exactly the three documented modes, in order", () => {
    expect(FEED_MODES).toEqual(["DEMO", "DATASET", "LIVE"]);
  });

  it("starts in DEMO so a cold open is always demo-able", () => {
    expect(useIntel.getState().mode).toBe("DEMO");
  });
});

describe("setMode - cycling", () => {
  it("reaches every mode", () => {
    for (const m of FEED_MODES) {
      useIntel.getState().setMode(m);
      expect(useIntel.getState().mode).toBe(m);
    }
  });

  it("handles all six transitions between distinct modes", () => {
    const pairs: [FeedMode, FeedMode][] = [
      ["DEMO", "DATASET"], ["DEMO", "LIVE"],
      ["DATASET", "DEMO"], ["DATASET", "LIVE"],
      ["LIVE", "DEMO"], ["LIVE", "DATASET"],
    ];
    for (const [from, to] of pairs) {
      useIntel.setState({ mode: from });
      useIntel.getState().setMode(to);
      expect(useIntel.getState().mode).toBe(to);
    }
  });

  it("is a no-op when the mode is unchanged", () => {
    useIntel.getState().ingest(generateIntercept({ forceCity: "Jabalpur" }));
    const before = useIntel.getState().intercepts.length;
    expect(before).toBeGreaterThan(0);
    useIntel.getState().setMode("DEMO"); // already DEMO
    // A no-op must NOT clear the feed - re-clicking the active mode is common.
    expect(useIntel.getState().intercepts.length).toBe(before);
  });
});

describe("setMode - v1 clearing semantics", () => {
  it("clears the feed, map heat and threat state", () => {
    useIntel.getState().ingest(generateIntercept({ forceCity: "Jabalpur" }));
    expect(useIntel.getState().intercepts.length).toBeGreaterThan(0);
    expect(Object.keys(useIntel.getState().cityHeat).length).toBeGreaterThan(0);
    expect(useIntel.getState().threatLevel).toBe("CRITICAL");

    useIntel.getState().setMode("DATASET");

    const s = useIntel.getState();
    expect(s.intercepts).toEqual([]);
    expect(s.cityHeat).toEqual({});
    expect(s.lastPulse).toBeNull();
    expect(s.lastBreach).toBeNull();
    expect(s.threatLevel).toBe("NOMINAL");
  });

  it("KEEPS the cumulative counters and the alert log", () => {
    useIntel.getState().ingest(generateIntercept({ forceCity: "Jabalpur" }));
    const before = useIntel.getState();
    const total = before.totalIntercepts;
    const breaches = before.geofenceBreaches;
    const alerts = before.alertLog.length;
    expect(alerts).toBeGreaterThan(0);

    useIntel.getState().setMode("LIVE");

    const after = useIntel.getState();
    expect(after.totalIntercepts).toBe(total);
    expect(after.geofenceBreaches).toBe(breaches);
    expect(after.alertLog.length).toBe(alerts);
  });

  it("keeps counters across a full three-mode cycle", () => {
    useIntel.getState().ingest(generateIntercept({ forceCity: "Katni" }));
    const breaches = useIntel.getState().geofenceBreaches;
    useIntel.getState().setMode("DATASET");
    useIntel.getState().setMode("LIVE");
    useIntel.getState().setMode("DEMO");
    expect(useIntel.getState().geofenceBreaches).toBe(breaches);
  });

  it("clears any dataset notice when leaving DATASET", () => {
    useIntel.setState({ mode: "DATASET", datasetNotice: "Engine offline." });
    useIntel.getState().setMode("DEMO");
    expect(useIntel.getState().datasetNotice).toBeNull();
  });
});

describe("setMode - liveStatus", () => {
  it("is idle in DEMO and connecting in the two real-source modes", () => {
    useIntel.getState().setMode("DATASET");
    expect(useIntel.getState().liveStatus).toBe("connecting");
    useIntel.getState().setMode("DEMO");
    expect(useIntel.getState().liveStatus).toBe("idle");
    useIntel.getState().setMode("LIVE");
    expect(useIntel.getState().liveStatus).toBe("connecting");
  });
});

describe("the geofence is mode-independent", () => {
  it("breaches in DATASET and LIVE exactly as in DEMO", () => {
    for (const m of FEED_MODES) {
      reset();
      useIntel.setState({ mode: m });
      // The counter is cumulative by design (INV-5), so assert the delta.
      const before = useIntel.getState().geofenceBreaches;
      useIntel.getState().ingest({
        ...generateIntercept({ forceCity: "Jabalpur" }),
        live: m !== "DEMO",
      });
      expect(useIntel.getState().geofenceBreaches - before).toBe(1);
      expect(useIntel.getState().threatLevel).toBe("CRITICAL");
    }
  });
});
