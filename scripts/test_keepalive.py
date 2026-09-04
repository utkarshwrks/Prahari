#!/usr/bin/env python3
"""Tests for the keep-alive budget guard and runner (DEC-065, DEC-075).

Run with `python3 -m unittest discover -s scripts -p 'test_*.py'`, which is how
CI runs them. Deliberately stdlib-only and outside the engine's test suite, for
the same reason the guard itself is: these run in a job with no dependencies
installed, and a budget guard whose tests need `pip install` is a guard whose
tests get skipped.

The properties worth protecting are not the arithmetic -- that is easy -- but
the DIRECTIONS the code is allowed to be wrong in. A guard that cannot read its
artifact must refuse to ping; a runner killed mid-segment must leave a claim
that overstates rather than one that vanishes; an overlap must never be billed
twice. Each of those has a test below because each has a plausible refactor
that silently reverses it.
"""

from __future__ import annotations

import datetime as dt
import json
import sys
import tempfile
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from keepalive_budget import (  # noqa: E402
    SPIN_DOWN_MINUTES,
    Unreadable,
    awake_seconds,
    decide,
    in_window,
    load,
    month_key,
    normalise,
    planned_awake_seconds,
    reserve,
    seconds_until_window,
    settle,
)

H = 3600.0
BASE = dt.datetime(2026, 9, 4, 0, 0, tzinfo=dt.timezone.utc).timestamp()


def write(tmp: Path, obj) -> Path:
    p = tmp / "state.json"
    p.write_text(obj if isinstance(obj, str) else json.dumps(obj))
    return p


class TestFailsClosed(unittest.TestCase):
    """The one direction this must never be wrong in."""

    def setUp(self):
        self._d = tempfile.TemporaryDirectory()
        self.tmp = Path(self._d.name)

    def tearDown(self):
        self._d.cleanup()

    def test_corrupt_artifact_is_unreadable(self):
        with self.assertRaises(Unreadable):
            load(write(self.tmp, "this is not json"))

    def test_non_object_artifact_is_unreadable(self):
        with self.assertRaises(Unreadable):
            load(write(self.tmp, [1, 2, 3]))

    def test_malformed_pings_are_unreadable_not_dropped(self):
        # Dropping them would UNDERSTATE usage and let us ping past the budget.
        state = {"month": month_key(), "pings": [1.0, "soon"], "awake": []}
        with self.assertRaises(Unreadable):
            normalise(load(write(self.tmp, state)), time.time())

    def test_malformed_awake_entry_is_unreadable(self):
        state = {"month": month_key(), "pings": [], "awake": [{"from": "x", "to": 1}]}
        with self.assertRaises(Unreadable):
            normalise(load(write(self.tmp, state)), time.time())

    def test_missing_artifact_is_a_first_run_not_a_corrupt_one(self):
        # Missing genuinely means zero spent. Conflating the two would make a
        # first run refuse to ping forever.
        got = load(self.tmp / "does-not-exist.json")
        self.assertEqual(got["pings"], [])
        self.assertIsNone(got["month"])


class TestAccounting(unittest.TestCase):
    def test_a_new_calendar_month_resets_the_pool(self):
        state = normalise({"month": "2025-01", "pings": [1.0],
                           "awake": [{"from": 1, "to": 9e9}]}, BASE)
        self.assertEqual(state["month"], month_key())
        self.assertEqual(state["awake"], [])
        self.assertEqual(state["pings"], [])

    def test_a_lone_ping_bills_only_the_spin_down_window(self):
        # A ping with no successor keeps the service awake for 15 minutes, not
        # for the rest of the month.
        state = {"month": month_key(), "pings": [BASE], "awake": []}
        self.assertAlmostEqual(awake_seconds(state, BASE + 10 * H),
                               SPIN_DOWN_MINUTES * 60, places=3)

    def test_overlapping_sources_are_billed_once(self):
        # A month can hold both legacy pings and segments. Billing the overlap
        # twice would narrow the window for no reason.
        state = {"month": month_key(),
                 "pings": [BASE, BASE + 300],
                 "awake": [{"from": BASE, "to": BASE + 2 * H, "provisional": False}]}
        self.assertAlmostEqual(awake_seconds(state, BASE + 3 * H), 2 * H, places=3)

    def test_disjoint_segments_add_up(self):
        state = {"month": month_key(), "pings": [],
                 "awake": [{"from": BASE, "to": BASE + H, "provisional": False},
                           {"from": BASE + 5 * H, "to": BASE + 7 * H, "provisional": False}]}
        self.assertAlmostEqual(awake_seconds(state, BASE + 9 * H), 3 * H, places=3)

    def test_an_unsettled_claim_survives_a_killed_runner(self):
        # The runner died an hour in; the claim still bills the elapsed hour
        # rather than vanishing. Vanishing is the failure that lets the next
        # segment sail past the pool.
        now = BASE + H
        state = {"month": month_key(), "pings": [],
                 "awake": [{"from": BASE, "to": BASE + 5 * H, "provisional": True}]}
        self.assertAlmostEqual(awake_seconds(state, now),
                               H + SPIN_DOWN_MINUTES * 60, places=3)

    def test_a_stale_claim_cannot_bill_the_future(self):
        # Without the cap, one abandoned reservation would exhaust the month.
        state = {"month": month_key(), "pings": [],
                 "awake": [{"from": BASE, "to": BASE + 500 * H, "provisional": True}]}
        billed = awake_seconds(state, BASE + H)
        self.assertLess(billed, 2 * H)


class TestDecision(unittest.TestCase):
    def _state(self, hours):
        return {"month": month_key(), "pings": [],
                "awake": [{"from": BASE - hours * H, "to": BASE, "provisional": False}]}

    def test_pings_when_in_window_and_under_budget(self):
        d = decide(self._state(1), BASE + 5 * H, 750, 2, 3, 13)
        self.assertTrue(d["ok"])

    def test_refuses_outside_the_window(self):
        d = decide(self._state(1), BASE + 14 * H, 750, 2, 3, 13)
        self.assertFalse(d["ok"])
        self.assertIn("outside the window", d["reason"])

    def test_refuses_when_the_budget_is_exhausted(self):
        d = decide(self._state(400), BASE + 5 * H, 750, 2, 3, 13)
        self.assertFalse(d["ok"])
        self.assertIn("exhausted", d["reason"])

    def test_narrows_rather_than_stops_past_the_guard_threshold(self):
        # 320 h of a 375 h share is 85.3%: narrow to half rate, not off. The
        # services stay reachable, just colder.
        at = dt.datetime(2026, 9, 4, 5, 3, tzinfo=dt.timezone.utc).timestamp()
        on = decide(self._state(320), at, 750, 2, 3, 13)
        self.assertTrue(on["ok"])
        self.assertIn("narrowed", on["reason"])
        off = dt.datetime(2026, 9, 4, 5, 13, tzinfo=dt.timezone.utc).timestamp()
        self.assertFalse(decide(self._state(320), off, 750, 2, 3, 13)["ok"])


class TestWindow(unittest.TestCase):
    def test_simple_window(self):
        self.assertTrue(in_window(5, 3, 13))
        self.assertFalse(in_window(13, 3, 13))
        self.assertFalse(in_window(2, 3, 13))

    def test_window_wrapping_midnight(self):
        self.assertTrue(in_window(23, 23, 1))
        self.assertTrue(in_window(0, 23, 1))
        self.assertFalse(in_window(1, 23, 1))

    def test_an_empty_window_is_never_open(self):
        self.assertFalse(in_window(5, 5, 5))

    def test_seconds_until_window(self):
        self.assertEqual(seconds_until_window(BASE, 3, 13), 3 * H)
        self.assertEqual(seconds_until_window(BASE + 5 * H, 3, 13), 0.0)  # open
        self.assertEqual(seconds_until_window(BASE + 14 * H, 3, 13), 13 * H)
        self.assertEqual(seconds_until_window(BASE + 12 * H, 23, 1), 11 * H)

    def test_planned_awake_seconds_is_the_overlap_only(self):
        self.assertAlmostEqual(planned_awake_seconds(BASE, BASE + 5.5 * H, 3, 13),
                               2.5 * H, delta=60)
        self.assertEqual(planned_awake_seconds(BASE + 13 * H, BASE + 18.5 * H, 3, 13), 0.0)
        self.assertAlmostEqual(planned_awake_seconds(BASE + 4 * H, BASE + 9.5 * H, 3, 13),
                               5.5 * H, delta=60)


class TestReserveSettle(unittest.TestCase):
    def setUp(self):
        self._d = tempfile.TemporaryDirectory()
        self.p = Path(self._d.name) / "state.json"

    def tearDown(self):
        self._d.cleanup()

    def test_reserve_then_settle_records_what_was_actually_used(self):
        now = time.time()
        rid, seconds = reserve(self.p, 330, 0, 24, now)   # window always open
        self.assertAlmostEqual(seconds, 330 * 60, delta=60)
        state = normalise(load(self.p), now)
        self.assertTrue(state["awake"][0]["provisional"])

        self.assertTrue(settle(self.p, rid, now, now + 900))
        state = normalise(load(self.p), now)
        self.assertFalse(state["awake"][0]["provisional"])
        self.assertAlmostEqual(state["awake"][0]["to"] - state["awake"][0]["from"],
                               900, places=3)

    def test_settling_an_unknown_reservation_invents_nothing(self):
        # An unmatched settle means the reserve never landed. Adding a span here
        # would be indistinguishable from double-billing a settled one.
        now = time.time()
        reserve(self.p, 60, 0, 24, now)
        self.assertFalse(settle(self.p, now + 12345, None, now))
        self.assertEqual(len(normalise(load(self.p), now)["awake"]), 1)

    def test_a_segment_that_never_pinged_costs_nothing(self):
        now = time.time()
        rid, _ = reserve(self.p, 330, 0, 24, now)
        settle(self.p, rid, now, now)
        self.assertAlmostEqual(awake_seconds(normalise(load(self.p), now), now),
                               0.0, places=3)


if __name__ == "__main__":
    unittest.main(verbosity=2)
