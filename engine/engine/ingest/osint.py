"""Public OSINT adapters - the Python port of web/app/api/live-intel/route.ts.

Same three no-key sources, same 20 s cache, same allSettled semantics: a source
that fails is dropped, never raised. This is legal open-source intelligence,
not dark-web scraping.

Contract inherited from v1 (INV-4): fetch_all() never raises and always returns
a usable payload, even with the network down.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any

import httpx

from ..extract.extractor import extract

log = logging.getLogger(__name__)

CACHE_TTL_S = 20
TIMEOUT_S = 5.5

THREAT_KEYWORDS = [
    "ransomware", "data breach", "breach", "phishing", "malware", "stolen data",
    "leaked", "leak", "hacked", "hack", "fraud", "scam", "stolen", "credentials",
    "dark web", "darkweb", "trafficking", "narcotics", "counterfeit", "extortion",
    "ddos", "botnet", "spyware", "identity theft", "cyber", "exploit", "zero-day",
]

_cache: dict[str, Any] = {"at": 0.0, "items": []}


@dataclass
class SourceResult:
    name: str
    ok: bool
    items: list[dict] = field(default_factory=list)
    error: str | None = None


def _shape(item_id: str, channel: str, text: str, url: str | None) -> dict:
    e = extract(text).entities
    return {
        "id": item_id,
        "source": "Forum",
        "channel": channel,
        "url": url,
        "timestamp": int(time.time() * 1000),
        "rawText": text[:400],
        "entities": {
            "locations": e.locations,
            "contraband": e.contraband,
            "wallets": e.crypto_wallets,
            "handles": e.handles,
        },
        # Severity is decided by the geofence downstream, never guessed here.
        "severity": "high" if e.locations else ("medium" if e.contraband else "low"),
        "live": True,
    }


def _hackernews(client: httpx.Client) -> SourceResult:
    try:
        out: list[dict] = []
        for q in ("dark web india", "data breach india"):
            r = client.get(
                "https://hn.algolia.com/api/v1/search_by_date",
                params={"query": q, "tags": "story", "hitsPerPage": 10},
            )
            r.raise_for_status()
            for h in r.json().get("hits", []):
                title = h.get("title") or h.get("story_title") or ""
                if not title:
                    continue
                out.append(_shape(f"hn-{h.get('objectID')}", "Hacker News", title, h.get("url")))
        return SourceResult("hackernews", True, out)
    except Exception as exc:  # noqa: BLE001
        return SourceResult("hackernews", False, [], f"{type(exc).__name__}")


def _google_news(client: httpx.Client) -> SourceResult:
    try:
        import re as _re

        r = client.get(
            "https://news.google.com/rss/search",
            params={"q": "cybercrime OR darkweb OR data breach India", "hl": "en-IN",
                    "gl": "IN", "ceid": "IN:en"},
        )
        r.raise_for_status()
        items = _re.findall(r"<item>(.*?)</item>", r.text, _re.S)[:15]
        out: list[dict] = []
        for i, blob in enumerate(items):
            m = _re.search(r"<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</title>", blob, _re.S)
            link = _re.search(r"<link>(.*?)</link>", blob, _re.S)
            if m:
                out.append(_shape(f"gn-{i}-{hash(m.group(1)) & 0xffffff}", "Google News",
                                  m.group(1).strip(), link.group(1).strip() if link else None))
        return SourceResult("google_news", True, out)
    except Exception as exc:  # noqa: BLE001
        return SourceResult("google_news", False, [], f"{type(exc).__name__}")


def _reddit(client: httpx.Client) -> SourceResult:
    try:
        r = client.get(
            "https://www.reddit.com/r/cybersecurity/new.json",
            params={"limit": 15},
            headers={"User-Agent": "prahari-research/2.0"},
        )
        r.raise_for_status()
        out: list[dict] = []
        for c in r.json().get("data", {}).get("children", []):
            d = c.get("data", {})
            title = d.get("title") or ""
            if not title or not any(k in title.lower() for k in THREAT_KEYWORDS):
                continue
            out.append(_shape(f"rd-{d.get('id')}", "Reddit", title,
                              f"https://reddit.com{d.get('permalink', '')}"))
        return SourceResult("reddit", True, out)
    except Exception as exc:  # noqa: BLE001
        return SourceResult("reddit", False, [], f"{type(exc).__name__}")


def fetch_all(force: bool = False) -> dict:
    """All three sources. Never raises; a dead source is dropped, not fatal."""
    now = time.time()
    if not force and now - _cache["at"] < CACHE_TTL_S and _cache["items"]:
        return {"ok": True, "cached": True, "sources": 3, "items": _cache["items"]}

    results: list[SourceResult] = []
    try:
        with httpx.Client(timeout=TIMEOUT_S, follow_redirects=True) as client:
            for fn in (_hackernews, _google_news, _reddit):
                results.append(fn(client))
    except Exception as exc:  # noqa: BLE001
        log.warning("osint client failed: %s", type(exc).__name__)

    items = [i for r in results if r.ok for i in r.items]
    ok_n = sum(1 for r in results if r.ok)
    if items:
        _cache["at"] = now
        _cache["items"] = items

    return {
        "ok": True,   # INV-4: never a non-200 shape
        "cached": False,
        "sources": ok_n,
        "items": items or _cache["items"],
        "detail": None if ok_n else "All OSINT sources unreachable.",
        "per_source": [{"name": r.name, "ok": r.ok, "n": len(r.items), "error": r.error}
                       for r in results],
    }
