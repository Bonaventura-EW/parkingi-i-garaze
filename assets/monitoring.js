// monitoring.html — health of the scraper itself (scan duration, per-source
// yield, database size), read straight from scraper/history.jsonl.
//
// Charts are hand-rolled SVG on purpose: this repo vendors its dependencies
// (assets/vendor/) and pulls nothing from a CDN, so no charting library.
(function () {
    "use strict";

    var W = 720;
    var H = 220;
    var PAD = { top: 12, right: 14, bottom: 28, left: 48 };

    var COLORS = {
        duration: "#674ea7",
        olx: "#0b5394",
        otodom: "#e69138",
        active: "#1d7a46",
        total: "#8a94a0",
        alert: "#b91c1c",
    };

    // A scan counts as "source is dead" once it yields nothing this many times in a row.
    var DEAD_SOURCE_SCANS = 3;
    // A source that still returns *something* but drops below this fraction of its
    // usual yield is flagged as "degraded" (throttling / partial WAF block, not death).
    var DEGRADED_RATIO = 0.3;
    // The usual yield = median of this many recent non-zero scans, searched this deep.
    // We look for non-zero readings rather than a fixed window so a long outage doesn't
    // blank the baseline and silence the alarm exactly when a source recovers then fails again.
    var BASELINE_SCANS = 10;
    var BASELINE_LOOKBACK = 40;
    // With fewer non-zero scans than this we have no trustworthy norm — stay quiet.
    var MIN_BASELINE_SCANS = 3;
    var MAX_POINTS = 60;
    var MAX_TABLE_ROWS = 30;

    function fmtNum(v) {
        return v == null ? "—" : Number(v).toLocaleString("pl-PL");
    }

    function fmtDuration(s) {
        if (s == null) return "—";
        if (s < 90) return Math.round(s) + " s";
        return Math.floor(s / 60) + " min " + Math.round(s % 60) + " s";
    }

    function shortLabel(entry) {
        var d = entry.ts ? new Date(entry.ts) : null;
        if (!d || isNaN(d.getTime())) return entry.date || "";
        return d.toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    }

    function hasAny(values) {
        return values.some(function (v) { return v != null; });
    }

    // Rounds an axis maximum up to something readable (1/2/5 × 10^n).
    function niceMax(max) {
        if (max <= 0) return 1;
        var exp = Math.pow(10, Math.floor(Math.log(max) / Math.LN10));
        var frac = max / exp;
        var step = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
        return step * exp;
    }

    function emptyState(msg) {
        return '<p class="empty-state">' + SG.escapeHtml(msg) + "</p>";
    }

    function axisSvg(labels, max) {
        var innerW = W - PAD.left - PAD.right;
        var innerH = H - PAD.top - PAD.bottom;
        var out = "";
        for (var i = 0; i <= 4; i++) {
            var y = PAD.top + (i / 4) * innerH;
            var val = max * (1 - i / 4);
            out += '<line x1="' + PAD.left + '" y1="' + y.toFixed(1) + '" x2="' + (PAD.left + innerW) +
                '" y2="' + y.toFixed(1) + '" class="chart-grid"/>';
            out += '<text x="' + (PAD.left - 6) + '" y="' + (y + 3.5).toFixed(1) +
                '" class="chart-axis-label" text-anchor="end">' +
                SG.escapeHtml(val >= 10 ? String(Math.round(val)) : val.toFixed(1).replace(/\.0$/, "")) + "</text>";
        }
        // At most ~6 x labels, otherwise they collide.
        var every = Math.max(1, Math.ceil(labels.length / 6));
        labels.forEach(function (label, i) {
            var isLast = i === labels.length - 1;
            if (i % every !== 0 && !isLast) return;
            var x = PAD.left + (labels.length === 1 ? innerW / 2 : (i / (labels.length - 1)) * innerW);
            // Edge labels are anchored inwards so they don't get clipped by the viewBox.
            var anchor = i === 0 ? "start" : isLast ? "end" : "middle";
            out += '<text x="' + x.toFixed(1) + '" y="' + (H - 8) +
                '" class="chart-axis-label" text-anchor="' + anchor + '">' + SG.escapeHtml(label) + "</text>";
        });
        return out;
    }

    function legendHtml(series) {
        return '<div class="chart-legend">' + series.map(function (s) {
            return '<span class="chart-legend-item"><span class="chart-legend-swatch" style="background:' +
                s.color + '"></span>' + SG.escapeHtml(s.label) + "</span>";
        }).join("") + "</div>";
    }

    function svgWrap(inner) {
        return '<svg viewBox="0 0 ' + W + " " + H + '" class="chart-svg" role="img">' + inner + "</svg>";
    }

    // series: [{ label, color, values: [number|null], dashed?, fill? }]
    function lineChart(labels, series) {
        var all = series.reduce(function (acc, s) { return acc.concat(s.values); }, []);
        if (!hasAny(all)) return emptyState("Brak jeszcze danych — pojawią się po kolejnych skanach.");

        var max = niceMax(Math.max.apply(null, all.filter(function (v) { return v != null; })));
        var innerW = W - PAD.left - PAD.right;
        var innerH = H - PAD.top - PAD.bottom;
        var n = labels.length;

        function pointAt(v, i) {
            var x = PAD.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
            var y = PAD.top + (1 - v / max) * innerH;
            return [x, y];
        }

        var body = axisSvg(labels, max);
        series.forEach(function (s) {
            // Gaps (null values from scans predating a metric) break the line into segments.
            var segments = [];
            var current = [];
            s.values.forEach(function (v, i) {
                if (v == null) {
                    if (current.length) segments.push(current);
                    current = [];
                    return;
                }
                current.push(pointAt(v, i));
            });
            if (current.length) segments.push(current);

            segments.forEach(function (seg) {
                var pts = seg.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ");
                if (s.fill && seg.length > 1) {
                    var base = PAD.top + innerH;
                    body += '<polygon fill="' + s.color + '" fill-opacity="0.12" points="' +
                        seg[0][0].toFixed(1) + "," + base + " " + pts + " " +
                        seg[seg.length - 1][0].toFixed(1) + "," + base + '"/>';
                }
                if (seg.length === 1) {
                    body += '<circle cx="' + seg[0][0].toFixed(1) + '" cy="' + seg[0][1].toFixed(1) +
                        '" r="3" fill="' + s.color + '"/>';
                } else {
                    body += '<polyline fill="none" stroke="' + s.color + '" stroke-width="2" ' +
                        (s.dashed ? 'stroke-dasharray="6 4" ' : "") + 'points="' + pts + '"/>';
                }
            });
        });
        return svgWrap(body) + legendHtml(series);
    }

    // series: [{ label, color, values }] — stacked, one bar per scan.
    function stackedBarChart(labels, series) {
        var totals = labels.map(function (_, i) {
            var sum = null;
            series.forEach(function (s) {
                if (s.values[i] != null) sum = (sum || 0) + s.values[i];
            });
            return sum;
        });
        if (!hasAny(totals)) return emptyState("Brak jeszcze danych — pojawią się po kolejnych skanach.");

        var max = niceMax(Math.max.apply(null, totals.filter(function (v) { return v != null; })));
        var innerW = W - PAD.left - PAD.right;
        var innerH = H - PAD.top - PAD.bottom;
        var slot = innerW / Math.max(1, labels.length);
        var barW = Math.max(1.5, Math.min(18, slot * 0.7));

        var body = axisSvg(labels, max);
        labels.forEach(function (_, i) {
            if (totals[i] == null) return;
            var x = PAD.left + slot * i + (slot - barW) / 2;
            var y = PAD.top + innerH;
            series.forEach(function (s) {
                var v = s.values[i];
                if (!v) return;
                var h = (v / max) * innerH;
                y -= h;
                body += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW.toFixed(1) +
                    '" height="' + h.toFixed(1) + '" fill="' + s.color + '"><title>' +
                    SG.escapeHtml(s.label + ": " + v) + "</title></rect>";
            });
        });
        return svgWrap(body) + legendHtml(series);
    }

    function median(nums) {
        var s = nums.slice().sort(function (a, b) { return a - b; });
        var mid = Math.floor(s.length / 2);
        return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
    }

    // Per-source health: at most one alert per source, most severe wins.
    //   "dead"     — 0 offers for DEAD_SOURCE_SCANS scans in a row (full block / dead scraper).
    //   "degraded" — still returns something, but below DEGRADED_RATIO of its usual yield.
    function sourceAlerts(history) {
        return ["olx", "otodom"].map(function (source) {
            var key = "scraped_" + source;

            // Trailing run of scans in which the source returned nothing at all.
            var streak = 0;
            for (var i = history.length - 1; i >= 0; i--) {
                var v = history[i][key];
                if (v == null) break;      // scan predates per-source tracking — stop counting
                if (v !== 0) break;
                streak++;
            }
            if (streak >= DEAD_SOURCE_SCANS) {
                return { source: source, level: "dead", streak: streak };
            }

            var last = history.length ? history[history.length - 1][key] : null;
            if (last == null) return null;   // no per-source data on the latest scan

            // Baseline from earlier scans only, so an anomalous last reading doesn't
            // drag down the norm it's being compared against.
            var yields = [];
            for (var j = history.length - 2;
                 j >= 0 && (history.length - 1 - j) <= BASELINE_LOOKBACK && yields.length < BASELINE_SCANS;
                 j--) {
                var y = history[j][key];
                if (y != null && y > 0) yields.push(y);
            }
            if (yields.length < MIN_BASELINE_SCANS) return null;   // too little history — no false alarm

            var baseline = median(yields);
            if (last < DEGRADED_RATIO * baseline) {
                return { source: source, level: "degraded", last: last, baseline: baseline };
            }
            return null;
        }).filter(Boolean);
    }

    function renderAlerts(history, last) {
        var box = document.getElementById("source-alert");
        var alerts = sourceAlerts(history);
        if (!alerts.length) {
            box.hidden = true;
            box.className = "source-alert";
            return;
        }
        // A single dead source makes the whole bar critical (red); otherwise it's a warning (amber).
        var hasDead = alerts.some(function (a) { return a.level === "dead"; });
        box.className = "source-alert" + (hasDead ? "" : " is-warning");

        var lines = alerts.map(function (a) {
            if (a.level === "dead") {
                var stillActive = last ? last["active_" + a.source] : null;
                return "🚨 Źródło <strong>" + a.source.toUpperCase() + "</strong> nie zwraca ofert (0 od " +
                    a.streak + " skanów" +
                    (stillActive != null ? "; " + stillActive + " wciąż aktywnych w bazie z karencji" : "") + ").";
            }
            return "⚠️ Źródło <strong>" + a.source.toUpperCase() +
                "</strong> zwraca wyraźnie mniej ofert niż zwykle (" + a.last +
                " zamiast ~" + Math.round(a.baseline) + " z ostatnich skanów).";
        });
        var advice = hasDead
            ? "Sprawdź scraper — możliwa blokada portalu (WAF / zmiana HTML)."
            : "Możliwy throttling lub częściowa blokada portalu — warto sprawdzić scraper.";
        box.innerHTML = lines.join("<br>") + "<br>" + advice;
        box.hidden = false;
    }

    function renderKpis(history, last) {
        var durations = history.map(function (h) { return h.duration_s; })
            .filter(function (v) { return v != null; });
        var avg = durations.length
            ? durations.reduce(function (a, b) { return a + b; }, 0) / durations.length
            : null;

        function set(id, text) { document.getElementById(id).textContent = text; }

        set("kpi-total", fmtNum(history.length));
        set("kpi-span", history.length ? "od " + (history[0].date || "—") : "—");
        set("kpi-avg", fmtDuration(avg));
        set("kpi-last-dur", "ostatni: " + fmtDuration(last ? last.duration_s : null));
        set("kpi-active", fmtNum(last ? last.active_total : null));
        set("kpi-sources", "OLX " + fmtNum(last ? last.active_olx : null) +
            " / Otodom " + fmtNum(last ? last.active_otodom : null));
        set("kpi-new", fmtNum(last ? last.new_count : null));
        set("kpi-churn", "znikło: " + fmtNum(last ? last.newly_inactive_count : null) +
            " · zmiany cen: " + fmtNum(last ? last.updated_count : null));
        set("last-scan", last ? (last.date || "—") : "—");
    }

    function renderTable(history) {
        var tbody = document.querySelector("#monitoring-table tbody");
        var rows = history.slice().reverse().slice(0, MAX_TABLE_ROWS).map(function (h) {
            return "<tr>" +
                "<td>" + SG.escapeHtml(h.date || "") + "</td>" +
                "<td>" + fmtDuration(h.duration_s) + "</td>" +
                "<td>" + fmtNum(h.scraped_olx) + "</td>" +
                "<td>" + fmtNum(h.scraped_otodom) + "</td>" +
                "<td>" + fmtNum(h.new_count) + "</td>" +
                "<td>" + fmtNum(h.newly_inactive_count) + "</td>" +
                "<td>" + fmtNum(h.updated_count) + "</td>" +
                "<td>" + fmtNum(h.active_total) + "</td>" +
                "<td>" + fmtNum(h.total_in_db) + "</td>" +
                "<td>" + (h.address_match_pct != null ? h.address_match_pct + "%" : "—") + "</td>" +
                "</tr>";
        });
        tbody.innerHTML = rows.join("") ||
            '<tr><td colspan="10" class="empty-state">Brak historii skanów.</td></tr>';
    }

    function loadHistory() {
        return fetch("scraper/history.jsonl?_=" + Date.now())
            .then(function (r) { return r.ok ? r.text() : ""; })
            .then(function (text) {
                return text.split("\n")
                    .map(function (line) { return line.trim(); })
                    .filter(Boolean)
                    .map(function (line) {
                        try { return JSON.parse(line); } catch (e) { return null; }
                    })
                    .filter(Boolean);
            })
            .catch(function () { return []; });
    }

    loadHistory().then(function (history) {
        var last = history.length ? history[history.length - 1] : null;

        renderAlerts(history, last);
        renderKpis(history, last);
        renderTable(history);

        // Charts stay readable only for so many points; show the recent tail.
        var recent = history.slice(-MAX_POINTS);
        var labels = recent.map(shortLabel);
        function col(key) { return recent.map(function (h) { return h[key] != null ? h[key] : null; }); }

        document.getElementById("chart-duration").innerHTML = lineChart(labels, [
            { label: "czas skanu [s]", color: COLORS.duration, values: col("duration_s"), fill: true },
        ]);

        document.getElementById("chart-sources").innerHTML = stackedBarChart(labels, [
            { label: "OLX", color: COLORS.olx, values: col("scraped_olx") },
            { label: "Otodom", color: COLORS.otodom, values: col("scraped_otodom") },
        ]);

        document.getElementById("chart-db").innerHTML = lineChart(labels, [
            { label: "aktywne", color: COLORS.active, values: col("active_total"), fill: true },
            { label: "łącznie w bazie (z karencją)", color: COLORS.total, values: col("total_in_db"), dashed: true },
        ]);

        document.getElementById("chart-churn").innerHTML = lineChart(labels, [
            { label: "nowe", color: COLORS.active, values: col("new_count") },
            { label: "zniknęły", color: COLORS.alert, values: col("newly_inactive_count") },
        ]);
    });
})();
