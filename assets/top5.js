(function () {
    "use strict";

    var SECTIONS = [
        { key: "garaz-sprzedaz", title: "🚗 Garaż – najtańsze na sprzedaż", type: "garaz", transaction: "sprzedaz" },
        { key: "garaz-wynajem", title: "🚗 Garaż – najtańsze na wynajem", type: "garaz", transaction: "wynajem" },
        { key: "parking-sprzedaz", title: "🅿️ Miejsce parkingowe – najtańsze na sprzedaż", type: "miejsce_parkingowe", transaction: "sprzedaz" },
        { key: "parking-wynajem", title: "🅿️ Miejsce parkingowe – najtańsze na wynajem", type: "miejsce_parkingowe", transaction: "wynajem" },
    ];

    function rowHtml(o, rank) {
        return (
            '<a class="offer-row" href="' + o.url + '" target="_blank" rel="noopener">' +
            '<div class="offer-row-left">' +
            '<div class="offer-row-main">' +
            '<span class="offer-tag offer-rank">#' + rank + "</span>" +
            '<span class="offer-tag">' + o.source + "</span>" +
            "<strong>" + SG.escapeHtml(o.title) + "</strong>" +
            "</div>" +
            '<div class="offer-row-meta">📍 ' + SG.escapeHtml(o.address) + " · " + SG.precisionLabel(o) + "</div>" +
            "</div>" +
            '<div class="offer-row-price">' + SG.fmtPrice(o) + "</div>" +
            "</a>"
        );
    }

    function sectionHtml(section, offers) {
        var top = offers
            .filter(function (o) { return o.type === section.type && o.transaction === section.transaction && o.price != null; })
            .sort(function (a, b) { return a.price - b.price; })
            .slice(0, 5);
        var body = top.length
            ? top.map(function (o, i) { return rowHtml(o, i + 1); }).join("")
            : '<p class="empty-state">Brak ofert w tej kategorii.</p>';
        return '<section class="filter-group top5-section"><h3>' + section.title + "</h3>" + body + "</section>";
    }

    SG.loadData().then(function (data) {
        var offers = SG.flattenOffers(data);
        document.getElementById("top5-sections").innerHTML = SECTIONS.map(function (s) {
            return sectionHtml(s, offers);
        }).join("");
    });
})();
