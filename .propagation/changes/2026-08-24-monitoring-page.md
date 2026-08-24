---
id:          2026-08-24-monitoring-page
repo:        Bonaventura-EW/parkingi-i-garaze
family:      sonary
date:        2026-08-24
category:    feature
what:        Nowa strona monitoring.html — kondycja scrapera (czas skanu, wydajność per źródło, stan bazy) z alertem, gdy któreś źródło przestaje zwracać oferty.
why:         Sierpniowa blokada OLX (CloudFront WAF) przez ~16 przebiegów z rzędu oddawała 0 ofert, a workflow był cały czas zielony — nie było jak zauważyć awarii bez zaglądania w logi Actions albo w surowy history.jsonl. Analityka pokazuje rynek, nie zdrowie pipeline'u; brakowało warstwy "czy scraper w ogóle działa".
how:         Scraper dopisuje do scraper/history.jsonl metryki operacyjne (duration_s, scraped_olx/scraped_otodom, active_olx/active_otodom, updated_count, total_in_db, raw_cards, skipped_count) — plik zostaje append-only, starych linii nie przepisujemy. monitoring.html czyta ten sam history.jsonl (żadnego nowego pliku danych) i renderuje 4 KPI, 4 wykresy i tabelę 30 ostatnich skanów. Alert martwego źródła liczy się po stronie klienta: trailing streak skanów z scraped_<źródło> === 0 (próg 3), z pominięciem linii sprzed wprowadzenia metryki. Wykresy to ręcznie generowany inline SVG (linia z gapami na null, słupki stackowane) — świadomie bez Chart.js, bo to repo nie ładuje nic z CDN-a.
surface:     monitoring.html, assets/monitoring.js, assets/style.css, scraper/scrape.py, index.html, ostatnie.html, top5.html, analityka.html, pominiete.html, sitemap.xml, README.md
generality:  family
propagate:   yes
commit:      HEAD
---

# Kontekst dla brata-ewaluatora

Pomysł i układ strony pochodzą z brata `Bonaventura-EW/Sprzedaz-mieszkan`
(`monitoring.html`) — to adaptacja, nie oryginał. Dwie rzeczy zrobiliśmy inaczej
i warto się nad nimi zastanowić u siebie:

1. **Bez Chart.js z CDN-a.** Brat ładuje `cdn.jsdelivr.net/npm/chart.js`. To repo
   ma zasadę „zero CDN" (Leaflet jest zvendorowany w `assets/vendor/`), więc
   wykresy są ręcznym SVG w `assets/monitoring.js` (~90 linii na dwa typy wykresu).
   Jeśli brat już wozi Chart.js na innych stronach, jego wersja jest prostsza —
   nie kopiuj naszego SVG na siłę.
2. **Bez osobnego `monitoring_data.json`.** Brat generuje dedykowany plik z
   preagregowanymi statystykami i `source_alerts`. My czytamy istniejący
   `history.jsonl` i liczymy KPI oraz alerty w przeglądarce — jeden plik danych
   mniej do utrzymania i do commitowania przy każdym skanie. Przy naszej skali
   (2 skany dziennie, ~120 linii) to bez znaczenia dla wydajności; przy repo
   z dużo częstszymi skanami preagregacja może się zacząć opłacać.

**Kompatybilność wstecz jest tu istotna.** `history.jsonl` jest append-only i
starsze linie nie mają nowych pól. Cały frontend traktuje brak pola jako `null`
i rysuje „—" / przerwę w linii, zamiast się wywracać. Alert martwego źródła
przerywa liczenie streaka na pierwszej linii bez metryki, żeby archiwalne skany
nie generowały fałszywego alarmu. Jeśli brat adaptuje tę zmianę, niech nie
próbuje backfillować historii — po prostu od momentu wdrożenia wykresy zaczną
mieć dane.

Próg alertu (3 skany z rzędu po 0 ofert) jest dobrany pod cron 2×/dobę — to
około półtora dnia ciszy. Przy częstszych skanach warto podnieść `DEAD_SOURCE_SCANS`.
