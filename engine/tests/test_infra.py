"""Infrastructure fingerprinting, and the passivity rule.

The most important tests in this file are not about accuracy. They assert that
PRAHARI cannot connect to a hidden service, because that claim is the entire
legal and ethical basis of the project. An accuracy regression is a bug; a
passivity regression is a different product.
"""

from __future__ import annotations

import socket

import pytest

from engine.engines import infra as I
from engine.engines.infra_testbed import LEAK_DOMAIN, infra_fixture

# --------------------------------------------------------------------------
# Passivity - the rule that cannot bend
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "url",
    [
        "http://abcdefghijklmnopqrstuvwxyz234567abcdefghijklmnopqrstuvwx.onion",
        "https://example.onion/path",
        "https://SHOP.ONION",
        "http://user:pass@thing.onion:8080/x?y=1",
    ],
)
def test_onion_requests_are_refused(url):
    with pytest.raises(I.OnionRequestBlocked):
        I.assert_not_onion(url)


@pytest.mark.parametrize(
    "url",
    ["https://crt.sh/?q=x", "https://api.certspotter.com/v1/issuances",
     "https://internetdb.shodan.io/1.1.1.1", "https://onion.example.com"],
)
def test_public_indexes_are_allowed(url):
    assert I.assert_not_onion(url) == url


def test_onion_lookalike_domain_is_not_blocked():
    """`onion.example.com` is a clearnet host. Over-blocking is also a bug."""
    assert I.assert_not_onion("https://onion.example.com/a")


def test_no_source_url_in_the_module_targets_an_onion():
    """Static sweep of the engine's own source."""
    import inspect
    import re

    src = inspect.getsource(I)
    assert not re.search(r"https?://[^\s\"']*\.onion", src)


def test_network_layer_blocks_onion_connections(monkeypatch):
    """Belt and braces: even if a URL slipped past the guard, prove no socket
    is opened to a .onion. Tor is not resolvable without a proxy anyway, but
    the assertion is the point -- it fails loudly if someone adds one."""
    attempted: list[str] = []
    real = socket.getaddrinfo

    def spy(host, *a, **kw):
        attempted.append(str(host))
        return real(host, *a, **kw)

    monkeypatch.setattr(socket, "getaddrinfo", spy)

    fx = infra_fixture()
    I.match(fx["onion"], fx["observed"], fx["candidates"])  # full pivot path

    assert not [h for h in attempted if h.lower().endswith(".onion")]


def test_jarm_refuses_hosts_we_do_not_control():
    """DEC-028. An active probe against a target is a scan."""
    r = I.jarm("example.com")
    assert r["ok"] is False
    assert r["skipped"] is True
    assert "do not control" in r["detail"]


def test_match_never_returns_an_onion_as_a_clearnet_host():
    fx = infra_fixture()
    bad = fx["candidates"] + [{"host": "evil.onion", "banner": "nginx/1.24.0",
                               "source": "testbed"}]
    for p in I.match(fx["onion"], fx["observed"], bad):
        assert not p.clearnet_host.endswith(".onion")


# --------------------------------------------------------------------------
# Rule table and scoring
# --------------------------------------------------------------------------


def test_rule_strengths_match_the_playbook():
    assert I.RULE_STRENGTH["cert_sha256_reuse"] == 0.95
    assert I.RULE_STRENGTH["server_status_vhost"] == 0.90
    assert I.RULE_STRENGTH["cert_cn_san_match"] == 0.85
    assert I.RULE_STRENGTH["favicon_mmh3_match"] == 0.75
    assert I.RULE_STRENGTH["jarm_banner_match"] == 0.60
    assert I.RULE_STRENGTH["banner_only"] == 0.40


def test_testbed_infra_leak_resolves_to_the_planted_domain():
    fx = infra_fixture()
    pivots = I.match(fx["onion"], fx["observed"], fx["candidates"])
    assert pivots
    top = pivots[0]
    assert top.clearnet_host == LEAK_DOMAIN
    assert top.strength == 0.95


def test_leak_carries_the_cert_evidence_line():
    fx = infra_fixture()
    top = I.match(fx["onion"], fx["observed"], fx["candidates"])[0]
    rules = {e.rule for e in top.evidence}
    assert "cert_sha256_reuse" in rules
    assert "cert_cn_san_match" in rules


def test_a_shared_banner_alone_scores_weakly():
    """Same web server is not same operator. nginx is on millions of hosts."""
    fx = infra_fixture()
    pivots = I.match(fx["onion"], fx["observed"], fx["candidates"])
    weak = next(p for p in pivots if p.clearnet_host == "unrelated-host.test")
    assert weak.strength == 0.40


def test_strength_is_the_max_rule_not_a_sum():
    """Correlated views of one fact are one fact. Summing 0.95+0.90+0.85 would
    manufacture certainty out of a single certificate."""
    fx = infra_fixture()
    top = I.match(fx["onion"], fx["observed"], fx["candidates"])[0]
    assert top.strength == max(e.strength for e in top.evidence)
    assert top.strength <= 1.0


def test_results_are_ordered_by_strength():
    fx = infra_fixture()
    s = [p.strength for p in I.match(fx["onion"], fx["observed"], fx["candidates"])]
    assert s == sorted(s, reverse=True)


def test_no_evidence_means_no_pivot():
    assert I.match("x.onion", {"cert_sha256": "a"},
                   [{"host": "nothing.test", "cert_sha256": "b", "source": "t"}]) == []


def test_every_pivot_carries_its_evidence():
    """A score with no trail is not admissible."""
    fx = infra_fixture()
    for p in I.match(fx["onion"], fx["observed"], fx["candidates"]):
        assert p.evidence
        for e in p.evidence:
            assert e.rule in I.RULE_STRENGTH
            assert e.detail and e.source


# --------------------------------------------------------------------------
# Fingerprints and degradation
# --------------------------------------------------------------------------


def test_favicon_hash_is_stable_and_shodan_compatible():
    h1 = I.favicon_hash(b"\x00\x01icon-bytes")
    h2 = I.favicon_hash(b"\x00\x01icon-bytes")
    assert h1 == h2 and isinstance(h1, int)
    assert I.favicon_hash(b"different") != h1


def test_header_order_is_the_signal():
    a = I.header_order_fingerprint(["Server", "Date", "Content-Type"])
    b = I.header_order_fingerprint(["Date", "Server", "Content-Type"])
    assert a != b, "header ORDER must change the fingerprint"
    assert a == I.header_order_fingerprint(["server", "date", "content-type"])


def test_internetdb_needs_no_key():
    """DEC-026: B-03 resolved. Shodan InternetDB is free and unauthenticated."""
    import inspect

    src = inspect.getsource(I.internetdb)
    assert "internetdb.shodan.io" in src
    assert "api_key" not in src and "apikey" not in src


def test_cache_stats_shape():
    s = I.cache_stats()
    for k in ("hits", "misses", "hit_rate", "entries"):
        assert k in s
    assert 0.0 <= s["hit_rate"] <= 1.0


def test_certificates_never_raises_on_a_dead_network(monkeypatch):
    """Both CT sources down must degrade, not explode."""
    import httpx

    class Boom:
        def __init__(self, *a, **k): pass
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def get(self, *a, **k): raise httpx.ConnectError("down")

    monkeypatch.setattr(httpx, "Client", Boom)
    I._cache.clear()
    certs, source, err = I.certificates("example.test")
    assert certs == [] and source is None and err
