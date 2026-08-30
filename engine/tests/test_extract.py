"""Extraction correctness, measured on 30 hand-labelled sentences.

Fail thresholds from the playbook: location recall >= 0.85 English,
>= 0.70 Hinglish. Recall is measured AFTER normalisation, because that is what
the geofence actually receives -- an extraction the gazetteer cannot resolve is
a dropped breach, not a success (FINDING-07).
"""

from __future__ import annotations

import pytest

from engine.extract.extractor import extract, regex_extract
from engine.extract.normalise import canonical_city, is_region_term, normalise_locations

# --------------------------------------------------------------------------
# 30 hand-labelled sentences: (text, expected canonical cities, language)
# --------------------------------------------------------------------------

LABELLED: list[tuple[str, set[str], str]] = [
    # --- English (15) ---
    ("Marketplace listing: MDMA and LSD, delivery across Jabalpur.", {"Jabalpur"}, "en"),
    ("Forum post: pistol parts, discreet shipping to Katni.", {"Katni"}, "en"),
    ("Paste: counterfeit currency, pickup Narsinghpur.", {"Narsinghpur"}, "en"),
    ("Bridge intercept: KYC data for sale, buyers near Bhopal.", {"Bhopal"}, "en"),
    ("Data dump: 50k Aadhaar records, Indore region.", {"Indore"}, "en"),
    ("Vendor ships to Gwalior and Ujjain weekly.", {"Gwalior", "Ujjain"}, "en"),
    ("Escrow only. Drop point Sagar, no exceptions.", {"Sagar"}, "en"),
    ("Reseller active in Rewa and Satna since March.", {"Rewa", "Satna"}, "en"),
    ("Routes via Jabalpur, Katni and Narsinghpur confirmed.",
     {"Jabalpur", "Katni", "Narsinghpur"}, "en"),
    ("Nationwide delivery, no local pickup.", set(), "en"),
    ("Shipping to Katnipur is not the same as Katni.", {"Katni"}, "en"),
    ("Old name Jubbulpore still used by some vendors.", {"Jabalpur"}, "en"),
    ("Murwara junction handover arranged.", {"Katni"}, "en"),
    ("Stock moving through Madhya Pradesh generally.", set(), "en"),
    ("Contact for India-wide shipping only.", set(), "en"),
    # --- Hinglish (15) ---
    ("bhai jbp mein delivery ho jayegi, wallet niche hai", {"Jabalpur"}, "hi"),
    ("katni aur jbp dono jagah maal milega bhai", {"Katni", "Jabalpur"}, "hi"),
    ("narsingpur wala order ready hai ji", {"Narsinghpur"}, "hi"),
    ("bhopal se bhej denge, bhav fix hai", {"Bhopal"}, "hi"),
    ("indore mein stock khatam, gwalior try karo", {"Indore", "Gwalior"}, "hi"),
    ("ujjain drop point pe milte hai bhaiya", {"Ujjain"}, "hi"),
    ("sagar tak hi jaata hai, aage nahi", {"Sagar"}, "hi"),
    ("rewa aur satna dono cover karte hai", {"Rewa", "Satna"}, "hi"),
    ("jblp se nikal chuka hai parcel", {"Jabalpur"}, "hi"),
    ("जबलपुर में डिलीवरी हो जाएगी", {"Jabalpur"}, "hi"),
    ("कटनी वाला माल तैयार है", {"Katni"}, "hi"),
    ("pure MP mein supply karte hai", set(), "hi"),
    ("bhai poora india cover hai apna", set(), "hi"),
    ("escrow chalega, DM karo jaldi", set(), "hi"),
    ("murwara se katni same hi jagah hai", {"Katni"}, "hi"),
]


def _prf(gold: list[set[str]], pred: list[set[str]]) -> tuple[float, float, float]:
    tp = sum(len(g & p) for g, p in zip(gold, pred))
    fp = sum(len(p - g) for g, p in zip(gold, pred))
    fn = sum(len(g - p) for g, p in zip(gold, pred))
    prec = tp / (tp + fp) if tp + fp else 1.0
    rec = tp / (tp + fn) if tp + fn else 1.0
    f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
    return prec, rec, f1


def _measure(lang: str) -> tuple[float, float, float]:
    rows = [r for r in LABELLED if r[2] == lang]
    gold = [r[1] for r in rows]
    pred = [set(extract(r[0]).entities.locations) for r in rows]
    return _prf(gold, pred)


def test_location_recall_english_meets_threshold():
    p, r, f1 = _measure("en")
    print(f"\nEnglish  P={p:.3f} R={r:.3f} F1={f1:.3f}")
    assert r >= 0.85, f"English location recall {r:.3f} < 0.85"


def test_location_recall_hinglish_meets_threshold():
    p, r, f1 = _measure("hi")
    print(f"\nHinglish P={p:.3f} R={r:.3f} F1={f1:.3f}")
    assert r >= 0.70, f"Hinglish location recall {r:.3f} < 0.70"


def test_precision_is_not_sacrificed_for_recall():
    """A false city is worse than a missed one: it manufactures a breach."""
    for lang in ("en", "hi"):
        p, _, _ = _measure(lang)
        assert p >= 0.90, f"{lang} precision {p:.3f} < 0.90"


# --------------------------------------------------------------------------
# FINDING-07 regression
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "alias,expected",
    [("jbp", "Jabalpur"), ("JBP", "Jabalpur"), ("jblp", "Jabalpur"),
     ("jubbulpore", "Jabalpur"), ("जबलपुर", "Jabalpur"),
     ("murwara", "Katni"), ("narsingpur", "Narsinghpur"),
     ("Jabalpur", "Jabalpur"), ("KATNI", "Katni")],
)
def test_aliases_resolve_to_canonical(alias, expected):
    assert canonical_city(alias) == expected


@pytest.mark.parametrize("term", ["MP", "M.P.", "Madhya Pradesh", "India", "मध्य प्रदेश"])
def test_region_terms_never_resolve_to_a_city(term):
    """'Madhya Pradesh' is not Jabalpur. Resolving it would invent breaches."""
    assert canonical_city(term) is None
    assert is_region_term(term) is True


def test_the_exact_phase1_failing_input_now_reaches_the_geofence():
    text = "bhai jbp aur katni mein delivery ho jayegi, wallet niche hai 0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
    locs = extract(text).entities.locations
    assert "Jabalpur" in locs, "FINDING-07 regression: 'jbp' dropped again"
    assert "Katni" in locs


def test_unresolved_names_are_reported_not_swallowed():
    resolved, unresolved = normalise_locations(["Jabalpur", "Atlantis", "Gotham"])
    assert resolved == ["Jabalpur"]
    assert set(unresolved) == {"Atlantis", "Gotham"}


# --------------------------------------------------------------------------
# Identifiers
# --------------------------------------------------------------------------


def test_eth_btc_xmr_extraction():
    e = regex_extract(
        "eth 0x742d35Cc6634C0532925a3b844Bc454e4438f44e "
        "btc bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq "
        "xmr 4AdUndXHHZ6cfufTMvppY6JwXNouMBzSkbLYfpAV5Usx3skxNgYeYTRJ5AmD5H3Ep1CGGgN1zSGiHUgwWXW1nnnB6mVMxA9"
    )
    assert len(e.wallets_eth) == 1
    assert len(e.wallets_btc) == 1
    assert len(e.wallets_xmr) == 1
    assert len(e.crypto_wallets) == 3


def test_onion_v3_only():
    v3 = "a" * 56
    assert regex_extract(f"mirror {v3}.onion").onions == [f"{v3}.onion"]
    # v2 (16 chars) was retired in 2021; matching it invites false positives.
    assert regex_extract(f"{'a' * 16}.onion").onions == []


def test_email_domain_is_not_extracted_as_a_handle():
    """Regression: 'vendor@proton.test' yielded a spurious '@proton' handle,
    which would have become a false social edge in the graph."""
    e = regex_extract("mail vendor@proton.test or ping @realhandle")
    assert e.emails == ["vendor@proton.test"]
    assert e.handles == ["@realhandle"]


def test_telegram_is_not_extracted_as_a_handle():
    e = regex_extract("reach me t.me/shopdesk or @otherguy")
    assert e.telegram == ["shopdesk"]
    assert e.handles == ["@otherguy"]


def test_bare_pgp_fingerprint():
    fpr = "ABCD1234ABCD1234ABCD1234ABCD1234ABCD1234"
    assert fpr in regex_extract(f"key {fpr}").pgp_fingerprints


def test_contraband_substring_suppression():
    e = regex_extract("selling pistol parts and aadhaar records")
    assert "pistol parts" in e.contraband and "pistol" not in e.contraband
    assert "aadhaar records" in e.contraband and "aadhaar" not in e.contraband


# --------------------------------------------------------------------------
# INV-3
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "bad", ["", "   ", "\n\t", "(((***[[[", "\\x00\\x01", "a" * 50_000, "0x" + "f" * 39, "@"]
)
def test_extract_never_raises(bad):
    r = extract(bad)
    assert r.source in {"regex", "spacy", "muril", "groq"}
    assert isinstance(r.entities.locations, list)


def test_extract_always_reports_the_engine_that_ran():
    assert extract("Jabalpur").source in {"regex", "spacy", "muril", "groq"}


# --------------------------------------------------------------------------
# Honest bounds on the P=1.00/R=1.00 above.
#
# Those 30 sentences and the alias table were authored together, so a perfect
# score there is a REGRESSION GUARD, not a generalisation estimate. These
# probes use surface forms deliberately absent from the alias table, and record
# where matching actually stops.
#
# The design choice is precision-first: exact alias matching, no fuzzy fallback.
# A fabricated city manufactures a geofence breach that never happened, which
# for a police tool is strictly worse than missing one. "kanti" sits one
# transposition from "Katni" and must NOT match -- a fuzzy matcher loose enough
# to catch "jabalpr" is loose enough to catch that too.
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "text,expected",
    [
        ("delivery @ jabalpur-city", {"Jabalpur"}),   # hyphen compound
        ("Jabalpur's market is active", {"Jabalpur"}),  # possessive
        ("katni-jabalpur route", {"Katni", "Jabalpur"}),  # hyphenated pair
    ],
)
def test_generalises_across_punctuation(text, expected):
    assert set(extract(text).entities.locations) == expected


@pytest.mark.parametrize(
    "text",
    [
        "kanti mein bhej do",          # one transposition from Katni
        "satnam singh is the vendor",  # person name containing 'satna'
        "New Delhi and Mumbai only",   # real cities, not in the MP gazetteer
        "panna district supply",       # real MP district, not in the gazetteer
    ],
)
def test_never_invents_a_city(text):
    """The precision direction. A false positive here is a fabricated breach."""
    assert extract(text).entities.locations == []


@pytest.mark.parametrize("text", ["jabalpurr se bhej do", "jabalpr mein delivery", "JBL mein hai"])
def test_known_limit_unseen_typos_are_missed(text):
    """Documented, accepted limitation - not a bug.

    Unseen misspellings are missed because matching is exact-alias only. If this
    ever starts passing, someone added fuzzy matching: re-check
    test_never_invents_a_city before celebrating.
    """
    assert extract(text).entities.locations == []
