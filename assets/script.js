(function () {
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

    var map = L.map("map", { zoomControl: true, minZoom: 10 }).setView([51.2465, 22.5684], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    var clusterGroup = L.markerClusterGroup({ maxClusterRadius: 45, disableClusteringAtZoom: 17 });
    map.addLayer(clusterGroup);

    var state = {
        data: null,
        allMarkers: [], // {marker, offers, address, precision}
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

    function makeIcon(offers) {
        var main = offers[0];
        var color = colorFor(main);
        var approx = offers.every(function (o) { return o.precision !== "exact" && o.precision !== "street"; });
        var count = offers.length;
        var html =
            '<div style="background:' + color + ";width:" + (count > 1 ? 26 : 18) + "px;height:" + (count > 1 ? 26 : 18) +
            "px;border-radius:50%;border:2px " + (approx ? "dashed" : "solid") + " #fff;box-shadow:0 0 0 1px " + color +
            ';display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;">' +
            (count > 1 ? count : "") +
            "</div>";
        return L.divIcon({ html: html, className: "sg-marker", iconSize: [count > 1 ? 26 : 18, count > 1 ? 26 : 18] });
    }

    function offerCardHtml(o) {
        var typeLabel = TYPE_LABELS[o.type] || o.type;
        var txLabel = o.transaction === "wynajem" ? "Wynajem" : "Sprzedaż";
        var precisionLabel =
            o.precision === "exact" || o.precision === "street"
                ? "adres dokładny"
                : o.precision === "district"
                ? "lokalizacja przybliżona (dzielnica)"
                : "lokalizacja przybliżona";
        return (
            '<div class="offer-card">' +
            '<span class="offer-tag">' + typeLabel + "</span>" +
            '<span class="offer-tag">' + txLabel + "</span>" +
            '<span class="offer-tag">' + o.source + "</span>" +
            "<h4>" + escapeHtml(o.title) + "</h4>" +
            '<div class="offer-price">' + fmtPrice(o) + "</div>" +
            '<div class="offer-meta">📍 ' + escapeHtml(o.address) + " (" + precisionLabel + ")</div>" +
            '<div class="offer-meta">' + escapeHtml(o.loc_raw || "") + "</div>" +
            '<a class="offer-link" href="' + o.url + '" target="_blank" rel="noopener">Zobacz ogłoszenie →</a>' +
            "</div>"
        );
    }

    function escapeHtml(s) {
        if (!s) return "";
        return s.replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    function openPanel(offers) {
        var panel = document.getElementById("offer-panel");
        var content = document.getElementById("offer-panel-content");
        content.innerHTML = offers.map(offerCardHtml).join("");
        panel.classList.remove("hidden");
    }

    document.getElementById("offer-panel-close").addEventListener("click", function () {
        document.getElementById("offer-panel").classList.add("hidden");
    });

    function currentFilters() {
        return {
            sprzedaz: document.getElementById("filter-sprzedaz").checked,
            wynajem: document.getElementById("filter-wynajem").checked,
            garaz: document.getElementById("filter-garaz").checked,
            parking: document.getElementById("filter-parking").checked,
            hala: document.getElementById("filter-hala").checked,
            olx: document.getElementById("filter-olx").checked,
            otodom: document.getElementById("filter-otodom").checked,
            precise: document.getElementById("filter-precise").checked,
            approx: document.getElementById("filter-approx").checked,
            priceMin: parseFloat(document.getElementById("price-min").value) || 0,
            priceMax: parseFloat(document.getElementById("price-max").value) || Infinity,
            query: (document.getElementById("search-input").value || "").toLowerCase().trim(),
        };
    }

    var TYPE_KEY = { garaz: "garaz", miejsce_parkingowe: "parking", hala_wiata: "hala" };

    function offerPasses(o, f) {
        if (o.transaction === "sprzedaz" && !f.sprzedaz) return false;
        if (o.transaction === "wynajem" && !f.wynajem) return false;
        var tk = TYPE_KEY[o.type] || "garaz";
        if (tk === "garaz" && !f.garaz) return false;
        if (tk === "parking" && !f.parking) return false;
        if (tk === "hala" && !f.hala) return false;
        if (o.source === "olx" && !f.olx) return false;
        if (o.source === "otodom" && !f.otodom) return false;
        var isPrecise = o.precision === "exact" || o.precision === "street";
        if (isPrecise && !f.precise) return false;
        if (!isPrecise && !f.approx) return false;
        if (o.price != null && (o.price < f.priceMin || o.price > f.priceMax)) return false;
        if (f.query) {
            var hay = (o.title + " " + o.address).toLowerCase();
            if (hay.indexOf(f.query) === -1) return false;
        }
        return true;
    }

    function applyFilters() {
        var f = currentFilters();
        clusterGroup.clearLayers();
        var visible = [];
        var counts = { sprzedaz: 0, wynajem: 0, garaz: 0, parking: 0, hala: 0 };

        state.allMarkers.forEach(function (m) {
            var passing = m.offers.filter(function (o) { return offerPasses(o, f); });
            if (passing.length === 0) return;
            passing.forEach(function (o) {
                visible.push(o);
                counts[o.transaction] = (counts[o.transaction] || 0) + 1;
                var tk = TYPE_KEY[o.type] || "garaz";
                counts[tk] = (counts[tk] || 0) + 1;
            });
            var marker = L.marker([m.coords.lat, m.coords.lon], { icon: makeIcon(passing) });
            marker.on("click", function () { openPanel(passing); });
            clusterGroup.addLayer(marker);
        });

        document.getElementById("visible-count").textContent = visible.length;
        document.getElementById("count-sprzedaz").textContent = "(" + (counts.sprzedaz || 0) + ")";
        document.getElementById("count-wynajem").textContent = "(" + (counts.wynajem || 0) + ")";
        document.getElementById("count-garaz").textContent = "(" + (counts.garaz || 0) + ")";
        document.getElementById("count-parking").textContent = "(" + (counts.parking || 0) + ")";
        document.getElementById("count-hala").textContent = "(" + (counts.hala || 0) + ")";
    }

    function fmtStat(s) {
        if (!s || s.avg == null) return "brak danych";
        return s.avg.toLocaleString("pl-PL") + " zł (" + s.count + ")";
    }

    function renderProducts(products) {
        var group = document.getElementById("products-group");
        var list = document.getElementById("products-list");
        if (!products || products.length === 0) {
            group.style.display = "none";
            return;
        }
        group.style.display = "block";
        list.innerHTML = products
            .map(function (p) {
                var price = p.price ? p.price.toLocaleString("pl-PL") + " zł" : "cena nieznana";
                return '<a href="' + p.url + '" target="_blank" rel="noopener">' + escapeHtml(p.title) + " — " + price + "</a>";
            })
            .join("");
    }

    fetch("data.json?_=" + Date.now())
        .then(function (r) { return r.json(); })
        .then(function (data) {
            state.data = data;
            state.allMarkers = data.markers.map(function (m) {
                return { coords: m.coords, address: m.address, offers: m.offers };
            });

            document.getElementById("last-scan").textContent = data.generated_at || "-";
            document.getElementById("stat-garaz-wynajem").textContent = fmtStat(data.stats.garaz_wynajem);
            document.getElementById("stat-garaz-sprzedaz").textContent = fmtStat(data.stats.garaz_sprzedaz);
            document.getElementById("stat-parking-wynajem").textContent = fmtStat(data.stats.parking_wynajem);
            document.getElementById("stat-parking-sprzedaz").textContent = fmtStat(data.stats.parking_sprzedaz);

            renderProducts(data.off_map_products);
            applyFilters();
        })
        .catch(function (err) {
            console.error("Błąd wczytywania danych:", err);
            document.getElementById("visible-count").textContent = "błąd";
        });

    [
        "filter-sprzedaz", "filter-wynajem", "filter-garaz", "filter-parking", "filter-hala",
        "filter-olx", "filter-otodom", "filter-precise", "filter-approx",
    ].forEach(function (id) {
        document.getElementById(id).addEventListener("change", applyFilters);
    });

    ["price-min", "price-max"].forEach(function (id) {
        document.getElementById(id).addEventListener("input", debounce(applyFilters, 300));
    });
    document.getElementById("price-reset").addEventListener("click", function () {
        document.getElementById("price-min").value = "";
        document.getElementById("price-max").value = "";
        applyFilters();
    });

    document.getElementById("search-input").addEventListener("input", debounce(applyFilters, 250));

    function debounce(fn, ms) {
        var t;
        return function () {
            clearTimeout(t);
            var args = arguments;
            t = setTimeout(function () { fn.apply(null, args); }, ms);
        };
    }

    document.getElementById("menu-toggle").addEventListener("click", function () {
        document.getElementById("sidebar").classList.toggle("open");
    });

    document.getElementById("locate-btn").addEventListener("click", function () {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(function (pos) {
            map.setView([pos.coords.latitude, pos.coords.longitude], 15);
            L.circleMarker([pos.coords.latitude, pos.coords.longitude], {
                radius: 8, color: "#1a73e8", fillColor: "#1a73e8", fillOpacity: 0.6,
            }).addTo(map);
        });
    });

    window.toggleProducts = function () {
        var list = document.getElementById("products-list");
        var icon = document.getElementById("products-toggle-icon");
        var open = list.style.display !== "none";
        list.style.display = open ? "none" : "block";
        icon.textContent = open ? "▶" : "▼";
    };
})();
