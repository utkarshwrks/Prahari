"""Loader for the Kaggle "Dark Net Marketplace Data (Agora 2014-2015)" CSV.

Publicly released, academically archived. We read a file; we never touch Tor and
never scrape anything live.

Measured shape of the real file (DEC-018): 109,689 rows, 3,192 vendors,
columns `Vendor, Category, Item, Item Description, Price, Origin, Destination,
Rating, Remarks`. **No timestamp column exists**, so `Post.ts` is left None and
every temporal feature runs on the testbed instead.

Content rule: category-level fields only. `Item Description` is passed through
the blocklist and dropped when it looks like synthesis or how-to instruction.
The drop count is returned and logged so the filtering is auditable rather than
invisible.
"""

from __future__ import annotations

import csv
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path

log = logging.getLogger(__name__)

MARKET = "Agora"

# Terms that indicate preparation, synthesis or operational instruction rather
# than a category-level listing. A row matching any of these has its body
# dropped; the listing itself is still counted, because the fact that a vendor
# offered a category is exactly what we analyse.
BLOCKLIST = [
    r"\bsynthes(is|ise|ize|ised|ized)\b",
    r"\brecipe\b",
    r"\bhow\s+to\s+(make|cook|produce|manufactur)",
    r"\bstep[-\s]?by[-\s]?step\b",
    r"\binstructions?\s+(for|to)\s+(make|produce|cook)",
    r"\breagents?\b",
    r"\bprecursor\b",
    r"\bextraction\s+(method|guide|tek)\b",
    r"\btek\b",
    r"\bcook(ing)?\s+guide\b",
    r"\bmanufactur(e|ing)\s+(guide|process|method)\b",
    r"\btutorial\b",
]
_BLOCK_RE = re.compile("|".join(BLOCKLIST), re.I)

# Bare BTC price like "0.05027025666666667 BTC".
_PRICE_RE = re.compile(r"([0-9]*\.?[0-9]+)\s*BTC", re.I)


@dataclass
class Persona:
    id: str
    market: str
    handle: str
    first_seen: str | None = None
    last_seen: str | None = None


@dataclass
class Post:
    id: str
    persona_id: str
    market: str
    ts: str | None  # Agora has no timestamps - see DEC-018
    title: str | None
    body: str | None
    price: float | None
    category: str | None
    raw_pgp: str | None = None


@dataclass
class LoadResult:
    personas: list[Persona] = field(default_factory=list)
    posts: list[Post] = field(default_factory=list)
    rows_read: int = 0
    rows_skipped: int = 0
    bodies_blocked: int = 0
    stats: dict = field(default_factory=dict)


def _clean(v: str | None) -> str | None:
    if v is None:
        return None
    s = v.strip().strip('"').strip()
    return s or None


def _price(v: str | None) -> float | None:
    if not v:
        return None
    m = _PRICE_RE.search(v)
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


def _key(row: dict[str, str], *names: str) -> str | None:
    """The real CSV header has leading spaces on most columns."""
    for n in names:
        for k in (n, f" {n}", n.strip()):
            if k in row:
                return _clean(row[k])
    return None


def load(path: str | Path, limit: int | None = None) -> LoadResult:
    """Normalise the Agora CSV into Persona/Post. Never raises on a bad row."""
    res = LoadResult()
    seen: dict[str, Persona] = {}
    categories: dict[str, int] = {}

    with open(path, encoding="utf-8", errors="replace", newline="") as fh:
        for i, row in enumerate(csv.DictReader(fh)):
            if limit is not None and res.rows_read >= limit:
                break
            try:
                vendor = _key(row, "Vendor")
                if not vendor:
                    res.rows_skipped += 1
                    continue
                res.rows_read += 1

                pid = f"agora:{vendor}"
                if pid not in seen:
                    seen[pid] = Persona(id=pid, market=MARKET, handle=vendor)

                category = _key(row, "Category")
                if category:
                    top = category.split("/")[0].strip()
                    categories[top] = categories.get(top, 0) + 1

                title = _key(row, "Item")
                body = _key(row, "Item Description")

                # Content rule: drop the body, keep the listing.
                if body and _BLOCK_RE.search(body):
                    body = None
                    res.bodies_blocked += 1

                res.posts.append(
                    Post(
                        id=f"{pid}:{i}",
                        persona_id=pid,
                        market=MARKET,
                        ts=None,  # no timestamp in this dataset
                        title=title,
                        body=body,
                        price=_price(_key(row, "Price")),
                        category=category,
                        raw_pgp=None,  # no PGP column; blocks appear rarely in text
                    )
                )
            except Exception:  # noqa: BLE001 - one bad row must not kill a load
                res.rows_skipped += 1
                log.debug("skipped malformed Agora row %s", i)

    res.personas = list(seen.values())
    res.stats = {
        "market": MARKET,
        "rows_read": res.rows_read,
        "rows_skipped": res.rows_skipped,
        "personas": len(res.personas),
        "posts": len(res.posts),
        "bodies_blocked": res.bodies_blocked,
        "has_timestamps": False,
        "top_categories": sorted(categories.items(), key=lambda kv: -kv[1])[:8],
    }
    log.info("agora loaded", extra=res.stats)
    return res


def write_fixture(src: str | Path, dest: str | Path, rows: int = 1000) -> dict:
    """Commit a small real sample so tests and the demo never need the 32 MB file.

    The sample is REAL data, not fabricated -- the playbook's honesty rule means
    a fixture claiming to be Agora must actually be Agora.
    """
    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    with open(src, encoding="utf-8", errors="replace", newline="") as fin, \
         open(dest, "w", encoding="utf-8", newline="") as fout:
        reader = csv.reader(fin)
        writer = csv.writer(fout)
        writer.writerow(next(reader))
        n = 0
        for row in reader:
            if n >= rows:
                break
            writer.writerow(row)
            n += 1
    return {"fixture": str(dest), "rows": n}
