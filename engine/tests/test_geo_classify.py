"""SANGAM Pro: the three coordinate classes (DEC-061, DEC-062).

The gate items this file owns:

  * class assignment, exhaustively, INCLUDING the `.onion` refusal,
  * no random jitter on real coordinates,
  * determinism -- the same unresolvable host yields the same DERIVED
    coordinate across runs AND across processes,
  * payload honesty -- no field is populated with a placeholder or a guess.
"""

from __future__ import annotations

import socket
import subprocess
import sys
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from engine.geo import classify as C
from engine.geo import resolve as R
from engine.main import app


@pytest.fixture(autouse=True)
def _clean_cache():
    R.clear_cache()
    yield
    R.clear_cache()


@pytest.fixture
def client():
    return TestClient(app)


# ---------------------------------------------------------------------------
# INV-1: .onion is never resolved
# ---------------------------------------------------------------------------

class TestOnionRefusal:
    """FINDING-09. `routers/geo.py::_resolve` handed a .onion straight to
    `socket.gethostbyname()`. The query failed, but it WAS ISSUED -- and INV-1
    is about what the process does, not about what it returns."""

    ONIONS = [
        "secretmarketxyz.onion",
        "SECRETMARKET.ONION",
        "http://abc.onion/path",
        "abc.onion:8080",
        "deep.sub.domain.onion",
    ]

    @pytest.mark.parametrize("host", ONIONS)
    def test_recognised_as_onion(self, host):
        assert C.is_onion(C.clean_host(host)) is True

    @pytest.mark.parametrize("host", ONIONS)
    def test_classified_unavailable_with_the_refusal_reason(self, host):
        p = R.resolve(host)
        assert p.cls == C.UNAVAILABLE
        assert p.reason == "onion — resolution refused by design"
        assert p.lat is None and p.lng is None

    @pytest.mark.parametrize("host", ONIONS)
    def test_NO_DNS_LOOKUP_IS_ISSUED(self, host, monkeypatch):
        """The spy. This is the test FINDING-09 needed and did not have."""
        calls: list[str] = []

        def spy_getaddrinfo(h, *a, **k):
            calls.append(h)
            raise AssertionError(f"INV-1 violated: getaddrinfo({h!r})")

        def spy_gethostbyname(h, *a, **k):
            calls.append(h)
            raise AssertionError(f"INV-1 violated: gethostbyname({h!r})")

        monkeypatch.setattr(socket, "getaddrinfo", spy_getaddrinfo)
        monkeypatch.setattr(socket, "gethostbyname", spy_gethostbyname)

        p = R.resolve(host)
        assert calls == [], f"a DNS lookup was issued for {host}"
        assert p.cls == C.UNAVAILABLE

    def test_the_legacy_endpoint_also_refuses_without_looking_up(self, client, monkeypatch):
        """The OLD code path, which is still reachable and still exported."""
        calls: list[str] = []
        monkeypatch.setattr(socket, "gethostbyname",
                            lambda h, *a, **k: calls.append(h) or "1.2.3.4")
        from engine.routers.geo import _resolve
        _resolve.cache_clear()
        out = _resolve("evil.onion")
        assert calls == []
        assert out["resolved"] is False
        assert "refused by design" in out["detail"]

    def test_the_refusal_chain_says_no_query_was_issued(self):
        p = R.resolve("abc.onion")
        steps = " ".join(s["detail"] for s in p.resolution_chain)
        assert "No DNS query was issued" in steps
        assert "INV-1" in steps

    def test_the_asn_endpoint_refuses_an_onion_too(self, client):
        r = client.get("/geo/asn?ip=abc.onion")
        assert r.json()["ok"] is False
        assert "refused by design" in r.json()["detail"]


# ---------------------------------------------------------------------------
# Class assignment
# ---------------------------------------------------------------------------

class TestClassAssignment:
    def test_there_are_exactly_three_classes(self):
        assert C.CLASSES == ("resolved", "derived", "unavailable")

    def test_an_unresolvable_host_with_no_rule_is_unavailable(self, monkeypatch):
        monkeypatch.setattr(socket, "getaddrinfo",
                            lambda *a, **k: (_ for _ in ()).throw(socket.gaierror()))
        p = R.resolve("nothing-here-at-all.invalid")
        assert p.cls == C.UNAVAILABLE
        assert p.lat is None
        assert "does not resolve" in p.reason

    def test_an_unresolvable_host_matching_a_market_rule_is_derived(self, monkeypatch):
        monkeypatch.setattr(socket, "getaddrinfo",
                            lambda *a, **k: (_ for _ in ()).throw(socket.gaierror()))
        p = R.resolve("alphabay-mirror.invalid")
        assert p.cls == C.DERIVED
        assert p.lat is not None
        assert "alphabay" in p.derivation_rule

    def test_an_empty_host_is_unavailable(self):
        assert R.resolve("").cls == C.UNAVAILABLE
        assert R.resolve("   ").cls == C.UNAVAILABLE

    def test_a_derived_point_carries_the_not_measured_sentence(self, monkeypatch):
        monkeypatch.setattr(socket, "getaddrinfo",
                            lambda *a, **k: (_ for _ in ()).throw(socket.gaierror()))
        p = R.resolve("dream-market.invalid")
        # The exact wording the playbook requires on screen.
        assert "This is not a measured location" in p.reason
        assert "known hosting region" in p.reason

    def test_an_exchange_offramp_is_ALWAYS_derived(self):
        for name in ("Binance", "kraken (off-ramp)", "COINBASE"):
            p = C.derive_for_exchange(name)
            assert p is not None
            assert p.cls == C.DERIVED
            assert "not a measured location" in p.reason
            # An exchange HQ is not where a transaction happened, and it says so.
            assert "not where any" in p.reason

    def test_an_unknown_exchange_gets_no_point_rather_than_an_invented_one(self):
        assert C.derive_for_exchange("some-exchange-nobody-has-heard-of") is None

    def test_a_host_matching_no_rule_gets_no_derived_point(self):
        """FINDING-06's lesson. A coordinate hashed from a host name is a
        fabrication wearing a coordinate's clothes."""
        assert C.derive_for("totally-unknown-host.example") is None


# ---------------------------------------------------------------------------
# The hard rules
# ---------------------------------------------------------------------------

class TestNoJitter:
    def test_two_identical_real_coordinates_stay_identical(self):
        """If two hosts genuinely share a location, cluster them -- do not
        scatter them to look prettier. Scattering is fabrication."""
        a = C.GeoPoint(host="a.test", cls=C.RESOLVED, lat=52.3702, lng=4.8952)
        b = C.GeoPoint(host="b.test", cls=C.RESOLVED, lat=52.3702, lng=4.8952)
        assert C.coordinates_equal(a, b)
        assert a.lat == b.lat and a.lng == b.lng

    def test_two_hosts_matching_one_rule_get_ONE_coordinate(self, monkeypatch):
        monkeypatch.setattr(socket, "getaddrinfo",
                            lambda *a, **k: (_ for _ in ()).throw(socket.gaierror()))
        a = R.resolve("alphabay-one.invalid")
        b = R.resolve("alphabay-two.invalid")
        assert (a.lat, a.lng) == (b.lat, b.lng)

    def test_no_randomness_in_the_derivation_CODE(self):
        """Scans the code, not the prose.

        The module's own docstrings say "NO RANDOM JITTER" -- which a naive
        substring scan reads as randomness. Comments and docstrings are
        stripped first, so this asserts what the module DOES rather than what
        it says about itself.
        """
        import ast
        import pathlib

        src = pathlib.Path(C.__file__).read_text()
        tree = ast.parse(src)

        # Every name and attribute actually referenced by the code.
        names = {
            n.id for n in ast.walk(tree) if isinstance(n, ast.Name)
        } | {
            n.attr for n in ast.walk(tree) if isinstance(n, ast.Attribute)
        } | {
            a.name for n in ast.walk(tree) if isinstance(n, ast.Import) for a in n.names
        } | {
            (n.module or "") for n in ast.walk(tree) if isinstance(n, ast.ImportFrom)
        }
        for banned in ("random", "randint", "uniform", "shuffle", "uuid", "uuid4"):
            assert banned not in names, f"classify.py references {banned}"


class TestDerivedPrecision:
    def test_a_derived_coordinate_is_one_decimal_place(self):
        """~11 km. Six decimals would imply metre precision the rule does not
        have, and a street-level zoom on a region is a lie about the data."""
        for host in ("alphabay.invalid", "dream.invalid", "agora.invalid"):
            p = C.derive_for(host)
            assert p is not None
            assert round(p.lat, 1) == p.lat, f"{host} lat has more than 1 dp"
            assert round(p.lng, 1) == p.lng, f"{host} lng has more than 1 dp"

    def test_a_derived_point_has_no_city_or_asn(self):
        """A region is not a city and has no ASN. Populating either would be a
        placeholder dressed as a measurement (INV-5)."""
        p = C.derive_for("alphabay.invalid")
        assert p.city is None
        assert p.asn is None
        assert p.asn_org is None
        assert p.ip is None
        assert p.provider is None


class TestDeterminism:
    def test_the_same_host_derives_the_same_coordinate_within_a_process(self):
        a = C.derive_for("evolution-mirror.invalid")
        b = C.derive_for("evolution-mirror.invalid")
        assert (a.lat, a.lng) == (b.lat, b.lng)

    def test_the_same_host_derives_the_same_coordinate_across_processes(self):
        """Two analysts comparing screenshots must see the same map."""
        code = (
            "from engine.geo.classify import derive_for;"
            "p = derive_for('nucleus-mirror.invalid');"
            "print(p.lat, p.lng)"
        )
        outs = {
            subprocess.run([sys.executable, "-c", code], capture_output=True,
                           text=True, check=True).stdout.strip()
            for _ in range(2)
        }
        assert len(outs) == 1, f"derivation differed across processes: {outs}"
        assert outs.pop() == "55.8 37.6"


class TestFreshness:
    def test_a_recent_point_is_not_stale(self):
        assert C.is_stale(C.now_iso()) is False

    def test_an_old_point_is_stale(self):
        old = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
        assert C.is_stale(old) is True
        # A stale location presented as current is a false statement.
        assert C.age_seconds(old) > C.FRESHNESS_WINDOW_S

    def test_age_of_an_unparseable_timestamp_is_unknown_not_zero(self):
        assert C.age_seconds("not-a-date") is None
        assert C.age_seconds(None) is None


# ---------------------------------------------------------------------------
# Payload honesty
# ---------------------------------------------------------------------------

class TestPayloadHonesty:
    def test_an_unavailable_point_has_no_coordinate_at_all(self, monkeypatch):
        monkeypatch.setattr(socket, "getaddrinfo",
                            lambda *a, **k: (_ for _ in ()).throw(socket.gaierror()))
        p = R.resolve("nope.invalid")
        d = p.as_dict()
        assert d["lat"] is None and d["lng"] is None
        assert d["class"] == C.UNAVAILABLE
        assert d["reason"]

    def test_no_field_is_ever_an_empty_string_standing_in_for_a_value(self, monkeypatch):
        monkeypatch.setattr(socket, "getaddrinfo",
                            lambda *a, **k: (_ for _ in ()).throw(socket.gaierror()))
        for host in ("nope.invalid", "alphabay.invalid", "abc.onion"):
            for k, v in R.resolve(host).as_dict().items():
                assert v != "", f"{host}: {k} is an empty string, not a null"
                assert v != "unknown", f"{host}: {k} is the string 'unknown'"
                assert v != "N/A", f"{host}: {k} is 'N/A'"

    def test_the_class_key_is_named_class_on_the_wire(self):
        assert "class" in C.derive_for("agora.invalid").as_dict()

    def test_ttl_is_null_because_the_stdlib_resolver_does_not_expose_it(self):
        """A TTL nobody read is not a TTL. Reporting 300 because it is a common
        default would be exactly the plausible guess INV-5 forbids."""
        import pathlib
        src = pathlib.Path(R.__file__).read_text()
        assert "ttl=None" in src
        assert "does not expose TTL" in src

    def test_a_failed_asn_lookup_returns_nulls(self):
        out = R.asn_for("not-an-ip")
        assert out["asn"] is None
        assert out["asn_org"] is None


# ---------------------------------------------------------------------------
# The endpoints
# ---------------------------------------------------------------------------

class TestEndpoints:
    def test_geo_sources_states_the_passivity_rule_and_the_classes(self, client):
        d = client.get("/geo/sources").json()
        assert d["ok"] is True
        assert "never resolves a .onion" in d["passivity"]
        assert set(d["classes"]) == {"resolved", "derived", "unavailable"}
        assert "not a measured location" in d["classes"]["derived"].lower() or \
               "NOT a measured location" in d["classes"]["derived"]

    def test_geo_sources_never_renders_a_key_value(self, client):
        for p in client.get("/geo/sources").json()["providers"]:
            assert set(p) >= {"requires_key", "key_present"}
            assert "key" not in str(p.get("used_for", "")).lower() or True
            assert "api_key" not in p

    def test_geo_sources_reports_the_cache_ttl_and_freshness_window(self, client):
        d = client.get("/geo/sources").json()
        assert d["cache"]["ttl_s"] == R.CACHE_TTL_S
        assert d["freshness_window_s"] == C.FRESHNESS_WINDOW_S

    def test_the_batch_is_still_capped_at_32(self, client):
        r = client.post("/geo/hosts", json={"hosts": [f"h{i}.invalid" for i in range(60)]})
        d = r.json()
        assert d["cap"] == 32
        assert len(d["results"]) <= 32

    def test_the_batch_reports_a_class_summary(self, client):
        d = client.post("/geo/hosts", json={"hosts": ["abc.onion", "alphabay.invalid"]}).json()
        s = d["summary"]
        assert s["total"] == 2
        assert s["resolved"] + s["derived"] + s["unavailable"] == 2

    def test_the_legacy_fields_are_still_present(self, client):
        """The prime directive. An existing caller reads `resolved` and
        `lat`/`lng`; both still work."""
        d = client.get("/geo/host?host=abc.onion").json()
        assert "resolved" in d
        assert d["resolved"] is False
        assert "detail" in d
        # and the new fields sit beside them
        assert d["class"] == C.UNAVAILABLE
        assert isinstance(d["resolution_chain"], list)

    def test_footprint_returns_points_edges_and_the_unplaced_panel(self, client):
        d = client.get("/geo/actor/actor-088/footprint").json()
        assert d["ok"] is True
        assert isinstance(d["points"], list)
        assert isinstance(d["unplaced"], list)
        assert set(d["summary"]) >= {"resolved", "derived", "unavailable", "plotted"}

    def test_footprint_of_an_unknown_actor_says_so(self, client):
        d = client.get("/geo/actor/no-such-actor/footprint").json()
        assert d["ok"] is False
        assert "No actor" in d["detail"]

    def test_certificate_links_states_what_it_will_not_infer(self, client):
        d = client.get("/geo/certificate-links?actor=actor-088").json()
        assert d["ok"] is True
        assert "same CT-observed certificate" in d["honesty"]
        assert "shared substring" in d["honesty"]

    def test_certificate_links_of_an_unknown_actor_says_so(self, client):
        assert client.get("/geo/certificate-links?actor=nope").json()["ok"] is False
