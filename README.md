# SONAR GARAŻOWY

Mapa ofert garaży i miejsc parkingowych (sprzedaż i wynajem) w Lublinie,
zbieranych z OLX i Otodom — w tym samym duchu co pozostałe sonary:
[SONAR-POKOJOWY](https://bonaventura-ew.github.io/SONAR-POKOJOWY/),
[SONAR-MIESZKANIOWY](https://bonaventura-ew.github.io/SONAR-MIESZKANIOWY/),
[SONAR-DZIAŁKOWY](https://bonaventura-ew.github.io/SONAR---DZIA-KOWY/),
[Sprzedaz-mieszkan](https://bonaventura-ew.github.io/Sprzedaz-mieszkan/).

## Strony

- `index.html` — mapa (Leaflet), z filtrami (transakcja, typ, źródło, dokładność
  lokalizacji, cena) i panelem szczegółów oferty.
- `ostatnie.html` — lista ofert posortowana wg daty dodania/odświeżenia, z filtrami
  typu i transakcji.
- `top5.html` — najtańsze oferty w każdej kategorii (garaż/parking × sprzedaż/wynajem)
  oraz najniższa cena za m² dla garaży na sprzedaż.

## Struktura

- `assets/common.js` — helpery współdzielone przez wszystkie strony (kolory, etykiety,
  wczytywanie `data.json`).
- `assets/script.js`, `assets/ostatnie.js`, `assets/top5.js` — logika poszczególnych stron.
- `assets/vendor/` — Leaflet i Leaflet.markercluster zvendorowane lokalnie (bez CDN).
- `data.json` — dane ofert (generowane przez scraper, wczytywane przez strony).
- `scraper/scrape.py` — scraper OLX, klasyfikacja ofert, geokodowanie, zapis `data.json`.
- `scraper/streets.py` + `scraper/lublin_streets.json` — dopasowywanie nazw ulic z
  tytułów ogłoszeń do rzeczywistych ulic Lublina (snapshot z OpenStreetMap/Overpass),
  łącznie z potocznymi aliasami (np. "ul. Sowińskiego" dla oficjalnej "Józefa Sowińskiego").
- `.github/workflows/scrape.yml` — cykliczne odświeżanie danych i deploy na GitHub Pages.

## Źródła danych

- **OLX** (`olx.pl/nieruchomosci/garaze-parkingi/lublin`) — scrapowane bezpośrednio.
- **Otodom** — otodom.pl blokuje bezpośrednie zapytania (ochrona Cloudflare/CloudFront,
  HTTP 403). Kategoria OLX faktycznie zawiera też sporą część ofert linkujących do
  otodom.pl (obie platformy należą do OLX Group), więc te oferty trafiają do danych
  bez omijania zabezpieczeń Otodomu.

Adresy budynków są dopasowywane do rzeczywistych ulic Lublina (`scraper/streets.py`)
i geokodowane przez OpenStreetMap Nominatim. Gdy nie da się ustalić konkretnej ulicy,
oferta jest umieszczana w przybliżeniu (centroid dzielnicy lub środek miasta) i
oznaczona jako "lokalizacja przybliżona" — zawsze warto zweryfikować adres w treści
ogłoszenia. Ogłoszenia jednoznacznie dotyczące sąsiednich miejscowości (np. Świdnik)
są pomijane, żeby nie zaśmiecać mapy Lublina.

## Uruchomienie scrapera lokalnie

```bash
pip install -r scraper/requirements.txt
python3 scraper/scrape.py
```

Nadpisuje `data.json` w katalogu głównym. Cache geokodowania trzymany jest w
`scraper/geocode_cache.json`, żeby nie odpytywać Nominatim ponownie o te same adresy.

## Podgląd strony

Dowolny serwer statyczny w katalogu repo, np.:

```bash
python3 -m http.server 8000
```

i otwórz `http://localhost:8000/`.
