# SONAR GARAŻOWY — instrukcje dla Claude'a

## O projekcie

Statyczna strona (GitHub Pages) z mapą ofert **garaży i miejsc parkingowych w Lublinie**
— sprzedaż i wynajem — zbieranych z OLX (i z Otodomu, którego oferty pojawiają się
w kategorii OLX). Dane odświeża scraper w Pythonie uruchamiany cyklicznie przez
GitHub Actions; wynik commitowany jest z powrotem do repo i deployowany na Pages.

Repo należy do rodziny „sonarów" (patrz sekcja o propagacji na dole).

### Stos technologiczny

- **Frontend**: czysty HTML + CSS + vanilla JS (ES5-owy styl: `var`, `function`,
  IIFE). **Żadnych frameworków, żadnych CDN-ów** — Leaflet i Leaflet.markercluster
  są zvendorowane lokalnie w `assets/vendor/`. Nowe zależności też wchodzą lokalnie
  albo wcale (wykresy na stronach analitycznych to ręcznie generowany inline SVG).
- **Scraper**: Python 3.11, `curl_cffi` (impersonacja TLS Chrome'a — OLX blokuje
  goły `requests` przez WAF), `BeautifulSoup`, Nominatim do geokodowania.
- **Deploy**: `.github/workflows/scrape.yml` — cron 5:00 i 17:00 UTC, potem Pages.

### Strony

| Plik | Co robi |
| --- | --- |
| `index.html` | Mapa Leaflet z filtrami, punktem odniesienia, eksportem CSV |
| `ostatnie.html` | Lista ofert wg daty dodania/odświeżenia |
| `top5.html` | Najtańsze oferty w każdej kategorii |
| `analityka.html` | Trendy **rynku**: liczba ofert i średnie ceny w czasie, ranking lokalizacji |
| `monitoring.html` | Kondycja **scrapera**: czas skanu, wydajność źródeł, stan bazy, alert martwego źródła |
| `pominiete.html` | Ogłoszenia odrzucone przez klasyfikator, z powodem |

`analityka.html` odpowiada na pytanie „co się dzieje na rynku", `monitoring.html`
na „czy scraper w ogóle działa". Nie mieszaj tych dwóch ról.

### Dane

- `data.json` — aktywne i niedawno zniknięte oferty (generowane przez scraper).
- `skipped.json` — ogłoszenia pominięte przez klasyfikator, z powodem.
- `scraper/history.jsonl` — **jedna linia JSON na każde uruchomienie scrapera**;
  źródło dla `analityka.html` i `monitoring.html`.
- `scraper/geocode_cache.json` — cache Nominatim (commitowany, żeby nie odpytywać
  dwa razy o ten sam adres).

Wszystkie cztery pliki są nadpisywane/dopisywane przez workflow — nie edytuj ich ręcznie.

### Konwencje

- **`history.jsonl` jest append-only i wersjonowany „miękko"**: stare linie nie mają
  pól dodanych później. Kod czytający historię musi to znosić — brakujące pole to
  `null`/„—", nie błąd. Nie przepisuj starych linii wstecz.
- Helpery współdzielone między stronami trafiają do `assets/common.js` (obiekt `SG`).
- Teksty w UI po polsku. Escapuj dane z ofert przez `SG.escapeHtml`.
- Nowa strona = wpis w nawigacji **wszystkich** stron + `sitemap.xml` + README.

### Lokalnie

```bash
pip install -r scraper/requirements.txt
python3 scraper/scrape.py     # nadpisuje data.json
python3 -m http.server 8000   # podgląd na http://localhost:8000/
```

## Changelog — obowiązkowo po każdej zmianie

Po **każdej** zmianie w repo dopisz wpis do `CHANGELOG.md` i zacommituj go razem
ze zmianą. Format: [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/),
wpisy datami (projekt nie ma wersji), najnowsze na górze, kategorie
`Dodane` / `Zmienione` / `Naprawione` / `Usunięte`.

Pisz z perspektywy użytkownika strony albo osoby utrzymującej repo — co się
zmieniło i dlaczego, nie jak. Jedno–dwa zdania wystarczą.

Wyjątek: automatyczne commity odświeżające dane (`chore: refresh scraped offers`)
changelogu nie dotykają.

## Propagacja zmian między repo-braćmi

To repo jest częścią rodziny podobnych projektów i czasem warto przenieść nasze
ulepszenia do rodzeństwa. Dlatego kiedy skończysz istotną zmianę — nową funkcję,
refactor, poprawę wydajności albo dostępności, ważną aktualizację zależności —
zostaw krótką notatkę dla repo-braci: co i dlaczego zmieniłeś. Zapisz ją w
`.propagation/changes/` według wzoru z `_TEMPLATE.md` i zacommituj razem ze
zmianą. Pomijaj to przy drobiazgach: literówkach, formatowaniu, rzeczach
istotnych tylko u nas.

Oceniaj uczciwie, na ile zmiana jest przenośna (pole `generality`). Jeśli coś
jest celowo lokalne i ma nas ODRÓŻNIAĆ od braci — tak to oznacz i dopisz dlaczego.
Rozjazd między projektami bywa zamierzony i system ma go szanować, nie zasypywać.

Plików `.propagation/decisions.jsonl` i `.propagation/state/` nie ruszaj ręcznie —
zarządzają nimi automatyczne przebiegi w tle.
