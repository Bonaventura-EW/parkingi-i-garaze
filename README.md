# SONAR GARAŻOWY

Mapa ofert garaży i miejsc parkingowych (sprzedaż i wynajem) w Lublinie,
zbieranych z OLX i Otodom — w tym samym duchu co pozostałe sonary:
[SONAR-POKOJOWY](https://bonaventura-ew.github.io/SONAR-POKOJOWY/),
[SONAR-MIESZKANIOWY](https://bonaventura-ew.github.io/SONAR-MIESZKANIOWY/),
[SONAR-DZIAŁKOWY](https://bonaventura-ew.github.io/SONAR---DZIA-KOWY/),
[Sprzedaz-mieszkan](https://bonaventura-ew.github.io/Sprzedaz-mieszkan/).

## Struktura

- `index.html`, `assets/style.css`, `assets/script.js` — statyczna strona z mapą Leaflet.
- `data.json` — dane ofert (generowane przez scraper, wczytywane przez stronę).
- `scraper/scrape.py` — scraper OLX + geokodowanie adresów (Nominatim/OSM).
- `.github/workflows/scrape.yml` — cykliczne odświeżanie danych i deploy na GitHub Pages.

## Źródła danych

- **OLX** (`olx.pl/nieruchomosci/garaze-parkingi/lublin`) — scrapowane bezpośrednio.
- **Otodom** — otodom.pl blokuje bezpośrednie zapytania (ochrona Cloudflare/CloudFront,
  HTTP 403). Kategoria OLX faktycznie zawiera też sporą część ofert linkujących do
  otodom.pl (obie platformy należą do OLX Group), więc te oferty trafiają do danych
  bez omijania zabezpieczeń Otodomu.

Adresy budynków są wyciągane heurystycznie z tytułu ogłoszenia i geokodowane przez
OpenStreetMap Nominatim. Gdy nie da się ustalić konkretnej ulicy, oferta jest
umieszczana w przybliżeniu (centroid dzielnicy lub środek miasta) i oznaczona jako
"lokalizacja przybliżona" — zawsze warto zweryfikować adres w treści ogłoszenia.

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
