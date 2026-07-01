(function () {
    "use strict";

    var REASON_LABELS = {
        inny_temat: "Inny temat",
        inna_miejscowosc: "Inna miejscowość",
        produkt_blaszak: "Produkt (blaszak)",
    };

    var all = [];

    function rowHtml(s) {
        var detail = s.detail ? " (" + SG.escapeHtml(s.detail) + ")" : "";
        return (
            '<a class="offer-row" href="' + s.link + '" target="_blank" rel="noopener">' +
            '<div class="offer-row-left">' +
            '<div class="offer-row-main">' +
            '<span class="offer-tag">' + (REASON_LABELS[s.reason] || s.reason) + detail + "</span>" +
            "<strong>" + SG.escapeHtml(s.title) + "</strong>" +
            "</div>" +
            "</div>" +
            "</a>"
        );
    }

    function render() {
        var reason = document.getElementById("reason-filter").value;
        var filtered = reason === "all" ? all : all.filter(function (s) { return s.reason === reason; });
        document.getElementById("skipped-count").textContent = filtered.length + " pominiętych";
        document.getElementById("skipped-list").innerHTML = filtered.map(rowHtml).join("") ||
            '<p class="empty-state">Brak pominiętych ogłoszeń w tej kategorii.</p>';
    }

    fetch("skipped.json?_=" + Date.now())
        .then(function (r) { return r.json(); })
        .then(function (data) {
            all = data.skipped || [];
            document.getElementById("skipped-generated-at").textContent = data.generated_at || "-";
            render();
        })
        .catch(function () {
            document.getElementById("skipped-list").innerHTML = '<p class="empty-state">Nie udało się wczytać listy pominiętych ogłoszeń.</p>';
        });

    document.getElementById("reason-filter").addEventListener("change", render);
})();
