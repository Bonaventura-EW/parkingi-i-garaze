(function () {
    "use strict";

    var TYPE_LABELS = SG.TYPE_LABELS;
    var fmtPrice = SG.fmtPrice;
    var colorFor = SG.colorFor;
    var escapeHtml = SG.escapeHtml;

    var map = L.map("map", { zoomControl: false, minZoom: 10 }).setView([51.2465, 22.5684], 13);
    L.control.zoom({ position: "topright" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    var clusterGroup = L.markerClusterGroup({ maxClusterRadius: 45, disableClusteringAtZoom: 17 });
    map.addLayer(clusterGroup);
    var approxRadiusLayer = L.layerGroup().addTo(map);

    var APPROX_RADIUS_M = { district: 550, unknown: 1300 };

    var state = {
        data: null,
        allMarkers: [], // {marker, offers, address, precision}
    };

    function makeIcon(offers) {
        var main = offers[0];
        var color = main.active === false ? "#9ca3af" : colorFor(main);
        var approx = offers.every(function (o) { return o.precision !== "exact" && o.precision !== "street"; });
        var anyInactive = offers.some(function (o) { return o.active === false; });
        var count = offers.length;
        var size = count > 1 ? 26 : 18;
        var opacity = anyInactive ? 0.55 : (approx ? 0.85 : 1);
        var html =
            '<div style="background:' + color + ";width:" + size + "px;height:" + size +
            "px;border-radius:50%;border:2px " + (approx ? "dashed #fff" : "solid #fff") +
            ";box-shadow:0 0 0 1px " + color + (approx ? ",0 0 0 4px " + color + "33" : "") +
            ";opacity:" + opacity +
            ';display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;">' +
            (count > 1 ? count : "") +
            "</div>";
        return L.divIcon({ html: html, className: "sg-marker", iconSize: [size, size] });
    }

    function offerCardHtml(o) {
        var typeLabel = TYPE_LABELS[o.type] || o.type;
        var txLabel = o.transaction === "wynajem" ? "Wynajem" : "Sprzedaż";
        var areaLine = o.area_m2
            ? '<div class="offer-meta">📐 ' + o.area_m2 + " m²" +
              (o.price_per_m2 ? " · " + o.price_per_m2.toLocaleString("pl-PL") + " zł/m²" : "") + "</div>"
            : "";
        var trendLine = "";
        if (o.price_trend && o.previous_price != null) {
            var arrow = o.price_trend === "up" ? "podrożało" : "potaniało";
            trendLine = '<div class="offer-meta">' + SG.statusBadgeHtml(o) + " " + arrow + " z " +
                o.previous_price.toLocaleString("pl-PL") + " zł (" + (o.price_changed_at || "") + ")</div>";
        }
        var inactiveLine = o.active === false
            ? '<div class="offer-meta offer-inactive-notice">👻 Ogłoszenie zniknęło z OLX — ostatnio widziane: ' + escapeHtml(o.last_seen || "") + "</div>"
            : "";
        var firstSeenLine = o.first_seen
            ? '<div class="offer-meta">🕐 Pierwszy raz zauważone: ' + escapeHtml(o.first_seen) + "</div>"
            : "";
        return (
            '<div class="offer-card' + (o.active === false ? " offer-card-inactive" : "") + '">' +
            SG.favoriteBtnHtml(o.id, "offer-card-fav") +
            (o.is_new ? SG.statusBadgeHtml(o) + " " : "") +
            '<span class="offer-tag">' + typeLabel + "</span>" +
            '<span class="offer-tag">' + txLabel + "</span>" +
            '<span class="offer-tag">' + o.source + "</span>" +
            "<h4>" + escapeHtml(o.title) + "</h4>" +
            '<div class="offer-price">' + fmtPrice(o) + "</div>" +
            areaLine +
            trendLine +
            '<div class="offer-meta">📍 ' + escapeHtml(o.address) + " (" + SG.precisionLabel(o) + ")</div>" +
            '<div class="offer-meta">' + escapeHtml(o.loc_raw || "") + "</div>" +
            firstSeenLine +
            inactiveLine +
            '<a class="offer-link" href="' + o.url + '" target="_blank" rel="noopener">Zobacz ogłoszenie →</a>' +
            "</div>"
        );
    }

    var FILTER_CHECKBOX_DEFAULTS = {
        "filter-sprzedaz": true, "filter-wynajem": true, "filter-garaz": true, "filter-parking": true, "filter-hala": true,
        "filter-olx": true, "filter-otodom": true, "filter-precise": true, "filter-approx": true,
        "filter-status-new": true, "filter-status-up": true, "filter-status-down": true, "filter-status-unchanged": true,
        "filter-show-inactive": false,
    };

    function paramKey(id) { return id.replace(/^filter-/, ""); }

    function applyFiltersFromUrl() {
        var params = new URLSearchParams(window.location.search);
        Object.keys(FILTER_CHECKBOX_DEFAULTS).forEach(function (id) {
            var key = paramKey(id);
            if (params.has(key)) {
                document.getElementById(id).checked = params.get(key) === "1";
            }
        });
        if (params.has("price-min")) document.getElementById("price-min").value = params.get("price-min");
        if (params.has("price-max")) document.getElementById("price-max").value = params.get("price-max");
        if (params.has("q")) document.getElementById("search-input").value = params.get("q");
        if (params.has("dni")) document.getElementById("date-quick-filter").value = params.get("dni");
    }

    function syncUrlFromFilters() {
        var params = new URLSearchParams();
        Object.keys(FILTER_CHECKBOX_DEFAULTS).forEach(function (id) {
            var checked = document.getElementById(id).checked;
            if (checked !== FILTER_CHECKBOX_DEFAULTS[id]) params.set(paramKey(id), checked ? "1" : "0");
        });
        var pmin = document.getElementById("price-min").value;
        var pmax = document.getElementById("price-max").value;
        var q = document.getElementById("search-input").value;
        if (pmin) params.set("price-min", pmin);
        if (pmax) params.set("price-max", pmax);
        if (q) params.set("q", q);
        var daysFilter = document.getElementById("date-quick-filter").value;
        if (daysFilter !== "all") params.set("dni", daysFilter);
        var qs = params.toString();
        var newUrl = window.location.pathname + (qs ? "?" + qs : "");
        window.history.replaceState(null, "", newUrl);
    }

    function openPanel(offers) {
        var panel = document.getElementById("offer-panel");
        var content = document.getElementById("offer-panel-content");
        content.innerHTML = offers.map(offerCardHtml).join("");
        panel.classList.remove("hidden");
    }

    SG.wireFavoriteButtons(document.getElementById("offer-panel-content"), function () {
        updateFavoritesCount();
    });

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
            statusNew: document.getElementById("filter-status-new").checked,
            statusUp: document.getElementById("filter-status-up").checked,
            statusDown: document.getElementById("filter-status-down").checked,
            statusUnchanged: document.getElementById("filter-status-unchanged").checked,
            showInactive: document.getElementById("filter-show-inactive").checked,
            priceMin: parseFloat(document.getElementById("price-min").value) || 0,
            priceMax: parseFloat(document.getElementById("price-max").value) || Infinity,
            query: (document.getElementById("search-input").value || "").toLowerCase().trim(),
            daysFilter: document.getElementById("date-quick-filter").value,
            favoritesOnly: document.getElementById("filter-favorites-only").checked,
        };
    }

    function updateFavoritesCount() {
        document.getElementById("count-favorites").textContent = "(" + SG.favorites.count() + ")";
    }

    function dateCutoffIso(days) {
        var d = new Date();
        d.setUTCDate(d.getUTCDate() - (days - 1));
        return d.toISOString().slice(0, 10);
    }

    var TYPE_KEY = { garaz: "garaz", miejsce_parkingowe: "parking", hala_wiata: "hala" };
    var STATUS_FILTER_KEY = { new: "statusNew", up: "statusUp", down: "statusDown", unchanged: "statusUnchanged" };

    function offerPasses(o, f) {
        if (f.favoritesOnly && !SG.favorites.has(o.id)) return false;
        if (o.active === false) {
            return f.showInactive;
        }
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
        if (!f[STATUS_FILTER_KEY[SG.offerStatus(o)]]) return false;
        if (f.daysFilter !== "all" && o.first_seen && o.first_seen < dateCutoffIso(parseInt(f.daysFilter, 10))) return false;
        if (o.price != null && (o.price < f.priceMin || o.price > f.priceMax)) return false;
        if (f.query) {
            var hay = (o.title + " " + o.address).toLowerCase();
            if (hay.indexOf(f.query) === -1) return false;
        }
        return true;
    }

    function fmtStat(s) {
        if (!s || s.avg == null) return "brak danych";
        return s.avg.toLocaleString("pl-PL") + " zł (" + s.count + ")";
    }

    function avgOf(offers) {
        var prices = offers.map(function (o) { return o.price; }).filter(function (p) { return p != null; });
        if (!prices.length) return { avg: null, count: offers.length };
        return { avg: Math.round(prices.reduce(function (a, b) { return a + b; }, 0) / prices.length), count: offers.length };
    }

    function applyFilters() {
        var f = currentFilters();
        clusterGroup.clearLayers();
        approxRadiusLayer.clearLayers();
        var visible = [];
        var counts = { sprzedaz: 0, wynajem: 0, garaz: 0, parking: 0, hala: 0 };
        var inactiveTotal = 0;

        state.allMarkers.forEach(function (m) {
            inactiveTotal += m.offers.filter(function (o) { return o.active === false; }).length;
        });

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

            var approxPrecision = passing.every(function (o) { return o.precision === "district"; })
                ? "district"
                : (passing.every(function (o) { return o.precision !== "exact" && o.precision !== "street"; }) ? "unknown" : null);
            if (approxPrecision) {
                L.circle([m.coords.lat, m.coords.lon], {
                    radius: APPROX_RADIUS_M[approxPrecision],
                    color: colorFor(passing[0]),
                    weight: 1,
                    fillColor: colorFor(passing[0]),
                    fillOpacity: 0.08,
                    dashArray: "4,6",
                    interactive: false,
                }).addTo(approxRadiusLayer);
            }
        });

        document.getElementById("visible-count").textContent = visible.length;
        document.getElementById("count-sprzedaz").textContent = "(" + (counts.sprzedaz || 0) + ")";
        document.getElementById("count-wynajem").textContent = "(" + (counts.wynajem || 0) + ")";
        document.getElementById("count-garaz").textContent = "(" + (counts.garaz || 0) + ")";
        document.getElementById("count-parking").textContent = "(" + (counts.parking || 0) + ")";
        document.getElementById("count-hala").textContent = "(" + (counts.hala || 0) + ")";
        document.getElementById("count-inactive").textContent = "(" + inactiveTotal + ")";

        var byCat = function (type, tx) {
            return visible.filter(function (o) { return o.type === type && o.transaction === tx; });
        };
        document.getElementById("stat-garaz-wynajem").textContent = fmtStat(avgOf(byCat("garaz", "wynajem")));
        document.getElementById("stat-garaz-sprzedaz").textContent = fmtStat(avgOf(byCat("garaz", "sprzedaz")));
        document.getElementById("stat-parking-wynajem").textContent = fmtStat(avgOf(byCat("miejsce_parkingowe", "wynajem")));
        document.getElementById("stat-parking-sprzedaz").textContent = fmtStat(avgOf(byCat("miejsce_parkingowe", "sprzedaz")));

        var mapEl = document.getElementById("map");
        var existingEmpty = document.getElementById("map-empty-state");
        if (visible.length === 0) {
            if (!existingEmpty) {
                var div = document.createElement("div");
                div.id = "map-empty-state";
                div.className = "map-empty-state";
                div.textContent = "Brak ofert spełniających wybrane filtry. Spróbuj poluzować kryteria.";
                mapEl.appendChild(div);
            }
        } else if (existingEmpty) {
            existingEmpty.remove();
        }

        state.visibleOffers = visible;
        syncUrlFromFilters();
    }

    function renderDateHistogram(allMarkers) {
        var counts = {};
        var today = new Date();
        var days = 30;
        for (var i = 0; i < days; i++) {
            var d = new Date(today);
            d.setUTCDate(d.getUTCDate() - i);
            counts[d.toISOString().slice(0, 10)] = 0;
        }
        allMarkers.forEach(function (m) {
            m.offers.forEach(function (o) {
                if (o.active === false || !o.first_seen) return;
                if (counts.hasOwnProperty(o.first_seen)) counts[o.first_seen]++;
            });
        });
        var dates = Object.keys(counts).sort();
        var max = Math.max.apply(null, dates.map(function (d) { return counts[d]; })) || 1;
        var el = document.getElementById("date-histogram");
        el.innerHTML = dates
            .map(function (d) {
                var c = counts[d];
                var pct = Math.max(4, Math.round((c / max) * 100));
                return '<div class="date-histogram-bar' + (c === 0 ? " empty" : "") + '" style="height:' + pct + '%" title="' + d + ": " + c + ' ofert"></div>';
            })
            .join("");
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

    applyFiltersFromUrl();

    SG.loadData()
        .then(function (data) {
            state.data = data;
            state.allMarkers = data.markers.map(function (m) {
                return { coords: m.coords, address: m.address, offers: m.offers };
            });

            document.getElementById("last-scan").textContent = data.generated_at || "-";
            renderProducts(data.off_map_products);
            renderDateHistogram(state.allMarkers);
            updateFavoritesCount();
            applyFilters();
        })
        .catch(function (err) {
            console.error("Błąd wczytywania danych:", err);
            document.getElementById("visible-count").textContent = "błąd";
            var mapEl = document.getElementById("map");
            var div = document.createElement("div");
            div.className = "map-empty-state";
            div.textContent = "Nie udało się wczytać danych ofert (data.json). Odśwież stronę za chwilę.";
            mapEl.appendChild(div);
        });

    [
        "filter-sprzedaz", "filter-wynajem", "filter-garaz", "filter-parking", "filter-hala",
        "filter-olx", "filter-otodom", "filter-precise", "filter-approx",
        "filter-status-new", "filter-status-up", "filter-status-down", "filter-status-unchanged",
        "filter-show-inactive", "date-quick-filter", "filter-favorites-only",
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

    document.getElementById("copy-link-btn").addEventListener("click", function (ev) {
        syncUrlFromFilters();
        var btn = ev.currentTarget;
        var restore = btn.textContent;
        var done = function (ok) {
            btn.textContent = ok ? "✅ Skopiowano!" : "⚠️ Nie udało się skopiować";
            setTimeout(function () { btn.textContent = restore; }, 1800);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(window.location.href).then(function () { done(true); }, function () { done(false); });
        } else {
            done(false);
        }
    });

    document.getElementById("export-csv-btn").addEventListener("click", function () {
        var offers = state.visibleOffers || [];
        var stamp = new Date().toISOString().slice(0, 10);
        SG.downloadCsv(offers, "sonar-garazowy-oferty-" + stamp + ".csv");
    });

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
