"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Radio, Waves } from "lucide-react";
import { api, type TorStatus } from "@/lib/api";
import Panel from "../ui/Panel";
import { confidenceColor } from "../ui/Confidence";

/**
 * Live Tor timing-correlation demo — the network-layer headline.
 *
 * Stands up a real ephemeral hidden service and a real client through Tor (both
 * ours), records the timing at each end, and shows the two streams lining up as
 * the confidence gauge climbs. Timing alone links the visitor to the service
 * without decrypting anything — which is what actually unmasks onions.
 *
 * When Tor cannot bootstrap it falls back to a controlled replay over the same
 * correlation engine, and the badge says `simulated` so nothing is misrepresented.
 */
const ACTIVE = ["starting", "bootstrapping", "probing"];

export default function TimingPanel() {
  const [s, setS] = useState<TorStatus | null>(null);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const clock = useRef<ReturnType<typeof setInterval> | null>(null);
  const t0 = useRef<number>(0);

  const stop = useCallback(() => {
    if (poll.current) { clearInterval(poll.current); poll.current = null; }
    if (clock.current) { clearInterval(clock.current); clock.current = null; }
  }, []);

  const startPolling = useCallback(() => {
    stop();
    t0.current = Date.now();
    clock.current = setInterval(() => setElapsed(Math.round((Date.now() - t0.current) / 1000)), 500);
    poll.current = setInterval(async () => {
      const d = await api.torStatus();
      if ("engine" in d && d.engine === "offline") { stop(); setRunning(false); return; }
      if ("state" in d) {
        setS(d as TorStatus);
        if (["done", "error", "idle"].includes((d as TorStatus).state)) {
          stop(); setRunning(false);
        }
      }
    }, 1200);
  }, [stop]);

  // Reconnect to an experiment already running (or finished) from a previous
  // mount or page load, so switching tabs never appears to lose the run.
  useEffect(() => {
    let alive = true;
    (async () => {
      const d = await api.torStatus();
      if (!alive || !("state" in d)) return;
      const st = d as TorStatus;
      if (st.state === "idle") return;
      setS(st);
      if (ACTIVE.includes(st.state)) { setRunning(true); startPolling(); }
    })();
    return () => { alive = false; stop(); };
  }, [startPolling, stop]);

  async function run() {
    setRunning(true);
    setS(null);
    setElapsed(0);
    await api.torStart(20);
    startPolling();
  }

  const conf = s?.result?.confidence ?? 0;
  const done = s?.state === "done";
  const stateLabel: Record<string, string> = {
    starting: "starting", bootstrapping: "bootstrapping tor circuit",
    probing: "probing hidden service", done: "correlation complete", error: "failed",
  };

  return (
    <Panel
      title="Tor timing correlation"
      marked
      className="h-full"
      bodyClassName="min-h-0"
      right={
        s?.transport && s.transport !== "none" && (
          <span className={`chip ${s.transport === "tor" ? "chip-accent" : ""}`}>
            {s.transport === "tor" ? "live tor" : "simulated"}
          </span>
        )
      }
    >
      <div className="slim h-full overflow-y-auto p-3">
        <p className="mono text-[10px] leading-relaxed text-[var(--muted)]">
          Our own hidden service, our own client. Tor hides which IP you are, not
          when you send — line up the timing at both ends and the flow is provable
          without decryption.
        </p>

        {!s && (
          <button
            onClick={run} disabled={running}
            className="mono mt-3 flex w-full items-center justify-center gap-1.5 border border-[var(--accent-dim)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] py-2 text-[10px] uppercase tracking-[0.16em] text-[var(--c-high)] transition hover:bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] disabled:opacity-50"
          >
            <Radio className="h-3 w-3" /> Run live correlation
          </button>
        )}

        {s && (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-2">
              <span className="mono flex items-center gap-1.5 text-[9px] uppercase tracking-[0.14em] text-[var(--muted-2)]">
                {ACTIVE.includes(s.state) && (
                  <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[var(--accent)]" />
                )}
                {stateLabel[s.state] ?? s.state}
              </span>
              {s.state === "bootstrapping" && (
                <span className="bar flex-1">
                  <span style={{ width: `${s.bootstrap_pct}%`, background: "var(--muted)" }} />
                </span>
              )}
              {ACTIVE.includes(s.state) && (
                <span className="mono tnum ml-auto shrink-0 text-[9px] text-[var(--muted-2)]">{elapsed}s</span>
              )}
            </div>
            {ACTIVE.includes(s.state) && (
              <p className="mono text-[8.5px] leading-relaxed text-[var(--muted-2)]">
                A real Tor circuit is bootstrapping and probing our own hidden service —
                this takes ~30–40s. You can switch tabs; the run keeps going.
              </p>
            )}

            {s.onion && (
              <p className="mono truncate text-[9px] text-[var(--muted-2)]" title={s.onion}>
                service {s.onion}
              </p>
            )}

            {/* Dual timing streams — the visual "they line up" moment. */}
            <TimingPlot client={s.client_events} service={s.service_events} />

            {s.result && (
              <>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
                      Correlation confidence
                    </p>
                    <p className="mono tnum text-3xl font-bold" style={{ color: confidenceColor(conf) }}>
                      {conf.toFixed(3)}
                    </p>
                  </div>
                  <div className="mono text-right text-[9px] text-[var(--muted-2)]">
                    <p>interval r <span className="tnum text-[var(--text)]">{s.result.pearson.toFixed(3)}</span></p>
                    <p>RTT <span className="tnum text-[var(--text)]">{Math.abs(s.result.peak_lag_ms)} ms</span></p>
                    <p>events <span className="tnum text-[var(--text)]">{s.result.n_client}/{s.result.n_service}</span></p>
                  </div>
                </div>
                <p className="mono border-l-2 border-[var(--accent-dim)] pl-2 text-[9px] leading-relaxed text-[var(--muted)]">
                  {s.detail}
                </p>
              </>
            )}

            {done && (
              <button onClick={run}
                className="mono w-full border border-[var(--border-2)] py-1.5 text-[9px] uppercase tracking-[0.16em] text-[var(--muted)] transition hover:border-[var(--accent-dim)] hover:text-[var(--c-high)]">
                Run again
              </button>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}

function TimingPlot({ client, service }: { client: number[]; service: number[] }) {
  const max = Math.max(1, ...client, ...service);
  const row = (events: number[], color: string, label: string) => (
    <div className="flex items-center gap-2">
      <span className="mono w-12 shrink-0 text-[8px] uppercase text-[var(--muted-2)]">{label}</span>
      <span className="relative h-5 flex-1 border border-[var(--border)] bg-[var(--surface-2)]">
        {events.map((t, i) => (
          <span key={i} className="absolute top-0 h-full w-px"
            style={{ left: `${(t / max) * 100}%`, background: color }} />
        ))}
      </span>
    </div>
  );
  return (
    <div className="space-y-1" aria-label="Client and service timing streams">
      <div className="mono flex items-center gap-1.5 text-[9px] text-[var(--muted-2)]">
        <Waves className="h-2.5 w-2.5" /> visitor vs service — each tick is one request
      </div>
      {row(client, "var(--c-high)", "visitor")}
      {row(service, "#5B9BD5", "service")}
    </div>
  );
}
