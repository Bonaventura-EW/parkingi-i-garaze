# SONAR GARAŻOWY

Mapa ofert garaży i miejsc parkingowych (sprzedaż i wynajem) w Lublinie,
zbieranych z OLX i Otodom — w tym samym duchu co pozostałe sonary:
[SONAR-POKOJOWY](https://bonaventura-ew.github.io/SONAR-POKOJOWY/),
[SONAR-MIESZKANIOWY](https://bonaventura-ew.github.io/SONAR-MIESZKANIOWY/),
[SONAR-DZIAŁKOWY](https://bonaventura-ew.github.io/SONAR---DZIA-KOWY/),
[Sprzedaz-mieszkan](https://bonaventura-ew.github.io/Sprzedaz-mieszkan/).

## Strony

- `index.html` — mapa (Leaflet). Filtry: transakcja, typ, źródło, dokładność lokalizacji,
  status (nowe / cena wzrosła / spadła / bez zmian, plus warstwa zniknionych ofert),
  data dodania (z histogramem 30 dni), cena, ulubione, wyszukiwarka tekstowa. Przybliżone
  lokalizacje pokazują pinezkę + półprzezroczysty okrąg obszaru zamiast punktu. Narzędzie
  "punkt odniesienia" — kliknij, żeby ustawić pinezkę (np. swój dom) i filtrować/sortować
  oferty wg odległości. Panel szczegółów oferty, eksport widocznych ofert do CSV,
  udostępnianie widoku przez link (filtry w URL).
- `ostatnie.html` — lista ofert posortowana wg daty dodania/odświeżenia, z filtrami
  typu/transakcji/ulubionych, eksportem CSV i statusami (N/↑/↓) przy każdej pozycji.
- `top5.html` — najtańsze oferty w każdej kategorii (garaż/parking × sprzedaż/wynajem)
  oraz najniższa cena za m² dla garaży na sprzedaż.
- `analityka.html` — trend liczby aktywnych ofert i średnich cen w czasie (na podstawie
  historii skanów), ranking lokalizacji wg liczby ofert, tabela historii skanów.
- `pominiete.html` — pełna przejrzystość: ogłoszenia z kategorii OLX, które klasyfikator
  odrzucił, wraz z powodem (inny temat / inna miejscowość / produkt-blaszak bez adresu).

Ulubione oferty (⭐) są zapisywane w localStorage przeglądarki i działają na każdej stronie.

## Struktura

- `assets/common.js` — helpery współdzielone przez wszystkie strony (kolory, etykiety,
  wczytywanie `data.json`, ulubione, eksport CSV, badge statusu oferty).
- `assets/script.js`, `assets/ostatnie.js`, `assets/top5.js`, `assets/analityka.js`,
  `assets/pominiete.js` — logika poszczególnych stron.
- `assets/vendor/` — Leaflet i Leaflet.markercluster zvendorowane lokalnie (bez CDN).
- `data.json` — aktywne (i niedawno zniknięte) oferty, generowane przez scraper.
- `skipped.json` — ogłoszenia pominięte przez klasyfikator, z powodem (dla `pominiete.html`).
- `scraper/history.jsonl` — jedna linia JSON na każde uruchomienie scrapera (liczba
  aktywnych/nowych/zniknionych ofert, średnie ceny, % adresów dokładnych) — źródło danych
  dla `analityka.html`.
- `scraper/scrape.py` — scraper OLX, klasyfikacja ofert, geokodowanie, śledzenie historii
  cen/dat między uruchomieniami, zapis `data.json` / `skipped.json` / `history.jsonl`.
- `scraper/streets.py` + `scraper/lublin_streets.json` — dopasowywanie nazw ulic z
  tytułów i treści ogłoszeń do rzeczywistych ulic Lublina (snapshot z OpenStreetMap/Overpass),
  łącznie z potocznymi aliasami (np. "ul. Sowińskiego" dla oficjalnej "Józefa Sowińskiego").
- `.github/workflows/scrape.yml` — cykliczne odświeżanie danych i deploy na GitHub Pages.

## Śledzenie historii ofert

Każde uruchomienie scrapera wczytuje poprzedni `data.json` i scala go ze świeżo
zescrapowanymi ofertami:

- oferta widziana po raz pierwszy → `is_new: true`, trafia do warstwy "Nowe";
- zmiana ceny → `price_trend: "up"/"down"`, poprzednia cena i data zmiany są zapamiętane;
- oferta, która zniknęła z OLX → zostaje na mapie jako nieaktywna (wyszarzona, wyłączona
  domyślnie) przez 30 dni, potem jest usuwana na stałe.

Dzięki temu mapa pokazuje nie tylko stan bieżący, ale i to, co się zmieniło.

## Źródła danych

- **OLX** (`olx.pl/nieruchomosci/garaze-parkingi/lublin`) — scrapowane bezpośrednio.
- **Otodom** — lista ofert pochodzi z kategorii OLX (obie platformy należą do
  OLX Group), która zawiera sporą część ofert linkujących do otodom.pl. Dla tych
  ofert pobierana jest dodatkowo strona ogłoszenia na Otodomie: ma w osadzonym
  JSON-ie zadeklarowaną przez sprzedającego ulicę, czasem numer i współrzędne
  pinezki — te dane mają pierwszeństwo przed geokodowaniem Nominatim.
  Bezpośredni scraping listy wyników Otodomu to możliwe przyszłe rozszerzenie
  (dawna blokada anty-botowa HTTP 403 już nie występuje; zweryfikowano 2026-07).

Adresy budynków są dopasowywane do rzeczywistych ulic Lublina (`scraper/streets.py`)
i geokodowane przez OpenStreetMap Nominatim. Ulica jest szukana najpierw w tytule
ogłoszenia, a gdy go tam nie ma — w treści ogłoszenia (pobieranej ze strony oferty
na OLX). Gdy nie da się ustalić konkretnej ulicy,
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
