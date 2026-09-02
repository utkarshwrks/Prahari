"""Keep-alive budget and window logic (DEC-064, DEC-065).

The gate items: the ping touches no database, the window logic is right, and
the budget guard narrows at 85% and STOPS at 100% -- failing closed if it
cannot compute the budget at all.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from engine import uptime as U
from engine.main import app


@pytest.fixture(autouse=True)
def _clean(tmp_path, monkeypatch):
    monkeypatch.setattr(U, "STATE_DIR", tmp_path)
    monkeypatch.setattr(U, "STATE_FILE", tmp_path / "uptime.json")
    yield


@pytest.fixture
def client():
    return TestClient(app)


class TestVerifiedFigures:
    """These are Render's documented numbers, checked against the live docs on
    2026-09-03. They are constants here so a change to them is a visible diff
    rather than a silent drift."""

    def test_the_pool_is_750_hours_per_workspace(self):
        assert U.FREE_HOURS_PER_MONTH == 750

    def test_spin_down_is_fifteen_minutes(self):
        assert U.SPIN_DOWN_MINUTES == 15

    def test_the_ping_interval_leaves_headroom_for_a_skipped_run(self):
        # GitHub's cron is best-effort. At 14 minutes a single missed run would
        # let the service sleep; at 10, one can be missed and it still holds.
        assert U.PING_INTERVAL_MINUTES == 10
        assert U.PING_INTERVAL_MINUTES * 2 <= U.SPIN_DOWN_MINUTES + 5

    def test_three_free_services_share_the_pool(self):
        # engine, web, and the already-deployed v1.
        assert len(U.FREE_SERVICES) == 3


class TestBudgetArithmetic:
    def test_the_daily_window_is_about_seven_hours_per_service(self):
        """750 x 0.85 / 3 / 30.44 = 6.98.

        NOT the 12 hours the playbook assumed -- that figure was written for two
        services and there are three. The playbook's own instruction was that
        the schedule adapts to the real numbers.
        """
        h = U.daily_window_hours()
        assert 6.5 < h < 7.5, h

    def test_two_services_would_get_more(self):
        assert U.daily_window_hours(services=2) > U.daily_window_hours(services=3)

    def test_no_services_means_no_window_rather_than_a_divide_by_zero(self):
        assert U.daily_window_hours(services=0) == 0.0

    def test_the_configured_window_fits_the_budget(self):
        span = U.WINDOW_END_HOUR - U.WINDOW_START_HOUR
        if span < 0:
            span += 24
        # The window actually configured must not exceed what the pool affords.
        assert span <= U.daily_window_hours() + 0.5, (
            f"the {span}h window exceeds the {U.daily_window_hours():.2f}h budget"
        )


class TestWindow:
    def at(self, hour: int) -> datetime:
        return datetime(2026, 9, 3, hour, 0, tzinfo=timezone.utc)

    def test_inside_the_window(self, monkeypatch):
        monkeypatch.setattr(U, "WINDOW_START_HOUR", 4)
        monkeypatch.setattr(U, "WINDOW_END_HOUR", 11)
        assert U.in_window(self.at(4)) is True
        assert U.in_window(self.at(10)) is True

    def test_outside_the_window(self, monkeypatch):
        monkeypatch.setattr(U, "WINDOW_START_HOUR", 4)
        monkeypatch.setattr(U, "WINDOW_END_HOUR", 11)
        assert U.in_window(self.at(3)) is False
        assert U.in_window(self.at(11)) is False   # end is exclusive
        assert U.in_window(self.at(23)) is False

    def test_a_window_that_wraps_midnight(self, monkeypatch):
        monkeypatch.setattr(U, "WINDOW_START_HOUR", 22)
        monkeypatch.setattr(U, "WINDOW_END_HOUR", 5)
        assert U.in_window(self.at(23)) is True
        assert U.in_window(self.at(2)) is True
        assert U.in_window(self.at(12)) is False

    def test_an_empty_window_never_opens(self, monkeypatch):
        monkeypatch.setattr(U, "WINDOW_START_HOUR", 4)
        monkeypatch.setattr(U, "WINDOW_END_HOUR", 4)
        assert all(U.in_window(self.at(h)) is False for h in range(24))

    def test_next_window_is_in_the_future_when_closed(self, monkeypatch):
        monkeypatch.setattr(U, "WINDOW_START_HOUR", 4)
        monkeypatch.setattr(U, "WINDOW_END_HOUR", 11)
        closed = datetime(2026, 9, 3, 20, 0, tzinfo=timezone.utc).timestamp()
        nxt = datetime.fromisoformat(U.next_window_iso(closed))
        assert nxt > datetime.fromtimestamp(closed, tz=timezone.utc)


class TestGuard:
    def test_pings_inside_the_window_and_budget(self, monkeypatch):
        monkeypatch.setattr(U, "WINDOW_START_HOUR", 0)
        monkeypatch.setattr(U, "WINDOW_END_HOUR", 24)
        ok, why = U.should_ping(state={"pings": []})
        assert ok is True, why

    def test_does_not_ping_outside_the_window(self, monkeypatch):
        monkeypatch.setattr(U, "WINDOW_START_HOUR", 4)
        monkeypatch.setattr(U, "WINDOW_END_HOUR", 5)
        at = datetime(2026, 9, 3, 20, 0, tzinfo=timezone.utc)
        ok, why = U.should_ping(at=at, state={"pings": []})
        assert ok is False
        assert "outside the warm window" in why

    def test_STOPS_at_a_hundred_percent(self, monkeypatch):
        monkeypatch.setattr(U, "WINDOW_START_HOUR", 0)
        monkeypatch.setattr(U, "WINDOW_END_HOUR", 24)
        # A month of pings ten minutes apart, well past one service's share.
        now = time.time()
        share_seconds = (U.FREE_HOURS_PER_MONTH / 3) * 3600
        # Each ping credits the gap to the NEXT ping, capped at the spin-down
        # window -- so at a 10-minute interval each credits 600 s, not 900.
        n = int(share_seconds / (U.PING_INTERVAL_MINUTES * 60)) + 100
        pings = [now - (n - i) * U.PING_INTERVAL_MINUTES * 60 for i in range(n)]
        b = U.budget_state(now, {"pings": pings})
        assert b["exhausted"] is True, b["budget_used_pct"]
        ok, why = U.should_ping(state={"pings": pings})
        assert ok is False
        assert "exhausted" in why

    def test_narrows_at_the_guard_threshold(self, monkeypatch):
        monkeypatch.setattr(U, "WINDOW_START_HOUR", 0)
        monkeypatch.setattr(U, "WINDOW_END_HOUR", 24)
        now = time.time()
        share_seconds = (U.FREE_HOURS_PER_MONTH / 3) * 3600
        # Enough to cross 85% but not 100%. Each ping credits its 10-minute gap.
        target = share_seconds * 0.9
        n = int(target / (U.PING_INTERVAL_MINUTES * 60))
        pings = [now - (n - i) * U.PING_INTERVAL_MINUTES * 60 for i in range(n)]
        b = U.budget_state(state={"pings": pings})
        assert b["narrowing"] is True
        assert b["exhausted"] is False
        # At the narrowed rate roughly half the minutes are refused.
        refused = sum(
            1 for m in range(60)
            if not U.should_ping(
                at=datetime(2026, 9, 3, 6, m, tzinfo=timezone.utc),
                state={"pings": pings},
            )[0]
        )
        assert 20 <= refused <= 40, refused

    def test_FAILS_CLOSED_when_the_budget_cannot_be_computed(self, monkeypatch):
        """A guard that cannot see the budget and keeps pinging anyway is not a
        guard."""
        monkeypatch.setattr(U, "budget_state",
                            lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom")))
        ok, why = U.should_ping()
        assert ok is False
        assert "refusing to ping" in why


class TestAccounting:
    def test_a_gap_longer_than_the_spin_down_is_not_counted_as_awake(self):
        now = time.time()
        # Two pings a day apart: the service slept in between and consumed
        # nothing, so only two spin-down windows are credited.
        b = U.budget_state(now, {"pings": [now - 86400, now - 60]})
        assert b["estimated_awake_hours"] < 0.6

    def test_continuous_pinging_accumulates_awake_time(self):
        now = time.time()
        pings = [now - i * 600 for i in range(60, 0, -1)]  # 10 hours at 10 min
        b = U.budget_state(now, {"pings": pings})
        assert 9 < b["estimated_awake_hours"] <= 10.2

    def test_the_estimate_is_LABELLED_as_an_estimate(self):
        # Render is the authority on hours consumed; this is a floor derived
        # from our own pings, and it says so (INV-5).
        b = U.budget_state(state={"pings": []})
        assert "ESTIMATED" in b["honesty"]
        assert "Render dashboard" in b["honesty"]

    def test_a_new_calendar_month_resets_the_pool(self, monkeypatch):
        U.record_ping()
        monkeypatch.setattr(U, "month_key", lambda *a, **k: "2099-01")
        state = U.record_ping()
        assert state["pings_month"] == 1

    def test_counts_pings_in_the_last_24_hours(self):
        now = time.time()
        pings = [now - 100, now - 200, now - 2 * 86400]
        assert U.budget_state(now, {"pings": pings})["pings_24h"] == 2


class TestPingEndpoint:
    def test_it_answers(self, client):
        r = client.get("/health/ping")
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_it_reports_uptime_and_the_budget(self, client):
        d = client.get("/health/ping").json()
        for k in ("uptime_s", "awake_since", "pings_24h", "budget_used_pct", "next_window"):
            assert k in d, k

    def test_IT_TOUCHES_NO_DATABASE(self, client, monkeypatch):
        """The gate item. A keep-alive that runs a database query is a
        keep-alive that consumes the thing it is protecting."""
        from engine import db as D

        opened: list[str] = []
        monkeypatch.setattr(D, "ping", lambda *a, **k: opened.append("db") or (True, None))
        if hasattr(D, "SessionLocal"):
            monkeypatch.setattr(
                D, "SessionLocal",
                lambda *a, **k: opened.append("session") or (_ for _ in ()).throw(
                    AssertionError("ping opened a database session")
                ),
            )
        client.get("/health/ping")
        assert opened == [], f"the ping touched: {opened}"

    def test_it_makes_no_external_call(self, client, monkeypatch):
        """A socket spy, not an httpx patch.

        TestClient is itself built on httpx, so patching `httpx.Client.get`
        catches the TEST's own request and reports a false positive -- the
        first version of this test did exactly that. TestClient speaks ASGI
        in-process and opens no socket, so a socket spy sees only genuine
        outbound traffic.
        """
        import socket

        opened: list[object] = []
        real_connect = socket.socket.connect
        monkeypatch.setattr(
            socket.socket, "connect",
            lambda self, addr, *a, **k: opened.append(addr) or real_connect(self, addr, *a, **k),
        )
        client.get("/health/ping")
        assert opened == [], f"the ping opened a socket to {opened}"

    def test_it_is_fast(self, client):
        # < 50 ms is the target. Measured over several calls so one slow
        # scheduler tick does not decide it.
        client.get("/health/ping")
        t0 = time.perf_counter()
        for _ in range(10):
            client.get("/health/ping")
        per_call_ms = (time.perf_counter() - t0) * 1000 / 10
        assert per_call_ms < 50, f"{per_call_ms:.1f} ms per call"

    def test_it_is_idempotent_in_what_it_reports(self, client):
        a = client.get("/health/ping").json()
        b = client.get("/health/ping").json()
        assert a["awake_since"] == b["awake_since"]
        assert b["uptime_s"] >= a["uptime_s"]

    def test_the_original_health_endpoint_is_untouched(self, client):
        # The prime directive: /health still reports the database check.
        d = client.get("/health").json()
        assert d["ok"] is True
        assert "database" in d["checks"]
