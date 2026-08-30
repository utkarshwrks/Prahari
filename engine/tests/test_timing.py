"""Timing-correlation maths. Source-independent; the live Tor test is separate."""

from __future__ import annotations

import random

from engine.networking.timing import correlate, interval_correlation


def _flow(n=24, rtt=0.6, jitter=0.03, seed=1):
    """A client stream and the same requests seen at the service, shifted by a
    variable delay -- exactly the shape a real circuit produces."""
    rng = random.Random(seed)
    t, client = 1000.0, []
    for _ in range(n):
        t += 0.4 + rng.expovariate(2.0)
        client.append(t)
    service = [c + rtt + rng.gauss(0, jitter) for c in client]
    return client, service


def test_matched_flow_correlates_strongly():
    c, s = _flow()
    r = correlate(c, s)
    assert r.confidence > 0.6, r.confidence
    assert r.pearson > 0.7   # interval correlation


def test_unrelated_streams_do_not_correlate():
    c, _ = _flow(seed=1)
    noise = sorted(random.Random(99).uniform(1000, 1000 + (c[-1] - c[0])) for _ in c)
    assert correlate(c, noise).confidence < 0.3


def test_matched_beats_unrelated_by_a_wide_margin():
    c, s = _flow()
    noise = sorted(random.Random(5).uniform(c[0], c[-1]) for _ in c)
    assert correlate(c, s).confidence > correlate(c, noise).confidence + 0.3


def test_interval_correlation_is_delay_invariant():
    """A constant offset must not change the interval correlation at all."""
    c, s = _flow(jitter=0.0)
    shifted = [x + 5.0 for x in s]
    assert abs(interval_correlation(c, s) - interval_correlation(c, shifted)) < 1e-9


def test_confidence_is_a_probability():
    c, s = _flow()
    r = correlate(c, s)
    assert 0.0 <= r.confidence <= 1.0


def test_empty_streams_are_safe():
    r = correlate([], [1.0, 2.0])
    assert r.confidence == 0.0
    assert "empty" in r.detail.lower()


def test_peak_lag_recovers_the_rtt():
    c, s = _flow(rtt=0.6, jitter=0.01)
    r = correlate(c, s)
    # binned lag should land near the true 600ms round trip
    assert abs(abs(r.peak_lag_ms) - 600) <= 200
