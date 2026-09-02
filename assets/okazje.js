(function () {
    "use strict";

    // Ranking „okazji": każdą ofertę porównujemy z MEDIANĄ jej grupy porównawczej,
    // a nie z całym rynkiem — tanie kategorie same z siebie nie robią już z oferty
    // okazji. Adaptacja pomysłu brata (Bonaventura-EW/sprzedaz-mieszkan, „Okazje"):
    // u mieszkań osią było zł/m² i dzielnica + pokoje; u nas powierzchnia jest w
    // danych rzadkością (kilkanaście z ~150 ofert), a garaż / miejsce to produkt
    // dużo bardziej jednorodny niż mieszkanie, więc porównujemy CENĘ SUROWĄ w
    // obrębie grupy (typ + transakcja). Reszta mechaniki przenosi się 1:1:
    // kaskada grup z progiem próbki, rabat względem mediany grupy, wykluczenie
    // ofert nietypowych z liczenia median i ukrycie ich (odwracalne).

    var MIN_SAMPLE = 5;          // ile ofert musi liczyć grupa, żeby jej mediana coś znaczyła
    var ATYPICAL_RATIO = 0.55;   // poniżej tego ułamka mediany grupy = „podejrzanie tanie"

    // Osie porównania od najwęższej w dół. U mieszkań kaskada miała kilka
    // poziomów (dzielnica+pokoje+rynek → …); w naszych danych nie ma pola dzielnicy,
    // a jedyną wiarygodną osią jest typ + transakcja — łączenie garaży z miejscami
    // albo sprzedaży z wynajmem porównywałoby zupełnie różne produkty. Struktura
    // kaskady zostaje (łatwo dołożyć poziom, gdy przybędzie danych), ale poziom
    // jest na razie jeden.
    var GROUP_LEVELS = [
        { label: "typ + transakcja", keyOf: function (o) { return o.type + "|" + o.transaction; } },
    ];

    // Słowa-klucze ofert nietypowych — napisane od zera dla garaży / miejsc
    // (regexy brata dotyczyły mieszkań: TBS, SIM, prawo lokatorskie…). Skanujemy
    // TYLKO tytuł: w opisie „udział" bywa niewinny, a fałszywy alarm psuje zaufanie
    // do rankingu bardziej niż przeoczenie, które i tak złapie próg cenowy.
    var ATYPICAL_RE = /udzia[łl]|wsp[óo][łl]w[łl]asn|licytac|komornicz|syndyk|przetarg|cesj[aeię]|zamieni|zamian[aę]|dzier[żz]aw[aeęy]\s+grunt/i;

    var allOffers = [];
    var currentFiltered = [];

    function median(nums) {
        if (!nums.length) return null;
        var s = nums.slice().sort(function (a, b) { return a - b; });
        var mid = Math.floor(s.length / 2);
        return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
    }

    function keywordAtypical(o) {
        return ATYPICAL_RE.test(o.title || "");
    }

    // Medianę grupy liczymy tak, żeby oferty nietypowe jej NIE zaniżały —
    // dwuprzebiegowo, bo próg cenowy sam potrzebuje mediany (jajko i kura):
    //   1. mediana wstępna z ofert bez nietypowych słów-kluczy,
    //   2. odrzucamy dodatkowo te poniżej progu ATYPICAL_RATIO tej mediany i
    //      liczymy medianę finalną. Dzięki temu deklaracja w UI („wykluczona
    //      z liczenia mediany") jest prawdziwa dla OBU rodzajów nietypowości.
    function groupMedian(group) {
        var clean = group.filter(function (p) { return p.price != null && !keywordAtypical(p); });
        if (clean.length < MIN_SAMPLE) return null;
        var prelim = median(clean.map(function (p) { return p.price; }));
        var trimmed = clean.filter(function (p) { return p.price >= prelim * ATYPICAL_RATIO; });
        var base = trimmed.length >= MIN_SAMPLE ? trimmed : clean;
        return { median: median(base.map(function (p) { return p.price; })), n: base.length };
    }

    // Kaskada osi porównania od najwęższej w dół — zwraca pierwszy poziom,
    // którego grupa ma dość próbki po odsianiu ofert nietypowych.
    function comparisonFor(o, pool) {
        for (var i = 0; i < GROUP_LEVELS.length; i++) {
            var level = GROUP_LEVELS[i];
            var key = level.keyOf(o);
            var group = pool.filter(function (p) { return level.keyOf(p) === key; });
            var m = groupMedian(group);
            if (m) return { label: level.label, median: m.median, n: m.n };
        }
        return null;
    }

    // Wzbogaca ofertę o pola okazji: medianę grupy, rabat, oszczędność i powód
    // ewentualnej „nietypowości" (słownik albo próg cenowy). Oferty bez wiarygodnej
    // grupy albo bez ceny wypadają z rankingu (zwracamy null).
    function enrich(o, pool) {
        if (o.price == null) return null;
        var cmp = comparisonFor(o, pool);
        if (!cmp || !cmp.median) return null;
        var discount = (cmp.median - o.price) / cmp.median; // >0 = taniej niż mediana
        var reason = null;
        if (keywordAtypical(o)) reason = "słowa-klucze (udział / licytacja / cesja itp.)";
        else if (o.price < cmp.median * ATYPICAL_RATIO) reason = "cena podejrzanie niska (< " + Math.round(ATYPICAL_RATIO * 100) + "% mediany grupy)";
        return {
            offer: o,
            median: cmp.median,
            groupLabel: cmp.label,
            groupN: cmp.n,
            discount: discount,
            saving: cmp.median - o.price,
            atypical: !!reason,
            atypicalReason: reason,
        };
    }

    function pct(x) { return (x >= 0 ? "−" : "+") + Math.abs(Math.round(x * 100)) + "%"; }

    function rowHtml(row, rank) {
        var o = row.offer;
        var typeLabel = SG.TYPE_LABELS[o.type] || o.type;
        var txLabel = o.transaction === "wynajem" ? "Wynajem" : "Sprzedaż";
        var savingTxt = row.saving > 0
            ? "taniej o " + Math.round(row.saving).toLocaleString("pl-PL") + (o.transaction === "wynajem" ? " zł/mies." : " zł")
            : "drożej o " + Math.round(-row.saving).toLocaleString("pl-PL") + (o.transaction === "wynajem" ? " zł/mies." : " zł");
        var basis = "⚖️ Porównano z medianą (" + SG.escapeHtml(row.groupLabel) + ", n=" + row.groupN + "): " +
            Math.round(row.median).toLocaleString("pl-PL") + (o.transaction === "wynajem" ? " zł/mies." : " zł");
        var discountPill = row.discount > 0
            ? '<span class="offer-tag okazja-discount">' + pct(row.discount) + " · " + savingTxt + "</span>"
            : '<span class="offer-tag">' + pct(row.discount) + "</span>";
        var atypicalNote = row.atypical
            ? '<div class="offer-row-meta okazja-atypical-note">⚠️ Oferta nietypowa: ' + SG.escapeHtml(row.atypicalReason) +
              " — sprawdź ogłoszenie, wykluczona z liczenia mediany.</div>"
            : "";
        return (
            '<a class="offer-row' + (row.atypical ? " okazja-atypical" : "") + '" href="' + o.url + '" target="_blank" rel="noopener">' +
            '<div class="offer-row-left">' +
            '<div class="offer-row-main">' +
            '<span class="offer-tag offer-rank">#' + rank + "</span>" +
            '<span class="offer-tag">' + typeLabel + "</span>" +
            '<span class="offer-tag">' + txLabel + "</span>" +
            '<span class="offer-tag">' + o.source + "</span>" +
            "<strong>" + SG.escapeHtml(o.title) + "</strong>" +
            "</div>" +
            '<div class="offer-row-meta">📍 ' + SG.escapeHtml(o.address) + " · " + SG.precisionLabel(o) + "</div>" +
            '<div class="offer-row-meta">' + basis + "</div>" +
            '<div class="offer-row-main">' + discountPill + "</div>" +
            atypicalNote +
            "</div>" +
            '<div class="offer-row-price">' + SG.fmtPrice(o) + "</div>" +
            SG.favoriteBtnHtml(o.id, "offer-row-fav") +
            "</a>"
        );
    }

    function render() {
        var typeFilter = document.getElementById("list-filter-type").value;
        var txFilter = document.getElementById("list-filter-transaction").value;
        var favoritesOnly = document.getElementById("list-filter-favorites").checked;
        var showAtypical = document.getElementById("list-filter-atypical").checked;
        var sortKey = document.getElementById("list-sort").value;

        // Medianę liczymy z pełnej puli aktywnych ofert (grupa = cały rynek danego
        // typu+transakcji), niezależnie od filtrów widoku — filtry zawężają tylko to,
        // co pokazujemy, nie bazę porównania.
        var pool = allOffers.filter(function (o) { return o.active !== false; });
        var enriched = pool.map(function (o) { return enrich(o, pool); }).filter(Boolean);

        // Ranking: oferty tańsze niż mediana grupy (rabat > 0). Nietypowe domyślnie
        // ukryte — checkbox je przywraca (z bursztynową ramką i powodem).
        var rows = enriched.filter(function (r) {
            if (r.discount <= 0) return false;
            if (r.atypical && !showAtypical) return false;
            var o = r.offer;
            if (favoritesOnly && !SG.favorites.has(o.id)) return false;
            if (typeFilter !== "all" && o.type !== typeFilter) return false;
            if (txFilter !== "all" && o.transaction !== txFilter) return false;
            return true;
        });

        rows.sort(function (a, b) {
            return sortKey === "saving" ? b.saving - a.saving : b.discount - a.discount;
        });

        currentFiltered = rows.map(function (r) { return r.offer; });
        var hiddenAtypical = enriched.filter(function (r) { return r.discount > 0 && r.atypical; }).length;
        var countTxt = rows.length + " okazji";
        if (!showAtypical && hiddenAtypical) countTxt += " (+" + hiddenAtypical + " nietypowych ukrytych)";
        document.getElementById("list-count").textContent = countTxt;

        document.getElementById("offer-list").innerHTML = rows.map(function (r, i) { return rowHtml(r, i + 1); }).join("") ||
            '<p class="empty-state">Brak okazji spełniających kryteria (żadna oferta nie jest wyraźnie tańsza od mediany swojej grupy).</p>';
    }

    SG.loadData().then(function (data) {
        allOffers = SG.flattenOffers(data);
        render();
    });

    ["list-filter-type", "list-filter-transaction", "list-filter-favorites", "list-filter-atypical", "list-sort"].forEach(function (id) {
        document.getElementById(id).addEventListener("change", render);
    });
    SG.wireFavoriteButtons(document.getElementById("offer-list"), function () {
        if (document.getElementById("list-filter-favorites").checked) render();
    });

    document.getElementById("export-csv-btn").addEventListener("click", function () {
        SG.downloadCsv(currentFiltered, "sonar-garazowy-okazje-" + new Date().toISOString().slice(0, 10) + ".csv");
    });
})();
