(function () {
    "use strict";

    var allOffers = [];

    function rowHtml(o) {
        var typeLabel = SG.TYPE_LABELS[o.type] || o.type;
        var txLabel = o.transaction === "wynajem" ? "Wynajem" : "Sprzedaż";
        return (
            '<a class="offer-row" href="' + o.url + '" target="_blank" rel="noopener">' +
            '<div class="offer-row-left">' +
            '<div class="offer-row-main">' +
            SG.statusBadgeHtml(o) +
            '<span class="offer-tag">' + typeLabel + "</span>" +
            '<span class="offer-tag">' + txLabel + "</span>" +
            '<span class="offer-tag">' + o.source + "</span>" +
            "<strong>" + SG.escapeHtml(o.title) + "</strong>" +
            "</div>" +
            '<div class="offer-row-meta">📍 ' + SG.escapeHtml(o.address) + " · " + SG.precisionLabel(o) + "</div>" +
            '<div class="offer-row-meta">🕐 ' + SG.escapeHtml(o.date_label || o.loc_raw || "brak daty") + "</div>" +
            "</div>" +
            '<div class="offer-row-price">' + SG.fmtPrice(o) + "</div>" +
            SG.favoriteBtnHtml(o.id, "offer-row-fav") +
            "</a>"
        );
    }

    function applyFiltersFromUrl() {
        var params = new URLSearchParams(window.location.search);
        if (params.has("typ")) document.getElementById("list-filter-type").value = params.get("typ");
        if (params.has("transakcja")) document.getElementById("list-filter-transaction").value = params.get("transakcja");
    }

    function syncUrlFromFilters(typeFilter, txFilter) {
        var params = new URLSearchParams();
        if (typeFilter !== "all") params.set("typ", typeFilter);
        if (txFilter !== "all") params.set("transakcja", txFilter);
        var qs = params.toString();
        window.history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : ""));
    }

    function render() {
        var typeFilter = document.getElementById("list-filter-type").value;
        var txFilter = document.getElementById("list-filter-transaction").value;
        var favoritesOnly = document.getElementById("list-filter-favorites").checked;
        var filtered = allOffers.filter(function (o) {
            if (o.active === false) return false;
            if (favoritesOnly && !SG.favorites.has(o.id)) return false;
            if (typeFilter !== "all" && o.type !== typeFilter) return false;
            if (txFilter !== "all" && o.transaction !== txFilter) return false;
            return true;
        });
        filtered.sort(function (a, b) {
            return (b.date_iso || "").localeCompare(a.date_iso || "");
        });
        document.getElementById("list-count").textContent = filtered.length + " ofert";
        document.getElementById("offer-list").innerHTML = filtered.map(rowHtml).join("") ||
            '<p class="empty-state">Brak ofert spełniających kryteria.</p>';
        syncUrlFromFilters(typeFilter, txFilter);
    }

    applyFiltersFromUrl();

    SG.loadData().then(function (data) {
        allOffers = SG.flattenOffers(data);
        render();
    });

    document.getElementById("list-filter-type").addEventListener("change", render);
    document.getElementById("list-filter-transaction").addEventListener("change", render);
    document.getElementById("list-filter-favorites").addEventListener("change", render);
    SG.wireFavoriteButtons(document.getElementById("offer-list"), function () {
        if (document.getElementById("list-filter-favorites").checked) render();
    });
})();
