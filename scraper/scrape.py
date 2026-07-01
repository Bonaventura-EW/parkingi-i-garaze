#!/usr/bin/env python3
"""Scrapes garage/parking-spot offers for Lublin from OLX (which also
re-publishes Otodom listings) and rebuilds data.json used by index.html.

Otodom.pl blocks direct automated requests to its search pages (Cloudflare/
CloudFront bot protection returns HTTP 403), so it is not scraped directly.
OLX's own "garaze-parkingi/lublin" category already surfaces a large share of
Otodom-sourced listings (otodom.pl links appear alongside olx.pl ones), which
gives partial Otodom coverage without working around anti-bot protections.

Usage:
    python3 scraper/scrape.py
Writes: data.json (repo root), scraper/geocode_cache.json (cache, committed
so re-runs don't re-hit Nominatim for addresses already resolved).
"""
import hashlib
import json
import os
import random
import re
import sys
import time
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

from streets import find_street

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "geocode_cache.json")
DATA_PATH = os.path.join(ROOT, "data.json")

OLX_BASE = "https://www.olx.pl/nieruchomosci/garaze-parkingi/lublin/"
USER_AGENT_BROWSER = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)
USER_AGENT_NOMINATIM = "parkingi-i-garaze-sonar/0.1 (github.com/Bonaventura-EW/parkingi-i-garaze)"

LUBLIN_BBOX = (22.40, 51.15, 22.70, 51.32)  # lon_min, lat_min, lon_max, lat_max
LUBLIN_CENTER = (51.2465, 22.5684)

DISTRICTS = {
    "czechow": (51.2732, 22.5537), "czechów": (51.2732, 22.5537),
    "weglin": (51.2237, 22.4936), "węglin": (51.2237, 22.4936),
    "weglinek": (51.2237, 22.4936), "węglinek": (51.2237, 22.4936),
    "czuby": (51.2211, 22.5340), "kalinowszczyzna": (51.2571, 22.5865),
    "ponikwoda": (51.2680, 22.5806), "rury": (51.2373, 22.5285),
    "wrotkow": (51.2224, 22.5652), "wrotków": (51.2224, 22.5652),
    "slawinek": (51.2695, 22.5225), "sławinek": (51.2695, 22.5225),
    "srodmiescie": (51.2489, 22.5610), "śródmieście": (51.2489, 22.5610),
    "bronowice": (51.2601, 22.5083), "tatary": (51.2569, 22.5972),
    "botanik": (51.2296, 22.5013), "lsm": (51.2582, 22.5433),
    "dziesiata": (51.2277, 22.5486), "dziesiąta": (51.2277, 22.5486),
    "kosminek": (51.2603, 22.5877), "kośminek": (51.2603, 22.5877),
    "felin": (51.2130, 22.5540), "konstantynow": (51.2380, 22.4930),
    "konstantynów": (51.2380, 22.4930),
}

RENT_KEYWORDS = ["wynajm", "wynajem", "do wynajęcia", "na wynajem", "wynajmę", "wynajme"]
SALE_KEYWORDS = ["sprzedam", "na sprzedaż", "sprzedaz", "sprzedaż"]
PRODUCT_KEYWORDS = [
    "transport", "montaż", "monta", "gatunek", "różne wymiary", "rozne wymiary",
    "profil zamknięty", "profil ocynkowany", "blaszak", "drewnopodobny", "blaszany",
]
PARKING_KEYWORDS = ["miejsce postojowe", "miejsce parkingowe", "postojow", "parking"]
HALA_KEYWORDS = ["hala garażowa", "hala garazowa", "wiata"]
EXCLUDE_KEYWORDS = ["mieszkanie", "pokoj", "pokoje", "kawalerk", "dzialka", "działka", "komórk", "komork", "piwnic"]

MONTHS_PL = {
    "stycznia": 1, "lutego": 2, "marca": 3, "kwietnia": 4, "maja": 5, "czerwca": 6,
    "lipca": 7, "sierpnia": 8, "września": 9, "wrzesnia": 9, "października": 10,
    "pazdziernika": 10, "listopada": 11, "grudnia": 12,
}


def parse_loc_date(loc_raw, now=None):
    """Best-effort parse of OLX's 'location-date' string into an ISO date + label."""
    if not loc_raw:
        return None, None
    now = now or datetime.now(timezone.utc)
    text = loc_raw.split(" - ", 1)[-1].strip()
    m = re.search(r"Dzisiaj\s+o\s+(\d{1,2}):(\d{2})", text, re.I)
    if m:
        return now.strftime("%Y-%m-%d"), "dzisiaj o " + m.group(0).split(" o ")[-1]
    m = re.search(r"(\d{1,2})\s+([a-zżźćńółęąś]+)\s+(\d{4})", text, re.I)
    if m:
        day, month_name, year = m.group(1), m.group(2).lower(), m.group(3)
        month = MONTHS_PL.get(month_name)
        if month:
            try:
                dt = datetime(int(year), month, int(day), tzinfo=timezone.utc)
                return dt.strftime("%Y-%m-%d"), text
            except ValueError:
                pass
    return None, text




def fetch(url, retries=3):
    last_err = None
    for attempt in range(retries):
        try:
            resp = requests.get(url, headers={"User-Agent": USER_AGENT_BROWSER}, timeout=20)
            resp.raise_for_status()
            return resp.text
        except requests.RequestException as e:
            last_err = e
            time.sleep(2 * (attempt + 1))
    raise last_err


def parse_page(html):
    soup = BeautifulSoup(html, "html.parser")
    cards = soup.find_all(attrs={"data-cy": "l-card"})
    out = []
    for c in cards:
        title_el = c.find(attrs={"data-testid": "ad-card-title"})
        a = title_el.find("a") if title_el else None
        title = None
        if a:
            title = a.get("aria-label") or (a.find("h4").get_text(strip=True) if a.find("h4") else None)
        link = a["href"] if a else None
        if link and link.startswith("/"):
            link = "https://www.olx.pl" + link
        price_el = c.find(attrs={"data-testid": "ad-price"})
        price_raw = price_el.get_text(strip=True) if price_el else None
        loc_el = c.find(attrs={"data-testid": "location-date"})
        loc_raw = loc_el.get_text(strip=True) if loc_el else None
        if c.get("id") and title:
            out.append({"id": c["id"], "title": title, "link": link, "price_raw": price_raw, "loc_raw": loc_raw})
    return out


def scrape_olx(max_pages=20):
    items = {}
    page = 1
    while page <= max_pages:
        url = OLX_BASE if page == 1 else f"{OLX_BASE}?page={page}"
        try:
            html = fetch(url)
        except requests.RequestException as e:
            print(f"HTTP error on page {page}: {e}", file=sys.stderr)
            break
        page_items = parse_page(html)
        if not page_items:
            break
        new_count = 0
        for it in page_items:
            if it["id"] not in items:
                items[it["id"]] = it
                new_count += 1
        if new_count == 0:
            break
        page += 1
        time.sleep(1.5)
    return list(items.values())


def clean_price(raw):
    if not raw:
        return None, False
    negotiable = "negocjacji" in raw.lower()
    digits = re.sub(r"[^\d]", "", raw.split("zł")[0])
    if not digits:
        return None, negotiable
    return int(digits), negotiable


def classify(title, price, has_street):
    t = title.lower()
    is_product = any(k in t for k in PRODUCT_KEYWORDS) and "ul." not in t and not has_street
    if any(k in t for k in RENT_KEYWORDS):
        transaction = "wynajem"
    elif any(k in t for k in SALE_KEYWORDS):
        transaction = "sprzedaz"
    else:
        transaction = "wynajem" if (price or 0) < 5000 else "sprzedaz"
    if any(k in t for k in PARKING_KEYWORDS):
        typ = "miejsce_parkingowe"
    elif any(k in t for k in HALA_KEYWORDS):
        typ = "hala_wiata"
    else:
        typ = "garaz"
    return transaction, typ, is_product


def find_address(title):
    street, number = find_street(title)
    if street:
        return street, number, "street"
    tl = title.lower()
    for key, _ in DISTRICTS.items():
        if key in tl:
            return key, "", "district"
    return None, None, None


def classify_items(raw_items):
    items = []
    for r in raw_items:
        title = r["title"] or ""
        if any(k in title.lower() for k in EXCLUDE_KEYWORDS):
            continue
        price, negotiable = clean_price(r["price_raw"])
        street, number, kind = find_address(title)
        transaction, typ, is_product = classify(title, price, has_street=bool(street))
        items.append({
            "id": r["id"], "title": title, "link": r["link"], "price": price,
            "negotiable": negotiable, "transaction": transaction, "type": typ,
            "is_product": is_product, "street": street, "number": number,
            "addr_kind": kind, "loc_raw": r["loc_raw"],
            "source": "otodom" if "otodom.pl" in (r["link"] or "") else "olx",
        })
    return items


def load_cache():
    try:
        with open(CACHE_PATH, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}


def in_bbox(lat, lon):
    return LUBLIN_BBOX[0] <= lon <= LUBLIN_BBOX[2] and LUBLIN_BBOX[1] <= lat <= LUBLIN_BBOX[3]


def nominatim(query, cache):
    if query in cache:
        return cache[query]
    result = None
    try:
        resp = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": query, "format": "json", "limit": 1, "countrycodes": "pl"},
            headers={"User-Agent": USER_AGENT_NOMINATIM},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        if data:
            lat, lon = float(data[0]["lat"]), float(data[0]["lon"])
            if in_bbox(lat, lon):
                result = {"lat": lat, "lon": lon}
    except Exception as e:
        print(f"geocode error for {query!r}: {e}", file=sys.stderr)
    cache[query] = result
    time.sleep(1.1)
    return result


def geocode_items(items, cache):
    for it in items:
        if it["addr_kind"] == "street" and it["street"]:
            q1 = f"{it['street']} {it['number']}, Lublin, Polska".strip()
            q2 = f"{it['street']}, Lublin, Polska"
            r = nominatim(q1, cache) if it["number"] else None
            precision = "exact"
            if not r:
                r = nominatim(q2, cache)
                precision = "street"
            if r:
                it["geo"] = r
                it["precision"] = precision
                it["resolved_address"] = f"{it['street']} {it['number']}".strip()
                continue
        it["geo"] = None
        it["precision"] = None
    return items


def jitter(lat, lon, seed, spread=0.006):
    h = int(hashlib.md5(seed.encode("utf-8")).hexdigest(), 16)
    rnd = random.Random(h)
    return lat + (rnd.random() - 0.5) * spread, lon + (rnd.random() - 0.5) * spread


def district_coords(key):
    key = key.strip().lower()
    for k, v in DISTRICTS.items():
        if k in key or key in k:
            return v
    return LUBLIN_CENTER


def price_stats(subset):
    prices = [o["price"] for o in subset if o["price"]]
    if not prices:
        return {"count": len(subset), "avg": None, "min": None, "max": None}
    return {"count": len(subset), "avg": round(sum(prices) / len(prices)), "min": min(prices), "max": max(prices)}


def assemble(items):
    on_map, off_map = [], []
    for it in items:
        if it["is_product"]:
            off_map.append(it)
            continue
        if it.get("geo"):
            lat, lon = it["geo"]["lat"], it["geo"]["lon"]
            precision = it["precision"]
            address = it.get("resolved_address") or it["street"]
        elif it["addr_kind"] == "district" and it["street"]:
            base = district_coords(it["street"])
            lat, lon = jitter(base[0], base[1], it["id"], spread=0.01)
            precision = "district"
            address = it["street"].strip().title()
        else:
            lat, lon = jitter(LUBLIN_CENTER[0], LUBLIN_CENTER[1], it["id"], spread=0.03)
            precision = "unknown"
            address = "Lublin (lokalizacja nieznana)"

        date_iso, date_label = parse_loc_date(it["loc_raw"])
        on_map.append({
            "id": it["id"], "url": it["link"], "source": it["source"], "title": it["title"],
            "price": it["price"], "negotiable": it["negotiable"], "transaction": it["transaction"],
            "type": it["type"], "lat": round(lat, 6), "lon": round(lon, 6),
            "precision": precision, "address": address, "loc_raw": it["loc_raw"],
            "date_iso": date_iso, "date_label": date_label,
        })

    markers = {}
    for o in on_map:
        key = (round(o["lat"], 4), round(o["lon"], 4))
        if key not in markers:
            markers[key] = {"coords": {"lat": key[0], "lon": key[1]}, "address": o["address"], "offers": []}
        markers[key]["offers"].append(o)

    now = datetime.now(timezone.utc)
    return {
        "generated_at": now.strftime("%d.%m.%Y %H:%M"),
        "sources": ["olx.pl", "otodom.pl (via OLX)"],
        "city": "Lublin",
        "stats": {
            "total_offers": len(on_map),
            "garaz_sprzedaz": price_stats([o for o in on_map if o["type"] == "garaz" and o["transaction"] == "sprzedaz"]),
            "garaz_wynajem": price_stats([o for o in on_map if o["type"] == "garaz" and o["transaction"] == "wynajem"]),
            "parking_wynajem": price_stats([o for o in on_map if o["type"] == "miejsce_parkingowe" and o["transaction"] == "wynajem"]),
            "parking_sprzedaz": price_stats([o for o in on_map if o["type"] == "miejsce_parkingowe" and o["transaction"] == "sprzedaz"]),
        },
        "markers": list(markers.values()),
        "off_map_products": [
            {"id": i["id"], "url": i["link"], "title": i["title"], "price": i["price"]} for i in off_map
        ],
    }


def main():
    print("Scraping OLX (garaze-parkingi/lublin)...", file=sys.stderr)
    raw_items = scrape_olx()
    print(f"Fetched {len(raw_items)} raw cards", file=sys.stderr)

    items = classify_items(raw_items)
    print(f"Classified {len(items)} garage/parking offers", file=sys.stderr)

    cache = load_cache()
    items = geocode_items(items, cache)
    with open(CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)

    data = assemble(items)
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Wrote {DATA_PATH}: {len(data['markers'])} markers, {data['stats']['total_offers']} offers on map", file=sys.stderr)


if __name__ == "__main__":
    main()
