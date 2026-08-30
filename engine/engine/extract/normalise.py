"""Gazetteer normalisation - the fix for FINDING-07.

Found in Phase 1 while verifying the Groq path: on the Hinglish input
"bhai jbp aur katni mein delivery ho jayegi", Groq correctly returned
`locations: ["jbp", "katni"]`. But `getAnyCity("jbp")` resolves nothing, and
`registerCities()` skips any name it cannot resolve -- so the model identified
an in-zone city and **the geofence never saw it**. A silently dropped breach.

The local regex extractor does not have that bug, because it only ever emits
exact gazetteer names. It also never detects "jbp" at all. Neither path was
correct.

This module sits between extraction and the geofence. Everything downstream --
the breach predicate, city heat, jurisdiction routing -- consumes canonical
names only.

Recall is measured AFTER normalisation (docs/METRICS.md), because that is the
number that reflects what the geofence actually receives.
"""

from __future__ import annotations

import re
import unicodedata

# The MP gazetteer, mirrored from web/lib/cities.ts. The canonical spelling is
# the key; everything that should resolve to it is an alias.
#
# Aliases cover: colloquial abbreviations, common misspellings, Devanagari, and
# the spaced/hyphenated variants that appear in real listing text.
CITY_ALIASES: dict[str, list[str]] = {
    "Jabalpur": [
        "jbp", "jblp", "jabalpore", "jabalpur city", "jubbulpore",
        "जबलपुर", "जबलपूर",
    ],
    "Katni": ["katni", "katnee", "murwara", "कटनी"],
    "Narsinghpur": [
        "narsinghpur", "narsingpur", "narsimhapur", "narsinhpur",
        "नरसिंहपुर",
    ],
    "Bhopal": ["bpl", "bhopaal", "भोपाल"],
    "Indore": ["indor", "indaur", "इंदौर"],
    "Gwalior": ["gwaliar", "gwalier", "ग्वालियर"],
    "Ujjain": ["ujain", "ujjayini", "उज्जैन"],
    "Sagar": ["saugor", "saugar", "सागर"],
    "Rewa": ["rewah", "रीवा"],
    "Satna": ["satnaa", "सतना"],
}

# Region-level terms. They are NOT cities and must never resolve to one --
# "Madhya Pradesh" is not Jabalpur, and treating it as such would manufacture
# breaches that did not happen.
REGION_TERMS = {
    "mp", "m.p.", "madhya pradesh", "madhyapradesh", "मध्य प्रदेश",
    "india", "bharat", "भारत",
}


def _fold(s: str) -> str:
    """Lowercase, strip accents and collapse punctuation/whitespace."""
    s = unicodedata.normalize("NFKC", s).strip().lower()
    s = re.sub(r"[._\-]+", " ", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


# alias (folded) -> canonical
_LOOKUP: dict[str, str] = {}
for _canon, _aliases in CITY_ALIASES.items():
    _LOOKUP[_fold(_canon)] = _canon
    for _a in _aliases:
        _LOOKUP[_fold(_a)] = _canon

_REGIONS = {_fold(r) for r in REGION_TERMS}


def canonical_city(name: str) -> str | None:
    """Resolve one extracted name to its canonical gazetteer spelling.

    Returns None for anything not in the MP gazetteer -- including region-level
    terms, which are deliberately NOT resolved to a city.
    """
    if not name or not name.strip():
        return None
    folded = _fold(name)
    if folded in _REGIONS:
        return None
    return _LOOKUP.get(folded)


def is_region_term(name: str) -> bool:
    """True for region-level mentions ('MP', 'India') that are not cities."""
    return _fold(name) in _REGIONS


def normalise_locations(names: list[str]) -> tuple[list[str], list[str]]:
    """Split extracted names into (canonical MP cities, unresolved).

    Order-preserving and deduplicated. The unresolved list is returned rather
    than discarded so the drop can be counted and reported instead of silently
    swallowed -- that silence was the whole of FINDING-07.
    """
    resolved: list[str] = []
    unresolved: list[str] = []
    for n in names:
        c = canonical_city(n)
        if c is not None:
            if c not in resolved:
                resolved.append(c)
        elif n not in unresolved:
            unresolved.append(n)
    return resolved, unresolved


def known_aliases() -> int:
    """Alias count, for the metrics table."""
    return len(_LOOKUP)
