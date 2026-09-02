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

    def test_the_ping_interval_leaves_headroom_for_TWO_skipped_runs(self):
        # The interval costs nothing -- Render bills hours awake, not requests
        # -- so it is chosen purely for reliability. GitHub's scheduler is
        # best-effort and routinely late; five minutes survives two consecutive
        # misses against the 15-minute timeout (DEC-067).
        assert U.PING_INTERVAL_MINUTES == 5
        assert U.PING_INTERVAL_MINUTES * 3 <= U.SPIN_DOWN_MINUTES

    def test_only_the_kept_warm_services_divide_the_share(self):
        """The lever that sets window length.

        Three services share the pool, but the divisor is how many this
        keep-alive keeps AWAKE. v1 is opt-in, so it is two -- and that single
        fact is the difference between a seven-hour window and a ten-hour one.
        """
        assert U.KEPT_WARM_SERVICES == 2
        assert U.KEPT_WARM_SERVICES < len(U.FREE_SERVICES)

    def test_the_engine_and_the_workflow_agree(self):
        """An engine reporting a stricter budget than the workflow enforces
        sends anyone reading /health/ping to the wrong conclusion. These two
        files are edited separately, so the agreement is asserted."""
        import pathlib
        import re

        wf = pathlib.Path(__file__).resolve().parents[2] / ".github/workflows/keepalive.yml"
        text = wf.read_text()

        def env(key: str) -> int:
            m = re.search(rf'^  {key}: "(\d+)"', text, re.M)
            assert m, f"{key} not found in the workflow"
            return int(m.group(1))

        assert env("KEPT_WARM") == U.KEPT_WARM_SERVICES
        assert env("WINDOW_START") == U.WINDOW_START_HOUR
        assert env("WINDOW_END") == U.WINDOW_END_HOUR
        # And the cron interval matches PING_INTERVAL_MINUTES.
        cron = re.search(r'cron: "\*/(\d+) ', text)
        assert cron and int(cron.group(1)) == U.PING_INTERVAL_MINUTES

    def test_three_free_services_share_the_pool(self):
        # engine, web, and the already-deployed v1.
        assert len(U.FREE_SERVICES) == 3


class TestBudgetArithmetic:
    def test_the_daily_window_is_about_ten_hours_per_kept_warm_service(self):
        """750 x 0.85 / 2 / 30.44 = 10.47.

        NOT the 12 hours the playbook assumed, and no longer the 6.98 of the
        first cut either. Three services share the POOL, but only two are kept
        WARM -- v1 is opt-in -- and it is the kept-warm count that divides
        (DEC-067).
        """
        h = U.daily_window_hours()
        assert 10.0 < h < 11.0, h

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
        # A month of pings at the real interval, well past one service's share.
        now = time.time()
        share_seconds = (U.FREE_HOURS_PER_MONTH / U.KEPT_WARM_SERVICES) * 3600
        # Each ping credits the gap to the NEXT ping, capped at the spin-down
        # window -- so at a 5-minute interval each credits 300 s, not 900.
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
        share_seconds = (U.FREE_HOURS_PER_MONTH / U.KEPT_WARM_SERVICES) * 3600
        # Enough to cross 85% but not 100%. Each ping credits its own gap.
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


class TestDiagnostics:
    """`GET /health/diagnostics` (DEC-066).

    Waking a service is not the same as making it fast. This endpoint exists to
    say WHICH of the three delays is currently true -- cold start, cold caches,
    or a dependency down -- so "the deployed one is slow" stops being a guess.
    """

    def test_it_names_which_caches_are_warm(self, client):
        r = client.get("/health/diagnostics")
        assert r.status_code == 200
        caches = r.json()["caches"]
        assert "signals" in caches
        assert "actors_index" in caches

    def test_warmth_is_read_from_the_lru_cache_itself(self):
        """NOT from a module global.

        The first version of this endpoint read `getattr(eval, "_SIGNALS")` and
        `getattr(actors, "_INDEX")`. Neither global exists -- both functions are
        `@lru_cache(maxsize=1)` -- so the endpoint reported every cache as cold
        forever, which is worse than no endpoint at all: a diagnostic that is
        always wrong sends you looking in the wrong place.
        """
        from engine.fusion import eval as _eval
        from engine.engines import actors as _actors

        assert hasattr(_eval.build_signals, "cache_info")
        assert hasattr(_actors._index, "cache_info")
        assert not hasattr(_eval, "_SIGNALS")
        assert not hasattr(_actors, "_INDEX")

    def test_reading_diagnostics_does_not_itself_warm_anything(self, client):
        """A diagnostic that warms what it measures can never report cold."""
        from engine.fusion import eval as _eval

        before = _eval.build_signals.cache_info()
        client.get("/health/diagnostics")
        after = _eval.build_signals.cache_info()
        assert after.misses == before.misses

    def test_the_verdict_is_one_of_the_three_known_states(self, client):
        assert client.get("/health/diagnostics").json()["verdict"] in {
            "warm",
            "cold-start",
            "degraded",
        }

    def test_it_explains_the_verdict_in_words(self, client):
        # A judge reading this should not need the source to interpret it.
        assert len(client.get("/health/diagnostics").json()["detail"]) > 20

    def test_it_resolves_no_onion_host(self, client):
        # INV-1 holds everywhere, diagnostics included.
        body = client.get("/health/diagnostics").text
        assert ".onion" not in body


class TestWarm:
    """`POST /health/warm` -- the thing that makes live data fast."""

    def test_it_warms_every_cache_the_first_page_needs(self, client):
        r = client.post("/health/warm")
        assert r.status_code == 200
        assert r.json()["warmed"] is True
        for cache in ("signals", "calibrator", "actors_index"):
            assert cache in r.json()["detail"]

    def test_after_warming_the_diagnostics_report_warm(self, client):
        client.post("/health/warm")
        assert client.get("/health/diagnostics").json()["verdict"] == "warm"

    def test_the_cheap_ping_does_NOT_warm(self, client):
        """`/health/ping` runs every five minutes and must stay trivial.

        If the ping warmed caches it would rebuild them continuously for the
        whole window, burning CPU on a free instance for no benefit. Warming is
        a separate, once-per-window call for exactly this reason.
        """
        import inspect
        from engine.routers import health as H

        src = inspect.getsource(H)
        ping = src[src.index("def ping") : src.index("def diagnostics")]
        for expensive in ("build_signals", "ensure_calibrated", "list_actors"):
            assert expensive not in ping


def _warm_source() -> str:
    """The body of the nested `_warm` in engine.main.

    Sliced by INDENTATION rather than by a blank line -- `_warm` contains blank
    lines inside its own comments, and a naive slice at the first one silently
    truncated this check to four lines and made it pass for the wrong reason.
    """
    import inspect
    import textwrap

    from engine import main as M

    lines = inspect.getsource(M).splitlines()
    start = next(i for i, l in enumerate(lines) if l.strip().startswith("def _warm"))
    indent = len(lines[start]) - len(lines[start].lstrip())
    out = [lines[start]]
    for line in lines[start + 1 :]:
        if line.strip() and (len(line) - len(line.lstrip())) <= indent:
            break
        out.append(line)
    return textwrap.dedent("\n".join(out))


class TestStartupWarmsTheActorsIndex:
    """DEC-066 -- the actual cause of "slow on deploy, fast locally".

    The startup routine warmed `build_signals()` and the calibrator but not the
    actors index. `/actors` is the FIRST call the workbench, the actor list and
    SANGAM all make, so every cold start paid to rebuild that index while the
    engine's own health check reported it warm.
    """

    def test_the_startup_routine_warms_the_actors_index(self):
        warm = _warm_source()
        assert "build_signals" in warm
        assert "ensure_calibrated" in warm
        assert "list_actors" in warm, (
            "the actors index is not warmed at startup; every cold start will "
            "rebuild it on the first /actors call"
        )

    def test_warming_failure_is_never_fatal(self):
        # Warming is an optimisation. An engine that refuses to boot because a
        # cache would not build is strictly worse than a slow one.
        assert "except Exception" in _warm_source()
