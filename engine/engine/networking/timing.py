"""Traffic-timing correlation — the maths behind an onion de-anonymisation.

This is the technique that actually unmasks hidden services in the real world,
stated honestly: Tor hides *which* IP you are, not *when* you send. An adversary
who can observe traffic timing at the entry (near the client) and at the exit
(near the service) can line up the two streams and show they are the same
conversation — WITHOUT decrypting anything.

PRAHARI demonstrates this on infrastructure it fully controls (its own hidden
service and its own client), so the demo is legal, reproducible, and a genuine
network-layer result rather than a mock. In production the same maths runs where
the operator already controls a relay or has a lawful vantage point.

The engine here is source-independent: it takes two timestamp streams and
reports how strongly they correlate. `tor_testbed.py` produces real streams from
a live local Tor circuit; the maths does not care where they came from.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field


@dataclass
class CorrelationResult:
    confidence: float           # 0..1 — how strongly the streams are the same flow
    peak_lag_ms: float          # offset at which they align best (the circuit RTT)
    pearson: float              # correlation at the peak lag
    n_client: int
    n_service: int
    matched: int                # request/response pairs that line up
    bin_ms: int
    detail: str = ""

    def as_dict(self) -> dict:
        return self.__dict__.copy()


def _binned(timestamps: list[float], t0: float, span_ms: float, bin_ms: int) -> list[int]:
    """Bucket event timestamps (seconds) into a fixed-width histogram."""
    n = max(1, int(span_ms / bin_ms) + 1)
    hist = [0] * n
    for t in timestamps:
        idx = int((t - t0) * 1000 / bin_ms)
        if 0 <= idx < n:
            hist[idx] += 1
    return hist


def _pearson(a: list[float], b: list[float]) -> float:
    n = min(len(a), len(b))
    if n < 2:
        return 0.0
    a, b = a[:n], b[:n]
    ma, mb = sum(a) / n, sum(b) / n
    va = sum((x - ma) ** 2 for x in a)
    vb = sum((x - mb) ** 2 for x in b)
    if va == 0 or vb == 0:
        return 0.0
    cov = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    return cov / math.sqrt(va * vb)


def _intervals(events: list[float]) -> list[float]:
    """Gaps between consecutive events. Delay-invariant: a per-event transport
    delay cancels in the difference, so this survives the wild RTT jitter of a
    real Tor circuit where a single global lag does not."""
    return [events[i] - events[i - 1] for i in range(1, len(events))]


def interval_correlation(client_events: list[float], service_events: list[float]) -> float:
    """Correlate inter-event gaps of two ORDERED streams.

    The i-th request a client sends is the i-th request the service receives, so
    the two streams are the same sequence shifted by a variable delay. The gaps
    between events are almost identical regardless of that delay — which is
    exactly the flow-correlation signal that unmasks a hidden service.
    """
    n = min(len(client_events), len(service_events))
    if n < 3:
        return 0.0
    return _pearson(_intervals(client_events[:n]), _intervals(service_events[:n]))


def correlate(
    client_events: list[float],
    service_events: list[float],
    bin_ms: int = 50,
    max_lag_ms: int = 2000,
) -> CorrelationResult:
    """Cross-correlate two timing streams over a range of lags.

    A real circuit imposes a roughly constant round-trip delay, so the streams
    align best at ONE lag — the RTT. A high, sharply-peaked correlation is the
    signature of the same flow; noise correlates weakly and flatly at every lag.
    """
    if not client_events or not service_events:
        return CorrelationResult(0.0, 0.0, 0.0, len(client_events), len(service_events),
                                 0, bin_ms, "One stream is empty; nothing to correlate.")

    t0 = min(min(client_events), min(service_events))
    t1 = max(max(client_events), max(service_events))
    span_ms = max((t1 - t0) * 1000, bin_ms)

    ch = [float(x) for x in _binned(client_events, t0, span_ms, bin_ms)]
    sh = [float(x) for x in _binned(service_events, t0, span_ms, bin_ms)]

    best_lag, best_r = 0, -2.0
    lag_bins = int(max_lag_ms / bin_ms)
    for lag in range(-lag_bins, lag_bins + 1):
        # Shift the service stream by `lag` bins and score the overlap.
        if lag >= 0:
            a, b = ch[lag:], sh[: len(sh) - lag] if lag else sh
        else:
            a, b = ch[: len(ch) + lag], sh[-lag:]
        r = _pearson(a, b)
        if r > best_r:
            best_r, best_lag = r, lag

    # Match request bursts to response bursts within a tolerance around the peak
    # lag — this is the human-legible "N of M requests line up" number.
    lag_s = best_lag * bin_ms / 1000
    tol = (bin_ms * 3) / 1000
    matched = 0
    for c in client_events:
        if any(abs((s - lag_s) - c) <= tol for s in service_events):
            matched += 1

    # Interval correlation is the primary, delay-invariant signal; the binned
    # peak correlation corroborates it. A real matched flow scores high on the
    # first even when per-request RTT jitters, which is the realistic case.
    ivr = interval_correlation(client_events, service_events)
    # Lead with the delay-invariant interval correlation: over a real Tor
    # circuit the per-request RTT jitters by hundreds of ms, so the binned peak
    # is noisy and only corroborates. The interval correlation is the evidence.
    confidence = max(0.0, min(1.0, 0.85 * max(0.0, ivr) + 0.15 * max(0.0, best_r)))

    return CorrelationResult(
        confidence=round(confidence, 4),
        peak_lag_ms=round(best_lag * bin_ms, 1),
        pearson=round(ivr, 4),
        n_client=len(client_events),
        n_service=len(service_events),
        matched=matched,
        bin_ms=bin_ms,
        detail=(f"Inter-event timing correlates at r={ivr:.2f} (delay-invariant); "
                f"the streams also align at a {best_lag * bin_ms} ms lag. "
                f"Timing alone links the visitor to the service without decrypting Tor."),
    )
