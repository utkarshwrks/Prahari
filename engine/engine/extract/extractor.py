"""Entity extraction - the Python port of web/lib/extractor.ts, extended.

Contract inherited from v1 and not negotiable (INV-3): **extract() never
raises**. Every enrichment is optional and degrades to the deterministic
regex/gazetteer path, and the returned `source` always names the engine that
actually ran -- never the one we hoped would.

Beyond v1: PGP fingerprints computed from real key blocks, onion v3, Monero,
email, Telegram, and gazetteer normalisation (FINDING-07).

Two implementations of extraction exist on purpose (DEC-011): the TypeScript
one is the engine-offline path, this one is the full engine. The 30 labelled
sentences are run against both.
"""

from __future__ import annotations

import logging
import re
from dataclasses import asdict, dataclass, field
from typing import Literal

from .normalise import normalise_locations

log = logging.getLogger(__name__)

Source = Literal["regex", "spacy", "muril", "groq"]

# --------------------------------------------------------------------------
# Patterns
# --------------------------------------------------------------------------

RE_ETH = re.compile(r"\b0x[a-fA-F0-9]{40}\b")
# Legacy P2PKH/P2SH and bech32. Base58 excludes 0 O I l by definition.
RE_BTC = re.compile(r"\b(?:bc1[ac-hj-np-z0-9]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b")
# Monero: 95 chars starting 4 or 8.
RE_XMR = re.compile(r"\b[48][0-9AB][1-9A-HJ-NP-Za-km-z]{93}\b")
# Tor v3 onion only. v2 was retired in 2021; matching it invites false positives.
RE_ONION = re.compile(r"\b([a-z2-7]{56})\.onion\b", re.I)
RE_EMAIL = re.compile(r"\b[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}\b")
RE_TELEGRAM = re.compile(r"(?:t\.me/|telegram[:\s]*@?)([A-Za-z0-9_]{4,32})", re.I)
RE_HANDLE = re.compile(r"@([A-Za-z0-9_]{2,})")
RE_PGP_BLOCK = re.compile(
    r"-----BEGIN PGP PUBLIC KEY BLOCK-----.*?-----END PGP PUBLIC KEY BLOCK-----",
    re.S,
)
# A bare 40-hex fingerprint, optionally spaced in groups of four.
RE_PGP_FPR = re.compile(r"\b(?:[A-F0-9]{4}\s?){10}\b", re.I)

# v1 taxonomy, carried over verbatim from lib/extractor.ts.
CONTRABAND = [
    "mdma", "lsd", "mephedrone", "charas", "ganja", "ketamine", "cocaine",
    "heroin", "hashish", "meth", "narcotics", "drugs",
    "pistol", "pistol parts", "weapon parts", "ammunition", "katta", "firearm",
    "air pistol", "rifle", "weapon", "arms",
    "aadhaar", "aadhaar records", "pan", "pan records", "credit-card dumps",
    "credit card", "card dumps", "kyc", "kyc data", "otp", "otp logs",
    "database", "data dump", "records",
    "counterfeit currency", "counterfeit", "fake stamp paper", "stamp paper",
    "forged documents", "forged", "duplicate notes", "fake currency", "fake notes",
]

# Every gazetteer name plus its aliases, so a raw regex pass can find "jbp".
from .normalise import CITY_ALIASES  # noqa: E402

_CITY_SURFACE: list[tuple[str, str]] = []
for _canon, _aliases in CITY_ALIASES.items():
    for _s in [_canon, *_aliases]:
        _CITY_SURFACE.append((_s, _canon))
_CITY_SURFACE.sort(key=lambda t: -len(t[0]))  # longest first


@dataclass
class Entities:
    locations: list[str] = field(default_factory=list)
    locations_unresolved: list[str] = field(default_factory=list)
    contraband: list[str] = field(default_factory=list)
    crypto_wallets: list[str] = field(default_factory=list)
    wallets_btc: list[str] = field(default_factory=list)
    wallets_eth: list[str] = field(default_factory=list)
    wallets_xmr: list[str] = field(default_factory=list)
    handles: list[str] = field(default_factory=list)
    emails: list[str] = field(default_factory=list)
    telegram: list[str] = field(default_factory=list)
    onions: list[str] = field(default_factory=list)
    pgp_fingerprints: list[str] = field(default_factory=list)


@dataclass
class ExtractResult:
    entities: Entities
    source: Source
    # Honest reporting: what was dropped and why, never silently swallowed.
    unresolved_locations: int = 0
    blocked_spans: int = 0

    def to_dict(self) -> dict:
        return {
            "entities": asdict(self.entities),
            "source": self.source,
            "unresolved_locations": self.unresolved_locations,
            "blocked_spans": self.blocked_spans,
        }


def _dedupe(xs: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for x in xs:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


def _contraband(lower: str) -> list[str]:
    """v1 substring suppression: keep 'pistol parts', drop bare 'pistol'."""
    hits = _dedupe([kw for kw in CONTRABAND if kw in lower])
    return [
        kw for kw in hits
        if not any(other != kw and kw in other and other in lower for other in hits)
    ]


def _pgp_fingerprints(text: str) -> list[str]:
    """Real fingerprints from key blocks; bare fingerprints as a fallback.

    A PGP block's fingerprint is computed, not guessed. If pgpy is absent or the
    block will not parse, the block is skipped rather than reported wrongly -- a
    wrong fingerprint would create a false identity_key edge, the single
    strongest signal in the fusion model.
    """
    out: list[str] = []
    for block in RE_PGP_BLOCK.findall(text):
        try:
            import pgpy

            key, _ = pgpy.PGPKey.from_blob(block)
            out.append(str(key.fingerprint).replace(" ", "").upper())
        except Exception:  # noqa: BLE001
            log.debug("unparseable PGP block skipped")
    for m in RE_PGP_FPR.findall(text):
        cleaned = re.sub(r"\s+", "", m).upper()
        if len(cleaned) == 40:
            out.append(cleaned)
    return _dedupe(out)


def _locations(text: str) -> tuple[list[str], list[str]]:
    """Surface-form city matching, then canonicalisation (FINDING-07)."""
    lower = text.lower()
    found: list[str] = []
    for surface, canon in _CITY_SURFACE:
        if re.search(rf"(?<!\w){re.escape(surface.lower())}(?!\w)", lower):
            found.append(canon)
    return normalise_locations(_dedupe(found))


def regex_extract(text: str) -> Entities:
    """Deterministic path. Pure string work - cannot raise on any input."""
    lower = text.lower()
    locations, unresolved = _locations(text)

    btc = _dedupe(RE_BTC.findall(text))
    eth = _dedupe(RE_ETH.findall(text))
    xmr = _dedupe(RE_XMR.findall(text))

    onions = _dedupe([f"{m.lower()}.onion" for m in RE_ONION.findall(text)])
    emails = _dedupe(RE_EMAIL.findall(text))
    telegram = _dedupe(RE_TELEGRAM.findall(text))

    # Handles are matched on text with emails and t.me links REMOVED. Filtering
    # by local part alone is not enough: "vendor@proton.test" still yields a
    # spurious "@proton" from the domain side, which would become a false
    # `social` edge in the graph.
    masked = RE_EMAIL.sub(" ", text)
    masked = RE_TELEGRAM.sub(" ", masked)
    handles = _dedupe([f"@{h}" for h in RE_HANDLE.findall(masked)])

    return Entities(
        locations=locations,
        locations_unresolved=unresolved,
        contraband=_contraband(lower),
        crypto_wallets=_dedupe(btc + eth + xmr),
        wallets_btc=btc,
        wallets_eth=eth,
        wallets_xmr=xmr,
        handles=handles,
        emails=emails,
        telegram=telegram,
        onions=onions,
        pgp_fingerprints=_pgp_fingerprints(text),
    )


def extract(text: str, prefer: Source | None = None) -> ExtractResult:
    """Total function. Never raises, and always reports the engine that ran."""
    try:
        if not text or not text.strip():
            return ExtractResult(entities=Entities(), source="regex")

        ents = regex_extract(text)
        source: Source = "regex"

        # spaCy adds nothing the gazetteer cannot do for MP cities, so it is
        # additive only and its absence is not an error.
        if prefer in (None, "spacy"):
            try:
                ents = _spacy_enrich(text, ents)
                source = "spacy"
            except Exception:  # noqa: BLE001
                pass

        return ExtractResult(
            entities=ents,
            source=source,
            unresolved_locations=len(ents.locations_unresolved),
        )
    except Exception:  # noqa: BLE001 - INV-3: extraction never raises
        log.exception("extract fell through to empty result")
        return ExtractResult(entities=Entities(), source="regex")


_NLP = None


def _spacy_enrich(text: str, ents: Entities) -> Entities:
    """Optional spaCy pass. Raises if unavailable; the caller degrades."""
    global _NLP
    if _NLP is None:
        import spacy

        try:
            _NLP = spacy.load("en_core_web_sm")
        except OSError:
            # Blank pipeline still gives us the EntityRuler, no model download.
            _NLP = spacy.blank("en")
            ruler = _NLP.add_pipe("entity_ruler")
            ruler.add_patterns(
                [{"label": "GPE", "pattern": s} for s, _ in _CITY_SURFACE]
            )

    doc = _NLP(text[:20_000])
    extra: list[str] = []
    for ent in doc.ents:
        if ent.label_ in {"GPE", "LOC"}:
            extra.append(ent.text)
    if extra:
        merged, unresolved = normalise_locations(ents.locations + extra)
        ents.locations = merged
        ents.locations_unresolved = _dedupe(ents.locations_unresolved + unresolved)
    return ents
