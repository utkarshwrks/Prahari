"""Authorship features and similarity.

Stylometry is the WEAKEST evidence PRAHARI uses, and it is treated that way:
its reliability exponent in fusion is 0.5, half that of a PGP key. Writing
style is imitable, and the testbed's decoy exists to prove we know that.

Features, all computed on CPU with no model download required:
  - TF-IDF over character 3-5 grams (habits below the level of word choice)
  - function-word frequencies (the classic authorship signal - content words
    change with the product, function words do not)
  - type-token ratio, mean word length
  - punctuation and formatting habits (ellipsis style, double spaces, caps)
  - Hinglish markers: romanised-Hindi token ratio, Devanagari presence,
    -ji / bhai / bhaiya usage

LaBSE sentence embeddings are additive when available and absent otherwise;
the engine badge reports which path actually ran.
"""

from __future__ import annotations

import logging
import math
import re
from dataclasses import dataclass, field
from typing import Iterable

log = logging.getLogger(__name__)

# 150 English function words. Deliberately content-free: what a vendor sells
# changes, how they glue sentences together does not.
FUNCTION_WORDS = """
a about above after again against all am an and any are as at be because been
before being below between both but by can cannot could did do does doing down
during each few for from further had has have having he her here hers herself
him himself his how i if in into is it its itself just me more most my myself
no nor not now of off on once only or other our ours ourselves out over own
same she should so some such than that the their theirs them themselves then
there these they this those through to too under until up very was we were
what when where which while who whom why will with you your yours yourself
yourselves also always been being come could does else ever every get got
give go going great know like little made make many may might much must
need never new now often old one only other please put said same say see
seem send shall since still take tell thing think though thus time upon us
use used want way well went while within without work would yet
""".split()

# Romanised-Hindi markers. This is the lexicon Phase 3's normalisation work
# implied: MP marketplace text is Hinglish, and an English-only feature set
# under-reads it.
HINGLISH_TOKENS = {
    "bhai", "bhaiya", "ji", "hai", "hain", "karo", "kare", "karna", "milega",
    "milta", "bhav", "maal", "jaldi", "abhi", "kya", "koi", "nahi", "nahin",
    "haan", "accha", "theek", "thik", "aur", "ya", "mein", "me", "se", "ka",
    "ki", "ke", "ko", "par", "pe", "wala", "wale", "dono", "sab", "kuch",
    "chahiye", "dedo", "lelo", "bhejo", "bhej", "denge", "jayega", "jayegi",
    "raha", "rahe", "hoga", "hogi", "kar", "diya", "liya", "apna", "poora",
    "pura", "sirf", "bas", "phir", "tak", "saath", "pas", "paas",
}

DEVANAGARI = re.compile(r"[ऀ-ॿ]")
WORD = re.compile(r"[A-Za-zऀ-ॿ']+")


@dataclass
class StyleProfile:
    persona_id: str
    n_posts: int
    n_tokens: int
    # classic features
    ttr: float = 0.0
    mean_word_len: float = 0.0
    function_word_freq: dict[str, float] = field(default_factory=dict)
    punctuation: dict[str, float] = field(default_factory=dict)
    # Hinglish
    hinglish_ratio: float = 0.0
    devanagari_ratio: float = 0.0
    honorific_rate: float = 0.0
    text: str = ""
    # Kept separate from `text` on purpose. Bio copying is a targeted attack on
    # attribution, and a bio is one line against a corpus of listings -- diluted
    # into the blob, a verbatim steal vanishes below any sane Jaccard threshold.
    bio: str = ""

    def vector(self) -> list[float]:
        """Dense classic-feature vector, in a stable order."""
        fw = [self.function_word_freq.get(w, 0.0) for w in FUNCTION_WORDS]
        pu = [self.punctuation.get(k, 0.0) for k in PUNCT_KEYS]
        return [
            self.ttr, self.mean_word_len,
            self.hinglish_ratio, self.devanagari_ratio, self.honorific_rate,
            *fw, *pu,
        ]


PUNCT_KEYS = [
    "period", "comma", "ellipsis2", "ellipsis3", "exclaim", "question",
    "dash", "pipe", "middot", "double_space", "caps_ratio", "digit_ratio",
]


def _punctuation(text: str) -> dict[str, float]:
    n = max(1, len(text))
    letters = [c for c in text if c.isalpha()]
    return {
        "period": text.count(".") / n,
        "comma": text.count(",") / n,
        # Ellipsis STYLE is a habit: ".." and "..." are different authors.
        "ellipsis2": len(re.findall(r"(?<!\.)\.\.(?!\.)", text)) / n,
        "ellipsis3": text.count("...") / n,
        "exclaim": text.count("!") / n,
        "question": text.count("?") / n,
        "dash": text.count("-") / n,
        "pipe": text.count("|") / n,
        "middot": text.count("·") / n,
        "double_space": text.count("  ") / n,
        "caps_ratio": sum(1 for c in letters if c.isupper()) / max(1, len(letters)),
        "digit_ratio": sum(1 for c in text if c.isdigit()) / n,
    }


def profile(persona_id: str, texts: Iterable[str], bio: str = "") -> StyleProfile:
    """Build a style profile. Pure CPU, deterministic, never raises."""
    blob = "\n".join(t for t in texts if t)
    tokens = [t.lower() for t in WORD.findall(blob)]
    n = len(tokens)

    p = StyleProfile(persona_id=persona_id, n_posts=blob.count("\n") + 1,
                     n_tokens=n, text=blob, bio=bio)
    if n == 0:
        return p

    p.ttr = len(set(tokens)) / n
    p.mean_word_len = sum(len(t) for t in tokens) / n

    counts: dict[str, int] = {}
    for t in tokens:
        if t in FUNCTION_WORD_SET:
            counts[t] = counts.get(t, 0) + 1
    p.function_word_freq = {w: c / n for w, c in counts.items()}

    p.punctuation = _punctuation(blob)
    p.hinglish_ratio = sum(1 for t in tokens if t in HINGLISH_TOKENS) / n
    p.devanagari_ratio = len(DEVANAGARI.findall(blob)) / max(1, len(blob))
    p.honorific_rate = sum(
        1 for t in tokens if t in {"ji", "bhai", "bhaiya", "sir", "boss"}
    ) / n
    return p


FUNCTION_WORD_SET = set(FUNCTION_WORDS)


# --------------------------------------------------------------------------
# Similarity
# --------------------------------------------------------------------------


def _cosine(a: list[float], b: list[float]) -> float:
    num = sum(x * y for x, y in zip(a, b))
    da = math.sqrt(sum(x * x for x in a))
    db = math.sqrt(sum(y * y for y in b))
    if da == 0 or db == 0:
        return 0.0
    return max(0.0, min(1.0, num / (da * db)))


def char_ngram_similarity(a: str, b: str, lo: int = 3, hi: int = 5) -> float:
    """TF-IDF cosine over character 3-5 grams.

    Falls back to a plain n-gram Jaccard when scikit-learn is unavailable, so
    the engine still answers and the badge says which path ran.
    """
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer

        vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(lo, hi), min_df=1)
        m = vec.fit_transform([a, b])
        num = (m[0].multiply(m[1])).sum()
        den = math.sqrt(m[0].multiply(m[0]).sum()) * math.sqrt(m[1].multiply(m[1]).sum())
        return float(num / den) if den else 0.0
    except Exception:  # noqa: BLE001
        ga = {a[i:i + 4] for i in range(max(0, len(a) - 3))}
        gb = {b[i:i + 4] for i in range(max(0, len(b) - 3))}
        return len(ga & gb) / len(ga | gb) if (ga | gb) else 0.0


@dataclass
class StyleComparison:
    persona_a: str
    persona_b: str
    s_style: float
    char_ngram: float
    classic_cosine: float
    engine: str
    flags: list[str] = field(default_factory=list)
    cap: float | None = None
    detail: dict = field(default_factory=dict)

    def as_dict(self) -> dict:
        return self.__dict__.copy()


def compare(
    pa: StyleProfile,
    pb: StyleProfile,
    corpus_burstiness: list[float] | None = None,
) -> StyleComparison:
    """s_style for one pair, with counter-deception flags applied.

    The flags are not decoration. A copied bio can drive char-n-gram similarity
    close to 1.0 while telling you nothing about who wrote it, so mimicry caps
    the signal rather than merely annotating it.
    """
    ng = char_ngram_similarity(pa.text, pb.text)
    cl = _cosine(pa.vector(), pb.vector())
    s = 0.5 * ng + 0.5 * cl

    flags: list[str] = []
    cap: float | None = None

    # Bios first: that is where copying actually happens, and it is the
    # comparison the playbook specifies. Falling back to the full corpus would
    # dilute a one-line steal to nothing.
    if pa.bio and pb.bio and mimicry_suspected(pa.bio, pb.bio):
        flags.append("mimicry_suspected")
        cap = 0.2
    elif mimicry_suspected(pa.text, pb.text):
        flags.append("mimicry_suspected")
        cap = 0.2

    if llm_rewrite_suspected(pa.text, corpus_burstiness) or llm_rewrite_suspected(
        pb.text, corpus_burstiness
    ):
        flags.append("llm_rewrite_suspected")
        cap = min(cap, 0.3) if cap is not None else 0.3

    if pa.n_tokens < 50 or pb.n_tokens < 50:
        # Too little text to say anything. Saying so is better than a number.
        flags.append("insufficient_text")
        cap = min(cap, 0.25) if cap is not None else 0.25

    if cap is not None:
        s = min(s, cap)

    return StyleComparison(
        persona_a=pa.persona_id, persona_b=pb.persona_id,
        s_style=round(s, 6), char_ngram=round(ng, 6), classic_cosine=round(cl, 6),
        engine="classic", flags=flags, cap=cap,
        detail={"n_tokens_a": pa.n_tokens, "n_tokens_b": pb.n_tokens,
                "hinglish_a": round(pa.hinglish_ratio, 4),
                "hinglish_b": round(pb.hinglish_ratio, 4)},
    )


# --------------------------------------------------------------------------
# Counter-deception
# --------------------------------------------------------------------------


def _shingles(text: str, k: int = 5) -> set[str]:
    """Word k-shingles. Short texts (a typical bio) fall back to k=3 rather
    than collapsing to a single shingle, which would make Jaccard all-or-
    nothing on exactly the inputs that matter most."""
    words = text.lower().split()
    if len(words) < k:
        k = 3
    if len(words) < k:
        return {" ".join(words)} if words else set()
    return {" ".join(words[i:i + k]) for i in range(len(words) - k + 1)}


def mimicry_suspected(a: str, b: str, threshold: float = 0.9) -> bool:
    """Verbatim copying, not shared authorship.

    Jaccard over 5-word shingles. Two people who write alike share habits;
    two texts that share 90% of their exact 5-word runs were copied. The
    testbed decoy copies its target's bio word for word, which is exactly the
    attack a real vendor uses to poison attribution.
    """
    sa, sb = _shingles(a), _shingles(b)
    if not sa or not sb:
        return False
    return len(sa & sb) / len(sa | sb) > threshold


def burstiness(text: str) -> float | None:
    """Coefficient of variation of sentence length.

    Human prose varies its sentence lengths; machine paraphrase flattens them.
    Returns None when there is too little text to measure.
    """
    sentences = [s.strip() for s in re.split(r"[.!?\n]+", text) if s.strip()]
    if len(sentences) < 6:
        return None
    lens = [len(s.split()) for s in sentences]
    mean = sum(lens) / len(lens)
    if mean == 0:
        return None
    var = sum((x - mean) ** 2 for x in lens) / len(lens)
    return math.sqrt(var) / mean


def llm_rewrite_suspected(
    text: str, corpus_burstiness: list[float] | None = None
) -> bool:
    """Heuristic for machine-paraphrased text. RELATIVE, not absolute.

    An absolute threshold does not work and the measurement says so: on the
    testbed, burstiness ranges 0.10-0.39 with a median of 0.205, so a fixed
    cutoff of 0.25 fired on 206 of 244 personas. Templated text is inherently
    flat; that tells you nothing about whether a machine rewrote it.

    "Flat" is only meaningful against a reference. With a corpus supplied, a
    persona is flagged when it sits below the 5th percentile of its own peers
    AND shows a near-zero typo rate. Without a corpus the detector abstains
    rather than guessing -- an unvalidatable flag that downweights real
    evidence is worse than no flag at all.
    """
    b = burstiness(text)
    if b is None:
        return False

    if not corpus_burstiness or len(corpus_burstiness) < 20:
        return False  # abstain: no reference distribution to judge against

    ref = sorted(corpus_burstiness)
    p5 = ref[max(0, int(0.05 * len(ref)) - 1)]
    if b >= p5:
        return False

    words = WORD.findall(text.lower())
    doubled = sum(1 for w in words if re.search(r"(.)\1\1", w))
    typo_rate = doubled / max(1, len(words))
    return typo_rate < 0.001
