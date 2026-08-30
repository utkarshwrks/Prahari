"""Planted infrastructure metadata for the testbed infra-leak case.

Deliberately resolvable WITHOUT any live lookup, so the demo never depends on a
third-party index being up on the day. Phase 6 measured crt.sh returning 502 on
5 of 5 attempts (DEC-027) -- that is exactly the risk this removes.

The live adapters are still demonstrated against a real public domain, so the
judge sees the real thing working; they are just not on the demo's critical path.
"""

from __future__ import annotations

import hashlib
from functools import lru_cache

from ..testbed.generate import generate

# The planted leak: the hidden service reuses the operator's clearnet
# certificate. This is the single most common real-world onion deanonymisation
# -- an operator terminates TLS with the same cert on both, and the CA
# publishes it to a public log for anyone to read.
LEAK_DOMAIN = "vendor-shop-mirror.test"


@lru_cache(maxsize=1)
def infra_fixture() -> dict:
    tb = generate()
    persona = next(p for p in tb.personas if p.role == "infra")
    onion = persona.onion

    # Deterministic pseudo-certificate derived from the onion, so the fixture
    # is stable across runs without shipping a real certificate.
    sha = hashlib.sha256(f"cert::{onion}".encode()).hexdigest()
    favicon = int(hashlib.sha256(f"favicon::{onion}".encode()).hexdigest()[:8], 16) - 2**31

    return {
        "persona_id": persona.id,
        "onion": onion,
        # What PASSIVE observation of the hidden service yields. In production
        # these come from CT logs and public indexes, never from a connection.
        "observed": {
            "cert_sha256": sha,
            "cert_names": [LEAK_DOMAIN, f"www.{LEAK_DOMAIN}"],
            "favicon_mmh3": favicon,
            "banner": "nginx/1.24.0",
            "server_status_vhost": LEAK_DOMAIN,
        },
        "candidates": [
            {
                "host": LEAK_DOMAIN,
                "cert_sha256": sha,          # the leak: same certificate
                "dns_names": [LEAK_DOMAIN, f"www.{LEAK_DOMAIN}"],
                "favicon_mmh3": favicon,
                "banner": "nginx/1.24.0",
                "source": "testbed",
            },
            {
                # A decoy host: same stack, nothing identifying. Must score low.
                "host": "unrelated-host.test",
                "cert_sha256": hashlib.sha256(b"different").hexdigest(),
                "dns_names": ["unrelated-host.test"],
                "banner": "nginx/1.24.0",
                "source": "testbed",
            },
        ],
    }
