---
id:          2026-09-29-reactivated-status-filter
repo:        Bonaventura-EW/parkingi-i-garaze
family:      sonary
date:        2026-09-29
category:    feature
what:        Nowa, piąta wartość statusu oferty — "reactivated" — dla ofert, które zniknęły z listingu i wróciły, widoczna jako własny checkbox filtra na mapie głównej.
why:         `merge_with_history()` liczył reaktywacje od dawna, ale wyłącznie jako agregat na skan (`reactivated_count` w `scraper/history.jsonl`) — nie było pola per ofercie, więc nie dało się na mapie zobaczyć "tylko nowe" vs "tylko wracające", tylko przez tryb suwaka "Zniknięcia".
how:         Zamiast kopiować rozwiązanie brata 1:1 (dwa niezależne, rozłączne AND-checkboxy "Nowe"/"Reaktywowane" obok reszty filtrów), rozszerzyliśmy istniejący, już rozłączny mechanizm `SG.offerStatus()` (`assets/common.js`) o piątą kategorię — bo w tym repo status oferty (new/up/down/unchanged) był już jedną hierarchią z kolejnością pierwszeństwa, a nie osobnym zestawem checkboxów. `merge_with_history()` (`scraper/scrape.py`) zapisuje teraz `o["reactivated"]` per ofertę (prawda, gdy `prev` istniał i był `active: false`), a `offerStatus()` sprawdza to zaraz po `is_new` — reaktywacja wygrywa z jednoczesną zmianą ceny w tym samym skanie (rzadki przypadek: oferta wraca i ma inną cenę), więc nie pokazujemy podwójnej odznaki na karcie oferty. Piąty checkbox "Reaktywowane (wróciły)" w grupie filtrów Status w `index.html`, nowy kolor `.badge-blue` w `assets/style.css`, wpięcie do `FILTER_CHECKBOX_DEFAULTS`/`STATUS_FILTER_KEY`/listenerów w `assets/script.js`. Zero zmian w kształcie `data.json` poza jednym nowym polem — stare wiersze `history.jsonl` nienaruszone.
surface:     scraper/scrape.py, assets/common.js, assets/script.js, assets/style.css, index.html
generality:  family
propagate:   maybe
commit:      HEAD
---

# Kontekst dla brata-ewaluatora

Zmiana odpowiada na [manifest z SONAR-POKOJOWY](https://github.com/Bonaventura-EW/SONAR-POKOJOWY/blob/main/.propagation/changes/2026-09-23-origin-filter-checkboxes.md)
(dwa niezależne AND-checkboxy "Nowe"/"Reaktywowane"), ale **nie jest kopią 1:1**.
U nas status oferty to od początku jedna rozłączna kategoria z ustaloną
kolejnością pierwszeństwa (`is_new` > `price_trend` > `unchanged`), więc
naturalnym miejscem na reaktywację było dopisanie piątej wartości do tej samej
hierarchii, a nie budowanie równoległego zestawu dwóch AND-checkboxów obok. Jeśli
u Was status oferty jest też jedną rozłączną kategorią (a nie osobnymi,
niezależnymi flagami jak u brata z SONAR-POKOJOWY), ten wzorzec — dopisanie
wartości do istniejącej funkcji `offerStatus`-podobnej zamiast kopiowania
mechanizmu filtrów — prawdopodobnie pasuje lepiej niż oryginał.

Warta uwagi decyzja projektowa: **reaktywacja wygrywa z jednoczesną zmianą
ceny.** Jeśli oferta w tym samym skanie wraca z nieaktywności I ma inną cenę,
`offerStatus()` zwraca `"reactivated"`, nie `"up"`/`"down"` — pokazujemy jedną
odznakę (↩), nie dwie. Tekst o zmianie ceny na karcie oferty nadal się
pojawia (bo to fakt niezależny od badge'a), tylko bez duplikującej odznaki
strzałki. Brat tego problemu nie miał, bo jego dwa checkboxy są od siebie
niezależne (AND), nie hierarchiczne.

Pole `o["reactivated"]` żyje tylko jeden skan — tak jak `is_new` — potem
oferta wraca do zwykłej kwalifikacji wg ceny. To NIE jest znacznik "kiedykolwiek
wróciła" trzymany na stałe (manifest brata sugerował tę drugą, trwalszą
semantykę); zdecydowaliśmy się na spójność z istniejącym wzorcem `is_new`
zamiast z dosłownym opisem z manifestu źródłowego.
