# Changelog

Wszystkie istotne zmiany w tym projekcie są notowane w tym pliku.

Format wzorowany na [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/).
Projekt nie ma numerów wersji — wpisy są datowane, najnowsze na górze.
Automatyczne commity odświeżające dane (`chore: refresh scraped offers`)
nie są tu odnotowywane.

## 2026-09-22

### Dodane

- **Analityka**: nowa sekcja „Zmiany cen: podrożenia i potanienia" — dwa
  wykresy pokazujące, ile ofert w danym skanie obniżyło, a ile podniosło cenę.
  Dotąd `history.jsonl` liczył tylko sumę zmian cen (bez kierunku); scraper
  teraz rozbija ją na `price_drop_count`/`price_increase_count`, licząc
  zdarzenia, nie oferty (dwie obniżki jednej oferty w jednym skanie to dwa
  punkty). Suma obu (`updated_count` w monitoringu) zostaje bez zmian.
  (Propagacja z repo-brata `SONAR-POKOJOWY`.)

### Naprawione

- Wykresy „Ruch na rynku w czasie" (`analityka.html`) nie liczą już fałszywego
  odpływu, gdy OLX był przez dłuższy czas niedostępny: zaległość dezaktywacji
  z blokady nie ląduje jednym wielkim skokiem w dniu powrotu źródła. Skan, po
  którym nic nie dało się porównać z poprzednim stanem, jest teraz oznaczany
  jako `coverage_gap` w `scraper/history.jsonl` — napływ/odpływ/reaktywacje z
  takiego skanu rysują się jako przerwa na wykresie, nie jako zero (cisza na
  rynku) ani jako sztuczny rekord. (Propagacja z repo-brata `Sprzedaz-mieszkan`,
  uzupełnienie #18 przed wystawieniem sekcji „Ruch na rynku" na produkcję.)

## 2026-09-09

### Dodane

- **Analityka**: nowa sekcja „Ruch na rynku w czasie" — wykresy napływu (nowe
  oferty), odpływu (oferty, które zniknęły) i reaktywacji (oferty wracające po
  zniknięciu) na skan. Odpowiada na pytanie „czy podaż rośnie czy maleje i ile
  z ruchu to recykling ogłoszeń", którego sam przekrój „tu i teraz" nie pokrywał.
  Napływ i odpływ pochodzą z liczników, które scraper już zapisywał; doszedł
  tylko licznik reaktywacji (`reactivated_count` w `scraper/history.jsonl`),
  liczony w tym samym przebiegu scalania, żeby trzy przepływy bilansowały się
  z jednego źródła. Starsze skany bez tego pola zostają luką, nie zerem.
  Propagacja z repo-brata (`SONAR---DZIA-KOWY`); u nas bez zewnętrznej biblioteki
  wykresów — te same inline'owe SVG, co reszta analityki.

### Zmienione

- Scraper próbuje teraz **łańcucha profili impersonacji TLS** (`chrome124` →
  `chrome131` → `chrome110` → `safari17_0` → `edge101`) zamiast jednego zaszytego
  na sztywno. Gdy OLX zablokuje pojedynczy fingerprint JA3 (np. po zmianie po
  stronie WAF), skan sięga po kolejny profil zamiast po cichu spaść do zera ofert
  — jak zdarzyło się na 26 przebiegów przed wdrożeniem impersonacji. Sprawny
  profil jest próbowany pierwszy, więc zdrowy skan nic nie kosztuje. Dodatkowo
  `curl_cffi` jest teraz importem opcjonalnym: jego brak degraduje `fetch()` do
  gołego `requests`, zamiast wywalać cały skan `ImportError`-em. Propagacja z
  repo-brata (`SONAR---DZIA-KOWY`).

### Naprawione

- Nieudany skan OLX (blokada WAF, zmiana odcisku TLS, timeout sieci) nie
  oznacza już wszystkich aktywnych ofert jako „zniknęłe". Gdy skan nie zwróci
  ani jednej oferty do naniesienia na mapę, a poprzedni przebieg je miał,
  scraper traktuje to jako awarię źródła: zamraża ostatni znany stan zamiast
  masowo dezaktywować oferty i głośno ostrzega w logach. Dotychczasowy alarm
  martwego źródła w `monitoring.html` działa niezależnie i nadal się odpala.
  (Propagacja z repo-brata `SONAR---DZIA-KOWY` — jedna z lekcji z audytu
  wykresów rynku, zaadaptowana do naszego pipeline'u.)

## 2026-09-01

### Dodane

- `monitoring.html` alarmuje teraz również o **degradacji źródła**, a nie tylko
  o jego całkowitej śmierci: gdy OLX lub Otodom nadal zwraca oferty, ale spada
  poniżej 30% swojej zwykłej liczby (mediana ostatnich niezerowych skanów),
  pojawia się bursztynowe ostrzeżenie o możliwym throttlingu / częściowej
  blokadzie. Pełny brak ofert przez 3 skany wciąż daje czerwony alarm krytyczny.
  Propagacja z repo-brata (`SONAR---DZIA-KOWY`).
- **Analityka**: nowa sekcja „Wyróżnione (promowane) oferty w czasie" —
  wykresy liczby płatnie promowanych ofert OLX i ich udziału w rynku.
  Scraper czyta status promowania z atrybucji, którą OLX dokleja do linku
  kafelka (`search_reason=search|promoted`), i zapisuje dzienny licznik
  w `scraper/history.jsonl` (`promoted_count`). Gdy OLX przestanie zwracać
  atrybucję, skan ostrzega w logach, zamiast po cichu raportować 0%.
  (Propagacja z repo-brata `SONAR-POKOJOWY`.)
- Nowa strona **`okazje.html`** — ranking ofert wyraźnie tańszych od **mediany
  porównywalnej grupy** (ten sam typ i rodzaj transakcji), a nie od całego rynku.
  Dotąd `top5.html` sortował po surowej cenie / cenie za m², przez co na górze
  lądowały po prostu najtańsze kategorie, a nie realnie zaniżone oferty. Przy
  każdej ofercie widać, z czym ją porównano (etykieta grupy i jej liczebność).
  Oferty nietypowe (udziały, licytacje, cesje, ceny podejrzanie niskie) są
  wykluczone z liczenia median i domyślnie ukryte — checkbox przywraca je z
  ostrzeżeniem. Pomysł zaadaptowany z repo-brata (`sprzedaz-mieszkan`); u nas
  porównujemy cenę surową (garaż / miejsce to produkt jednorodny, a powierzchnia
  w danych jest rzadka), a nie cenę za m² jak przy mieszkaniach.

### Zmienione

- Nawigacja na wszystkich stronach zawiera link do Okazji; `sitemap.xml`
  uzupełniony o `okazje.html`.

## 2026-08-24

### Dodane

- Nowa strona **`monitoring.html`** — kondycja samego scrapera (a nie rynku):
  czas wykonania skanu, ile ofert zwraca każde źródło, jak rośnie baza, ruch
  ofert oraz tabela ostatnich 30 skanów. Sierpniowa blokada OLX (WAF) przez
  kilka dni oddawała 0 ofert i nie było tego jak zauważyć bez zaglądania
  w logi — strona pokazuje teraz **alert**, gdy któreś źródło nie zwraca
  ofert przez 3 skany z rzędu.
- Scraper zapisuje w `scraper/history.jsonl` metryki potrzebne do monitoringu:
  `duration_s`, `scraped_olx`, `scraped_otodom`, `active_olx`, `active_otodom`,
  `updated_count`, `total_in_db`, `raw_cards`, `skipped_count`.
- `CHANGELOG.md` (ten plik) oraz opis projektu i zasad pracy w `CLAUDE.md`.

### Zmienione

- Nawigacja na wszystkich stronach zawiera link do Monitoringu.
- `sitemap.xml` uzupełniony o `analityka.html`, `monitoring.html` i
  `pominiete.html`, których wcześniej w nim brakowało.

## Wcześniej

Zmiany sprzed 2026-08-24 nie były notowane w changelogu — historia jest
w `git log`. Ostatnia istotna z nich to obejście blokady OLX CloudFront
przez impersonację TLS Chrome'a w `curl_cffi` (commit `877a4cc`).
