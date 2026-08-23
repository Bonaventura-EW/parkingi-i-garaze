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
