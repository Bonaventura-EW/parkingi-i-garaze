"""Matches Lublin street names inside free-text ad titles and descriptions.

Built from scraper/lublin_streets.json, a snapshot of OSM way names within
Lublin's administrative boundary (fetched via the Overpass API). Polish
addresses are frequently written colloquially using just the surname of a
person a street is named after (e.g. "ul. Sowińskiego" for the official
"Józefa Sowińskiego"), so each multi-word personal name also gets indexed
under its last word.

Ads also write street names inflected ("na ul. Puławskiej", "przy al.
Racławickich") and/or without Polish diacritics ("raclawickie"). Matching is
therefore done on diacritic-folded text, and each alias additionally gets its
common declensions indexed as *weak* aliases: a weak alias only counts when
preceded by an explicit street marker ("ul.", "al.", "przy", ...), because
inflected adjectives are ordinary prose words ("w spokojnej okolicy" must not
match the street "Spokojna").
"""
import json
import os
import re

_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "lublin_streets.json")

GENERIC_PREFIXES = ("Aleja ", "Plac ", "Rondo ", "Skwer ", "Bulwar ", "Park ")
MIN_ALIAS_LEN = 5
# Words that are the last token of some official street name but are too generic/frequent
# in ad titles on their own (city name, generic geography words) to be trusted as an alias.
GENERIC_ALIAS_STOP = {
    "Nowy", "Stary", "Górny", "Dolny", "Mały", "Duży", "Świat",
    "Lublin", "Lublina", "Lublinie", "Lubelskie", "Lubelskiego",
}

# 1:1 fold, so indices in folded text map straight back onto the original.
_FOLD = str.maketrans("ąćęłńóśźż", "acelnoszz")


def _fold(s):
    return s.translate(_FOLD)


def _inflected(alias):
    """Common declensions of a nominative street name: 'Puławska' →
    'Puławskiej'/'Puławską' ("na/przy Puławskiej"), 'Racławickie' →
    'Racławickich'. Only the frequent adjectival patterns ads actually use."""
    if alias.endswith(("ka", "ga")):
        return [alias[:-1] + "iej", alias[:-1] + "ą"]
    if alias.endswith("a"):
        return [alias[:-1] + "ej", alias[:-1] + "ą"]
    if alias.endswith("ie"):
        return [alias[:-2] + "ich"]
    return []


def _load_aliases():
    with open(_PATH, encoding="utf-8") as f:
        names = json.load(f)
    base = {}
    for name in names:
        base.setdefault(name.lower(), name)
        words = name.split()
        if len(words) >= 2 and not name.startswith(GENERIC_PREFIXES):
            last = words[-1]
            if len(last) >= MIN_ALIAS_LEN and last not in GENERIC_ALIAS_STOP:
                base.setdefault(last.lower(), name)
    strong, weak = {}, {}
    for alias, name in base.items():
        strong.setdefault(alias, name)
        strong.setdefault(_fold(alias), name)
        for variant in _inflected(alias):
            if len(variant) >= MIN_ALIAS_LEN:
                weak.setdefault(variant, name)
                weak.setdefault(_fold(variant), name)
    weak = {a: n for a, n in weak.items() if a not in strong}
    return strong, weak


ALIASES, WEAK_ALIASES = _load_aliases()
_ALL_ALIASES = {**WEAK_ALIASES, **ALIASES}
# Longest alias first so "Tomasza Zana" matches before a shorter overlapping alias would.
_SORTED_ALIASES = sorted(_ALL_ALIASES, key=len, reverse=True)

# Anchored to the text right after the street name (a leading comma or word
# breaks the match), so incidental numbers in prose ("ul. Zana, 5 minut do
# centrum") are not mistaken for house numbers. A building letter only counts
# when glued to the digits ("26A"), otherwise "56 w Lublinie" would yield "56 w".
NUMBER_RE = re.compile(r"^\s*\d{1,4}[A-Za-z]?\b")

_UL_PREFIX_RE = re.compile(
    r"\b(?:ul|ulica|ulicy|al|aleja|aleje|alei|przy|adres|adresem|adresie)\.?\s*$",
    re.IGNORECASE,
)


def _match_all(lower):
    """Yields (start, end, alias) for every alias at a word boundary in `lower`
    (already lowercased and diacritic-folded).

    The trailing boundary only rejects another *letter* (not a digit), since ad
    titles sometimes glue a house number directly onto the street name with no
    space (e.g. "Onyksowa16").
    """
    for alias in _SORTED_ALIASES:
        m = re.search(r"(?<![\wąćęłńóśźż])" + re.escape(alias) + r"(?![a-ząćęłńóśźż])", lower)
        if m:
            yield m.start(), m.end(), alias


def find_street(text, require_marker=False):
    """Returns (canonical_street_name, house_number_or_'') or (None, None).

    Prefers a match immediately preceded by "ul."/"al." (explicit street
    marker), since ads often mention other place names (districts, landmarks)
    that can otherwise collide with a street alias. Weak (inflected) aliases
    are *only* accepted with such a marker.

    With require_marker=True a match must be marker-prefixed ("ul. Onyksowa",
    "przy Koncertowej") or be a full multi-word official name ("Ludwika
    Hirszfelda" — specific enough on its own). Use it for long free text
    (ad descriptions), where a bare single-word alias hit is usually an
    incidental word ("cicha okolica" vs the street "Cicha"), not the address.
    """
    lower = _fold(text.lower())
    matches = list(_match_all(lower))
    if not matches:
        return None, None

    def with_number(end):
        num_m = NUMBER_RE.search(text[end:end + 15])
        return num_m.group(0).strip() if num_m else ""

    for start, end, alias in matches:
        if _UL_PREFIX_RE.search(lower[:start]):
            return _ALL_ALIASES[alias], with_number(end)

    if require_marker:
        for start, end, alias in matches:
            if " " in alias and alias in ALIASES:
                return ALIASES[alias], with_number(end)
        return None, None
    for start, end, alias in matches:
        if alias in ALIASES:
            return ALIASES[alias], with_number(end)
    return None, None
