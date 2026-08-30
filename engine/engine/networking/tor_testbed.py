"""A live Tor timing-correlation experiment on infrastructure we control.

Everything here is our own: a throwaway HTTP backend, an ephemeral hidden
service pointing at it, and a client that fetches it through Tor. Because both
endpoints are ours, observing the timing at each and correlating them is legal
and reproducible — and it is a genuine network-layer result, not a mock.

The flow:

  1. start a local HTTP backend that timestamps every request it receives
     (this is the "service" observation point)
  2. launch a tor process via stem with an EPHEMERAL hidden service mapping
     onion:80 -> that backend
  3. drive a client that fetches the .onion through tor's SOCKS proxy, on a
     deliberate timing pattern, timestamping each send (the "client" point)
  4. correlate the two timestamp streams (timing.py)

If tor cannot bootstrap (no network, or tor absent), the experiment falls back
to a CONTROLLED REPLAY over the same real correlation engine, clearly badged as
`simulated` so a viewer is never misled about what ran. The maths is identical;
only the transport differs.
"""

from __future__ import annotations

import http.server
import logging
import random
import socket
import threading
import time
from dataclasses import dataclass, field

from .timing import CorrelationResult, correlate

log = logging.getLogger(__name__)


@dataclass
class Experiment:
    state: str = "idle"          # idle | starting | bootstrapping | probing | done | error
    transport: str = "none"      # tor | simulated
    onion: str | None = None
    bootstrap_pct: int = 0
    client_events: list[float] = field(default_factory=list)
    service_events: list[float] = field(default_factory=list)
    result: dict | None = None
    detail: str = ""
    progress: list[dict] = field(default_factory=list)

    def as_dict(self) -> dict:
        d = self.__dict__.copy()
        # Present timing streams relative to the first event, so the UI can plot
        # them without leaking wall-clock times.
        base = min([*self.client_events, *self.service_events], default=0.0)
        d["client_events"] = [round((t - base) * 1000, 1) for t in self.client_events]
        d["service_events"] = [round((t - base) * 1000, 1) for t in self.service_events]
        return d


_current = Experiment()
_lock = threading.Lock()


def status() -> dict:
    with _lock:
        return _current.as_dict()


def _free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


class _Backend(http.server.BaseHTTPRequestHandler):
    """The hidden-service backend. Records the instant each request arrives.

    HTTP/1.1 keep-alive, so a single Tor stream can carry many requests in
    order — which is the sustained-flow model real correlation attacks use.
    """

    sink: list[float] = []

    def do_GET(self):  # noqa: N802
        _Backend.sink.append(time.time())
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"prahari-testbed")

    def log_message(self, *_):  # silence the default stderr logging
        pass


def _run_tor(exp: Experiment, pattern: list[float]) -> bool:
    """Real path: launch tor, publish an ephemeral HS, drive the client.

    Returns True on a genuine Tor run, False to signal the caller to fall back.
    """
    try:
        import stem.process
        from stem.control import Controller
    except Exception:  # noqa: BLE001
        exp.detail = "stem not available"
        return False

    backend_port = _free_port()
    control_port = _free_port()
    socks_port = _free_port()
    _Backend.sink = []

    httpd = http.server.HTTPServer(("127.0.0.1", backend_port), _Backend)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    tor_proc = None
    try:
        with _lock:
            exp.state = "bootstrapping"

        def on_bootstrap(line: str) -> None:
            if "Bootstrapped" in line:
                try:
                    pct = int(line.split("Bootstrapped ")[1].split("%")[0])
                    with _lock:
                        exp.bootstrap_pct = pct
                except Exception:  # noqa: BLE001
                    pass

        tor_proc = stem.process.launch_tor_with_config(
            config={"SocksPort": str(socks_port), "ControlPort": str(control_port)},
            init_msg_handler=on_bootstrap,
            timeout=90,
            take_ownership=True,
        )

        with Controller.from_port(port=control_port) as ctrl:
            ctrl.authenticate()
            service = ctrl.create_ephemeral_hidden_service(
                {80: backend_port}, await_publication=True
            )
            onion = f"{service.service_id}.onion"
            with _lock:
                exp.onion = onion
                exp.state = "probing"
                exp.progress.append({"t": time.time(), "msg": f"HS published: {onion[:20]}…"})

            # Fire each request on an ABSOLUTE schedule, not "sleep then block".
            # An onion fetch takes ~1s, so a serial loop would let fetch latency
            # bleed into the request spacing and blur the timing signature. One
            # thread per request, each waking at its target time, keeps the
            # client's send pattern exact -- which is what makes the correlation
            # sharp.
            starts = []
            t = 0.0
            for gap in pattern:
                t += gap
                starts.append(t)
            t0 = time.time() + 1.0
            sends: list[float] = []
            sends_lock = threading.Lock()

            # Each request on its own connection, fired at its scheduled instant.
            # Gaps are wider than the circuit RTT variance, so requests arrive at
            # the service in the order they were sent and the timing signature
            # stays sharp.
            def _fire(target: float) -> None:
                delay = (t0 + target) - time.time()
                if delay > 0:
                    time.sleep(delay)
                with sends_lock:
                    sends.append(time.time())
                try:
                    sk = _socks_socket(socks_port)
                    sk.connect((onion, 80))
                    sk.sendall(b"GET / HTTP/1.0\r\nHost: prahari\r\n\r\n")
                    sk.recv(64)
                    sk.close()
                except Exception:  # noqa: BLE001
                    pass

            threads = [threading.Thread(target=_fire, args=(x,), daemon=True) for x in starts]
            for th in threads:
                th.start()
            for th in threads:
                th.join(timeout=45)

            exp.client_events = sorted(sends)
            exp.service_events = sorted(_Backend.sink)
            exp.transport = "tor"
            return True
    except Exception as exc:  # noqa: BLE001
        log.warning("tor run failed: %s", exc)
        exp.detail = f"tor bootstrap failed: {type(exc).__name__}"
        return False
    finally:
        httpd.shutdown()
        if tor_proc:
            try:
                tor_proc.kill()
            except Exception:  # noqa: BLE001
                pass


def _socks_socket(socks_port: int):
    import socks

    s = socks.socksocket()
    s.set_proxy(socks.SOCKS5, "127.0.0.1", socks_port, rdns=True)
    s.settimeout(30)
    return s


def _run_simulated(exp: Experiment, pattern: list[float]) -> None:
    """Fallback: a controlled replay through the SAME correlation engine.

    A realistic circuit RTT and jitter, driven by the same request pattern, so
    the correlation the analyst sees is computed from real timing maths — only
    the transport is simulated. Badged as such.
    """
    rng = random.Random(1337)
    rtt = 0.45 + rng.uniform(0.1, 0.3)   # a plausible onion round-trip
    t = time.time()
    for gap in pattern:
        t += gap
        exp.client_events.append(t)
        exp.service_events.append(t + rtt + rng.gauss(0, 0.03))
        with _lock:
            exp.bootstrap_pct = min(100, exp.bootstrap_pct + int(100 / len(pattern)))
        time.sleep(0.05)
    exp.transport = "simulated"
    exp.onion = "controlled-replay.onion"


def _experiment(n: int = 24) -> None:
    exp = Experiment(state="starting")
    with _lock:
        global _current
        _current = exp

    # An irregular request pattern makes the correlation unambiguous: a regular
    # heartbeat would correlate with any other regular stream by coincidence.
    rng = random.Random()
    pattern = [round(0.6 + rng.expovariate(1.2), 3) for _ in range(n)]

    ran_real = False
    try:
        ran_real = _run_tor(exp, pattern)
    except Exception:  # noqa: BLE001
        ran_real = False

    if not ran_real:
        exp.client_events.clear()
        exp.service_events.clear()
        _run_simulated(exp, pattern)

    res: CorrelationResult = correlate(exp.client_events, exp.service_events)
    with _lock:
        exp.result = res.as_dict()
        exp.state = "done"
        exp.detail = (
            f"Live Tor circuit — {exp.onion}. " if exp.transport == "tor"
            else "Controlled replay (tor could not bootstrap). "
        ) + res.detail


def start(n: int = 24) -> dict:
    """Kick off an experiment in the background. Poll status() for progress."""
    with _lock:
        if _current.state in ("starting", "bootstrapping", "probing"):
            return {"ok": True, "already_running": True, **_current.as_dict()}
    threading.Thread(target=_experiment, kwargs={"n": n}, name="tor-exp", daemon=True).start()
    time.sleep(0.1)
    return {"ok": True, "started": True, **status()}
