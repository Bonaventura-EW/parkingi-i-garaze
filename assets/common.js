// Shared helpers used by index.html, ostatnie.html and top5.html.
var SG = (function () {
    "use strict";

    var TYPE_COLORS = {
        garaz: { sprzedaz: "#0b5394", wynajem: "#1d7a46" },
        miejsce_parkingowe: { sprzedaz: "#a64d79", wynajem: "#e69138" },
        hala_wiata: { sprzedaz: "#674ea7", wynajem: "#674ea7" },
    };

    var TYPE_LABELS = {
        garaz: "Garaż",
        miejsce_parkingowe: "Miejsce parkingowe",
        hala_wiata: "Hala / wiata garażowa",
    };

    function fmtPrice(o) {
        if (o.price == null) return "cena nieznana";
        var suffix = o.transaction === "wynajem" ? " zł/mies." : " zł";
        var txt = o.price.toLocaleString("pl-PL") + suffix;
        if (o.negotiable) txt += " (do negocjacji)";
        return txt;
    }

    function colorFor(o) {
        var byType = TYPE_COLORS[o.type] || TYPE_COLORS.garaz;
        return byType[o.transaction] || byType.wynajem;
    }

    function escapeHtml(s) {
        if (!s) return "";
        return s.replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    function precisionLabel(o) {
        return o.precision === "exact" || o.precision === "street"
            ? "adres dokładny"
            : o.precision === "district"
            ? "przybliżona (dzielnica)"
            : "przybliżona";
    }

    // Flatten data.markers into a plain offers array (each offer keeps its marker address).
    function flattenOffers(data) {
        var out = [];
        (data.markers || []).forEach(function (m) {
            m.offers.forEach(function (o) { out.push(o); });
        });
        return out;
    }

    function loadData() {
        return fetch("data.json?_=" + Date.now()).then(function (r) { return r.json(); });
    }

    return {
        TYPE_COLORS: TYPE_COLORS,
        TYPE_LABELS: TYPE_LABELS,
        fmtPrice: fmtPrice,
        colorFor: colorFor,
        escapeHtml: escapeHtml,
        precisionLabel: precisionLabel,
        flattenOffers: flattenOffers,
        loadData: loadData,
    };
})();
