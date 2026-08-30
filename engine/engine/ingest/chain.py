"""Blockchain adapters: mempool.space (BTC, no key) and Etherscan (ETH, free key).

Passive read-only queries against public explorers. Etherscan degrades to a
documented no-op when ETHERSCAN_API_KEY is absent, exactly like the Groq path.
"""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from ..settings import get_settings

log = logging.getLogger(__name__)

TIMEOUT_S = 8.0
CACHE_TTL_S = 300
_cache: dict[str, tuple[float, Any]] = {}


def _cached(key: str):
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < CACHE_TTL_S:
        return hit[1]
    return None


def _store(key: str, value: Any):
    _cache[key] = (time.time(), value)
    return value


def btc_address(address: str) -> dict:
    """mempool.space address summary. No key required."""
    key = f"btc:{address}"
    if (hit := _cached(key)) is not None:
        return {**hit, "cached": True}
    try:
        with httpx.Client(timeout=TIMEOUT_S) as c:
            r = c.get(f"https://mempool.space/api/address/{address}")
            r.raise_for_status()
            d = r.json()
        chain = d.get("chain_stats", {})
        out = {
            "ok": True, "chain": "btc", "address": address,
            "tx_count": chain.get("tx_count", 0),
            "funded_sat": chain.get("funded_txo_sum", 0),
            "spent_sat": chain.get("spent_txo_sum", 0),
            "balance_sat": chain.get("funded_txo_sum", 0) - chain.get("spent_txo_sum", 0),
            "source": "mempool.space",
        }
        return _store(key, out)
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "chain": "btc", "address": address,
                "error": type(exc).__name__, "detail": "mempool.space unreachable"}


def eth_address(address: str) -> dict:
    """Etherscan balance. Degrades honestly when no key is configured."""
    s = get_settings()
    if not s.etherscan_api_key:
        return {
            "ok": False, "chain": "eth", "address": address,
            "detail": "ETHERSCAN_API_KEY not set - ETH history unavailable",
            "degraded": True,
        }
    key = f"eth:{address}"
    if (hit := _cached(key)) is not None:
        return {**hit, "cached": True}
    try:
        with httpx.Client(timeout=TIMEOUT_S) as c:
            r = c.get("https://api.etherscan.io/v2/api", params={
                "chainid": 1, "module": "account", "action": "balance",
                "address": address, "tag": "latest", "apikey": s.etherscan_api_key})
            r.raise_for_status()
            d = r.json()
        return _store(key, {"ok": d.get("status") == "1", "chain": "eth",
                            "address": address, "balance_wei": d.get("result"),
                            "source": "etherscan"})
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "chain": "eth", "address": address, "error": type(exc).__name__}
