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
    with client() as c:
        body = c.get("/feed").json()
    assert body["ok"] is True
    assert body["items"] == []
    assert body["count"] == 0
    # An honest empty state, never an error - the DATASET-mode acceptance test.
    assert body["detail"]


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
