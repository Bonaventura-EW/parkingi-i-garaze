(function () {
    "use strict";

    function sparkline(values, opts) {
        opts = opts || {};
        var w = opts.width || 480;
        var h = opts.height || 90;
        var pad = 8;
        var clean = values.map(function (v) { return v == null ? null : v; });
        var nums = clean.filter(function (v) { return v != null; });
        if (nums.length === 0) {
            return '<p class="empty-state">Brak jeszcze danych historycznych — pojawią się po kolejnych skanach.</p>';
        }
        if (nums.length === 1) {
            return '<p class="empty-state">Tylko jeden skan w historii jak dotąd (' + nums[0].toLocaleString("pl-PL") + '). Wykres pojawi się po kolejnych.</p>';
        }
        var min = Math.min.apply(null, nums);
        var max = Math.max.apply(null, nums);
        var range = max - min || 1;
        var n = clean.length;
        var stepX = (w - 2 * pad) / Math.max(1, n - 1);
        var points = [];
        clean.forEach(function (v, i) {
            if (v == null) return;
            var x = pad + i * stepX;
            var y = pad + (1 - (v - min) / range) * (h - 2 * pad);
            points.push(x.toFixed(1) + "," + y.toFixed(1));
        });
        var last = nums[nums.length - 1];
        var first = nums[0];
        var color = last > first ? "#e11d48" : (last < first ? "#16a34a" : "#0b5394");
        return (
            '<svg viewBox="0 0 ' + w + " " + h + '" class="sparkline" preserveAspectRatio="none">' +
            '<polyline fill="none" stroke="' + color + '" stroke-width="2" points="' + points.join(" ") + '"/>' +
            "</svg>" +
            '<div class="sparkline-range"><span>min ' + min.toLocaleString("pl-PL") + "</span><span>max " + max.toLocaleString("pl-PL") + "</span></div>"
        );
    }

    function loadHistory() {
        return fetch("scraper/history.jsonl?_=" + Date.now())
            .then(function (r) { return r.ok ? r.text() : ""; })
            .then(function (text) {
                return text
                    .split("\n")
                    .map(function (line) { return line.trim(); })
                    .filter(Boolean)
                    .map(function (line) {
                        try { return JSON.parse(line); } catch (e) { return null; }
                    })
                    .filter(Boolean);
            })
            .catch(function () { return []; });
    }

    function renderDistrictBars(data) {
        var counts = {};
        (data.markers || []).forEach(function (m) {
            var active = m.offers.filter(function (o) { return o.active !== false; });
            if (!active.length) return;
            var label = m.address || "Nieznana lokalizacja";
            counts[label] = (counts[label] || 0) + active.length;
        });
        var rows = Object.keys(counts)
            .map(function (k) { return { label: k, count: counts[k] }; })
            .sort(function (a, b) { return b.count - a.count; })
            .slice(0, 12);
        var max = rows.length ? rows[0].count : 1;
        document.getElementById("district-bars").innerHTML = rows
            .map(function (r) {
                var pct = Math.round((r.count / max) * 100);
                return (
                    '<div class="dist-bar-row">' +
                    '<span class="dist-bar-label">' + SG.escapeHtml(r.label) + "</span>" +
                    '<span class="dist-bar-track"><span class="dist-bar-fill" style="width:' + pct + '%"></span></span>' +
                    '<span class="dist-bar-count">' + r.count + "</span>" +
                    "</div>"
                );
            })
            .join("") || '<p class="empty-state">Brak danych.</p>';
    }

    function renderScanTable(history) {
        var tbody = document.querySelector("#scan-table tbody");
        var rows = history
            .slice()
            .reverse()
            .slice(0, 30)
            .map(function (h) {
                return (
                    "<tr><td>" + SG.escapeHtml(h.date || "") + "</td>" +
                    "<td>" + (h.active_total != null ? h.active_total : "-") + "</td>" +
                    "<td>" + (h.new_count != null ? h.new_count : "-") + "</td>" +
                    "<td>" + (h.newly_inactive_count != null ? h.newly_inactive_count : "-") + "</td>" +
                    "<td>" + (h.address_match_pct != null ? h.address_match_pct + "%" : "-") + "</td></tr>"
                );
            });
        tbody.innerHTML = rows.join("") || '<tr><td colspan="5" class="empty-state">Brak historii skanów.</td></tr>';
    }

    Promise.all([SG.loadData(), loadHistory()]).then(function (results) {
        var data = results[0];
        var history = results[1];

        document.getElementById("chart-total").innerHTML = sparkline(history.map(function (h) { return h.active_total; }));
        document.getElementById("chart-garaz-wynajem").innerHTML = sparkline(history.map(function (h) { return h.avg_garaz_wynajem; }));
        document.getElementById("chart-garaz-sprzedaz").innerHTML = sparkline(history.map(function (h) { return h.avg_garaz_sprzedaz; }));
        document.getElementById("chart-parking-wynajem").innerHTML = sparkline(history.map(function (h) { return h.avg_parking_wynajem; }));
        document.getElementById("chart-parking-sprzedaz").innerHTML = sparkline(history.map(function (h) { return h.avg_parking_sprzedaz; }));

        renderDistrictBars(data);
        renderScanTable(history);
    });
})();
