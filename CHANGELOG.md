# Changelog

Wszystkie istotne zmiany w tym projekcie są notowane w tym pliku.

Format wzorowany na [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/).
Projekt nie ma numerów wersji — wpisy są datowane, najnowsze na górze.
Automatyczne commity odświeżające dane (`chore: refresh scraped offers`)
nie są tu odnotowywane.

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
