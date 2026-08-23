---
id:          2026-08-23-olx-tls-impersonation
repo:        Bonaventura-EW/parkingi-i-garaze
family:      sonary
date:        2026-08-23
category:    bugfix
what:        fetch() w scraperze przełączony z requests na curl_cffi (impersonate="chrome124"), żeby ominąć blokadę CloudFront WAF na OLX.
why:         OLX zaczął ok. 2026-08-15 twardo blokować ruch requests (HTTP 403 "Request blocked" z CloudFront) — od tego dnia każdy scan cicho zwracał 0 aktywnych ofert (16 przebiegów z rzędu z active_total: 0 w scraper/history.jsonl), bo scrape_olx() traktuje pustą stronę wyników jako "brak nowych ofert" zamiast błąd.
how:         Zwykły requests.get w fetch() zastąpiony curl_cffi.requests.get z impersonate="chrome124" (dopasowane do numeru wersji w istniejącym USER_AGENT_BROWSER, żeby JA3 i deklarowany UA się zgadzały). Wszystkie trzy miejsca łapiące requests.RequestException po wywołaniu fetch() (scrape_olx, fetch_description, otodom_location) przełączone na curl_cffi.requests.exceptions.RequestException. Nominatim (geokodowanie) świadomie zostawiony na zwykłym requests — nie blokuje i impersonacja tam byłaby niepotrzebna/niezgodna z ich usage policy. Dodano curl_cffi>=0.7 do scraper/requirements.txt.
surface:     scraper/scrape.py, scraper/requirements.txt
generality:  family
propagate:   yes
commit:      2da31b5318070c7bcd2a4340c3df66c054493514
---

# Kontekst dla brata-ewaluatora

Nie dało się w 100% zweryfikować na tym sandboksie, czy impersonacja realnie
omija blokadę — środowisko dev idzie przez przechwytujący proxy (TLS MITM),
więc prawdziwy JA3 nigdy nie dociera do OLX. Weryfikacja: `workflow_dispatch`
na faktycznym runnerze GitHub Actions, obserwacja `scraper/history.jsonl`
(`active_total` powinno wrócić > 0).

Jeśli blokada okaże się oparta o reputację IP/ASN datacenter (a nie tylko o
TLS fingerprint), sama impersonacja TLS nie wystarczy — trzeba by iść w
self-hosted runner albo residential proxy, co jest już większym kosztem/
komplikacją.

Jeśli brat scrapuje OLX (lub inny serwis za CloudFront/podobnym WAF) tym samym
wzorcem `requests.get()` z ustawionym tylko nagłówkiem User-Agent, prawdopodobnie
ma/będzie miał to samo zjawisko: workflow "zielony", ale 0 wyników.
