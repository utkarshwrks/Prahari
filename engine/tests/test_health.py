"""The engine must answer /health and /version under every degradation."""

from __future__ import annotations

from fastapi.testclient import TestClient

from engine.main import create_app


def client() -> TestClient:
    return TestClient(create_app())


def test_health_returns_200():
    with client() as c:
        r = c.get("/health")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_health_reports_service_identity():
    with client() as c:
        body = c.get("/health").json()
    assert body["service"] == "prahari-engine"
    assert body["version"]
    assert "environment" in body


def test_health_reports_database_check_shape():
    with client() as c:
        checks = c.get("/health").json()["checks"]
    assert "database" in checks
    assert isinstance(checks["database"]["ok"], bool)


def test_health_is_200_even_when_database_is_unreachable(monkeypatch):
    """The engine being up and the database being up are different facts.

    The workbench needs to tell 'engine offline' from 'database offline' to
    degrade honestly, so /health stays 200 and puts the truth in the body.
    """
    monkeypatch.setattr("engine.routers.health.ping", lambda: (False, "ConnectionRefused"))
    with client() as c:
        r = c.get("/health")
    assert r.status_code == 200
    assert r.json()["ok"] is True
    assert r.json()["checks"]["database"]["ok"] is False
    assert r.json()["checks"]["database"]["error"] == "ConnectionRefused"


def test_health_reports_scheduler_running():
    with client() as c:
        sched = c.get("/health").json()["scheduler"]
    assert sched["running"] is True
    assert "heartbeat" in sched["jobs"]


def test_version_lists_capabilities():
    with client() as c:
        body = c.get("/version").json()
    caps = body["capabilities"]
    for name in ("llm_extraction", "chain_eth", "infra_shodan", "anchoring"):
        assert name in caps
        assert isinstance(caps[name]["enabled"], bool)
        # Every disabled capability must say why, in words a human can act on.
        assert caps[name]["detail"]


def test_feed_returns_v1_intercept_envelope():
    """Phase 3 replaced the empty stub with real Agora listings."""
    with client() as c:
        body = c.get("/feed?limit=5").json()
    assert body["ok"] is True
    assert isinstance(body["items"], list)
    assert body["count"] == len(body["items"])
    if body["items"]:
        item = body["items"][0]
        for k in ("id", "source", "rawText", "entities", "severity"):
            assert k in item
    else:
        # No fixture present: must still be an honest empty state, not an error.
        assert body["detail"]


def test_feed_declares_that_the_dataset_is_not_geofenced():
    """DEC-018: Agora carries no MP geography. The payload says so explicitly so
    the UI cannot imply a DATASET item breached the Jabalpur zone."""
    with client() as c:
        body = c.get("/feed?limit=5").json()
    assert body["geofenced"] is False
    for item in body["items"]:
        assert item["entities"]["locations"] == []


def test_feed_respects_limit_bounds():
    with client() as c:
        assert c.get("/feed?limit=1").status_code == 200
        assert c.get("/feed?limit=100").status_code == 200
        assert c.get("/feed?limit=0").status_code == 422
        assert c.get("/feed?limit=101").status_code == 422


def test_unknown_route_is_json_not_html():
    """The workbench must never receive an HTML error page from the engine."""
    with client() as c:
        r = c.get("/no-such-endpoint")
    assert r.status_code == 404
    assert r.headers["content-type"].startswith("application/json")


def test_unconfigured_database_is_reported_as_expected_not_broken(monkeypatch):
    """No DATABASE_URL is a deployment fact, not an incident.

    On the free Render plan no Postgres is attached, and only /sources reads
    one. Reporting that as a bare OperationalError made a healthy engine look
    broken to anyone who opened /health, so the check now says which surface
    degrades and that nothing on the demo path does.
    """
    monkeypatch.setattr("engine.routers.health.ping", lambda: (False, "ConnectionRefused"))
    with client() as c:
        db = c.get("/health").json()["checks"]["database"]
    assert db["ok"] is False            # still the truth
    assert db["error"] == "ConnectionRefused"   # still passed through verbatim
    assert db["configured"] is False
    assert db["required"] is False
    assert "only /sources" in db["detail"].lower()


def test_configured_but_unreachable_database_is_still_a_real_problem(monkeypatch):
    """The inverse case must NOT be softened.

    If somebody set DATABASE_URL and Postgres is down, that is an outage and
    has to read as one. A check that calls every failure expected would be
    just as useless as one that calls every failure fatal.
    """
    from engine import settings as S

    monkeypatch.setattr("engine.routers.health.ping", lambda: (False, "ConnectionRefused"))
    monkeypatch.setattr(S.Settings, "database_configured", property(lambda self: True))
    S.get_settings.cache_clear()
    try:
        with client() as c:
            db = c.get("/health").json()["checks"]["database"]
        assert db["ok"] is False
        assert db["configured"] is True
        assert db["required"] is True
        assert "unreachable" in db["detail"].lower()
    finally:
        S.get_settings.cache_clear()


def test_version_reports_database_capability():
    with client() as c:
        caps = c.get("/version").json()["capabilities"]
    assert "database" in caps
    assert isinstance(caps["database"]["enabled"], bool)
    assert caps["database"]["detail"]
