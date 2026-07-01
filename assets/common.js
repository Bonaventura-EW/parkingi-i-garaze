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

    function offerStatus(o) {
        if (o.is_new) return "new";
        if (o.price_trend === "up") return "up";
        if (o.price_trend === "down") return "down";
        return "unchanged";
    }

    var STATUS_BADGES = {
        new: '<span class="badge-pill badge-crimson" title="Nowa oferta">N</span>',
        up: '<span class="badge-pill badge-red" title="Cena wzrosła">↑</span>',
        down: '<span class="badge-pill badge-green" title="Cena spadła">↓</span>',
        unchanged: "",
    };

    function statusBadgeHtml(o) {
        return STATUS_BADGES[offerStatus(o)] || "";
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

    var FAVORITES_KEY = "sg_favorites";

    function readFavorites() {
        try {
            return JSON.parse(window.localStorage.getItem(FAVORITES_KEY) || "{}");
        } catch (e) {
            return {};
        }
    }

    function writeFavorites(obj) {
        try {
            window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(obj));
        } catch (e) { /* localStorage unavailable (private mode / quota) — favorites just won't persist */ }
    }

    var favorites = {
        has: function (id) { return !!readFavorites()[id]; },
        toggle: function (id) {
            var favs = readFavorites();
            if (favs[id]) delete favs[id];
            else favs[id] = true;
            writeFavorites(favs);
            return !!favs[id];
        },
        count: function () { return Object.keys(readFavorites()).length; },
    };

    function favoriteBtnHtml(id, extraClass) {
        var starred = favorites.has(id);
        return '<button type="button" class="fav-btn' + (extraClass ? " " + extraClass : "") +
            (starred ? " fav-btn-active" : "") + '" data-fav-id="' + escapeHtml(String(id)) +
            '" aria-label="' + (starred ? "Usuń z ulubionych" : "Dodaj do ulubionych") + '" title="Ulubione">' +
            (starred ? "★" : "☆") + "</button>";
    }

    // Delegated click handler: call once per container that renders favoriteBtnHtml() buttons.
    // `onChange` is called with (id, isNowFavorite) after toggling, so callers can re-render if needed.
    function wireFavoriteButtons(container, onChange) {
        container.addEventListener("click", function (ev) {
            var btn = ev.target.closest(".fav-btn");
            if (!btn) return;
            ev.preventDefault();
            ev.stopPropagation();
            var id = btn.getAttribute("data-fav-id");
            var isFav = favorites.toggle(id);
            btn.classList.toggle("fav-btn-active", isFav);
            btn.textContent = isFav ? "★" : "☆";
            btn.setAttribute("aria-label", isFav ? "Usuń z ulubionych" : "Dodaj do ulubionych");
            if (onChange) onChange(id, isFav);
        });
    }

    return {
        TYPE_COLORS: TYPE_COLORS,
        TYPE_LABELS: TYPE_LABELS,
        fmtPrice: fmtPrice,
        colorFor: colorFor,
        escapeHtml: escapeHtml,
        offerStatus: offerStatus,
        statusBadgeHtml: statusBadgeHtml,
        precisionLabel: precisionLabel,
        flattenOffers: flattenOffers,
        loadData: loadData,
        favorites: favorites,
        favoriteBtnHtml: favoriteBtnHtml,
        wireFavoriteButtons: wireFavoriteButtons,
    };
})();
