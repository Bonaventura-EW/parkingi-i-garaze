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
            '<span class="offer-tag">' + typeLabel + "</span>" +
            '<span class="offer-tag">' + txLabel + "</span>" +
            '<span class="offer-tag">' + o.source + "</span>" +
            "<strong>" + SG.escapeHtml(o.title) + "</strong>" +
            "</div>" +
            '<div class="offer-row-meta">📍 ' + SG.escapeHtml(o.address) + " · " + SG.precisionLabel(o) + "</div>" +
            '<div class="offer-row-meta">🕐 ' + SG.escapeHtml(o.date_label || o.loc_raw || "brak daty") + "</div>" +
            "</div>" +
            '<div class="offer-row-price">' + SG.fmtPrice(o) + "</div>" +
            "</a>"
        );
    }

    function render() {
        var typeFilter = document.getElementById("list-filter-type").value;
        var txFilter = document.getElementById("list-filter-transaction").value;
        var filtered = allOffers.filter(function (o) {
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
    }

    SG.loadData().then(function (data) {
        allOffers = SG.flattenOffers(data);
        render();
    });

    document.getElementById("list-filter-type").addEventListener("change", render);
    document.getElementById("list-filter-transaction").addEventListener("change", render);
})();
