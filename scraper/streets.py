"""Matches Lublin street names inside free-text ad titles and descriptions.

Built from scraper/lublin_streets.json, a snapshot of OSM way names within
Lublin's administrative boundary (fetched via the Overpass API). Polish
addresses are frequently written colloquially using just the surname of a
person a street is named after (e.g. "ul. Sowińskiego" for the official
"Józefa Sowińskiego"), so each multi-word personal name also gets indexed
under its last word.
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


def _load_aliases():
    with open(_PATH, encoding="utf-8") as f:
        names = json.load(f)
    aliases = {}
    for name in names:
        aliases.setdefault(name.lower(), name)
        words = name.split()
        if len(words) >= 2 and not name.startswith(GENERIC_PREFIXES):
            last = words[-1]
            if len(last) >= MIN_ALIAS_LEN and last not in GENERIC_ALIAS_STOP:
                aliases.setdefault(last.lower(), name)
    return aliases


ALIASES = _load_aliases()
# Longest alias first so "Tomasza Zana" matches before a shorter overlapping alias would.
_SORTED_ALIASES = sorted(ALIASES.keys(), key=len, reverse=True)

NUMBER_RE = re.compile(r"\d{1,4}\s?[A-Za-z]?\b")


_UL_PREFIX_RE = re.compile(r"\bul\.?\s*$", re.IGNORECASE)


def _match_all(lower):
    """Yields (start, alias) for every alias appearing at a word boundary in `lower`.

    The trailing boundary only rejects another *letter* (not a digit), since ad
    titles sometimes glue a house number directly onto the street name with no
    space (e.g. "Onyksowa16").
    """
    for alias in _SORTED_ALIASES:
        m = re.search(r"(?<![\wąćęłńóśźż])" + re.escape(alias) + r"(?![a-ząćęłńóśźż])", lower)
        if m:
            yield m.start(), m.end(), alias


def find_street(title):
    """Returns (canonical_street_name, house_number_or_'') or (None, None).

    Prefers a match immediately preceded by "ul." (explicit street marker),
    since ad titles often mention other place names (districts, landmarks)
    that can otherwise collide with a street alias.
    """
    lower = title.lower()
    matches = list(_match_all(lower))
    if not matches:
        return None, None

    def with_number(end):
        tail = title[end:end + 15]
        num_m = NUMBER_RE.search(tail)
        return num_m.group(0).strip() if num_m else ""

    for start, end, alias in matches:
        if _UL_PREFIX_RE.search(lower[:start]):
            return ALIASES[alias], with_number(end)

    start, end, alias = matches[0]
    return ALIASES[alias], with_number(end)
