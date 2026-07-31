// Version: v1.0.8
let chartInstance = null;

let file1Data = null;
let file2Data = null;

let activePrimaryMetric = 'hr';
let activeSecondaryMetric = 'none';

const COLOR_F1 = '#FFFFFF';
const COLOR_F2 = '#FF9800';

const METRICS = {
    hr: { label: 'Puls (bpm)', reverseY: false, unit: 'bpm' },
    pace: { label: 'Pace (min/km)', reverseY: true, unit: 'min/km' },
    speed: { label: 'Geschwindigkeit (km/h)', reverseY: false, unit: 'km/h' },
    power: { label: 'Leistung (W, 30s Ø)', reverseY: false, unit: 'W' },
    gap: { label: 'GAP (min/km)', reverseY: true, unit: 'min/km' },
    alt: { label: 'Höhe (m)', reverseY: false, unit: 'm' }
};

function initApp() {
    updateVisibility();

    const input1 = document.getElementById('tcx1File');
    const input2 = document.getElementById('tcx2File');

    if (input1) input1.addEventListener('change', (e) => handleFileSelect(e, 1));
    if (input2) input2.addEventListener('change', (e) => handleFileSelect(e, 2));

    // Event-Listener Linke Achse
    document.querySelectorAll('#leftAxisBtns .axis-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            document.querySelectorAll('#leftAxisBtns .axis-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            activePrimaryMetric = e.target.dataset.axis;
            updateChart();
        });
    });

    // Event-Listener Rechte Achse
    document.querySelectorAll('#rightAxisBtns .axis-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            document.querySelectorAll('#rightAxisBtns .axis-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            activeSecondaryMetric = e.target.dataset.axis === 'off' ? 'none' : e.target.dataset.axis;
            updateChart();
        });
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

function updateVisibility() {
    const noData = document.getElementById('noDataMessage');
    const dashboard = document.getElementById('dashboard');
    const hasData = !!(file1Data || file2Data);

    if (hasData) {
        if (noData) noData.classList.add('hidden');
        if (dashboard) {
            dashboard.classList.remove('hidden');
            dashboard.style.display = 'flex';
        }
    } else {
        if (noData) noData.classList.remove('hidden');
        if (dashboard) {
            dashboard.classList.add('hidden');
            dashboard.style.display = 'none';
        }
    }
}

function handleFileSelect(event, fileNumber) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            let text = e.target.result;
            if (text) text = text.replace(/^\uFEFF/, '');
            const parsed = parseTCX(text, file.name);
            if (fileNumber === 1) {
                file1Data = parsed;
            } else {
                file2Data = parsed;
            }
            refreshAllUI();
        } catch (err) {
            console.error("Fehler beim Verarbeiten der TCX-Datei:", err);
            alert("Fehler beim Lesen der Datei: " + err.message);
        }
    };
    reader.readAsText(file);
}

function refreshAllUI() {
    updateVisibility();

    if (!file1Data && !file2Data) return;

    try {
        updateDashboardUI();
    } catch(e) {
        console.error("Fehler in updateDashboardUI:", e);
    }

    try {
        updateChart();
    } catch(e) {
        console.error("Fehler in updateChart:", e);
    }

    try {
        updateTableUI();
    } catch(e) {
        console.error("Fehler in updateTableUI:", e);
    }
}

function renderValPair(val1, val2) {
    const f1Str = val1 !== undefined && val1 !== null ? val1 : '-';
    if (!file2Data) return f1Str;
    const f2Str = val2 !== undefined && val2 !== null ? val2 : '-';
    return `${f1Str} / <span class="tcx2-val">${f2Str}</span>`;
}

function updateDashboardUI() {
    const f1Sport = file1Data ? file1Data.sport : '-';
    const f2Sport = file2Data ? file2Data.sport : '-';
    document.getElementById('sportVal').innerHTML = renderValPair(f1Sport, f2Sport);

    const f1Start = file1Data ? formatDate(file1Data.startDate) : '-';
    const f2Start = file2Data ? formatDate(file2Data.startDate) : '-';
    document.getElementById('startTimeVal').innerHTML = renderValPair(f1Start, f2Start);

    const f1Dist = file1Data ? `${file1Data.stats.dist.toFixed(2)} km` : '-';
    const f2Dist = file2Data ? `${file2Data.stats.dist.toFixed(2)} km` : '-';
    document.getElementById('distanceVal').innerHTML = renderValPair(f1Dist, f2Dist);

    const f1AvgHr = file1Data ? `${file1Data.stats.avgHr} bpm` : '-';
    const f2AvgHr = file2Data ? `${file2Data.stats.avgHr} bpm` : '-';
    document.getElementById('avgHrVal').innerHTML = renderValPair(f1AvgHr, f2AvgHr);

    const f1MaxHr = file1Data ? `${file1Data.stats.maxHr} bpm` : '-';
    const f2MaxHr = file2Data ? `${file2Data.stats.maxHr} bpm` : '-';
    document.getElementById('maxHrVal').innerHTML = renderValPair(f1MaxHr, f2MaxHr);

    const f1Drift = file1Data ? `${file1Data.stats.drift > 0 ? '+' : ''}${file1Data.stats.drift.toFixed(1)}%` : '-';
    const f2Drift = file2Data ? `${file2Data.stats.drift > 0 ? '+' : ''}${file2Data.stats.drift.toFixed(1)}%` : '-';
    document.getElementById('driftVal').innerHTML = renderValPair(f1Drift, f2Drift);
}

function formatSecsToMinSec(sec) {
    if (!sec || isNaN(sec) || sec <= 0) return '-';
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function formatPaceVal(paceMin) {
    if (!paceMin || isNaN(paceMin) || paceMin <= 0 || paceMin > 20) return '-';
    const m = Math.floor(paceMin);
    const s = Math.round((paceMin - m) * 60);
    return `${m}:${s < 10 ? '0' : ''}${s} /km`;
}

function updateTableUI() {
    const tbody = document.getElementById('lapsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const laps1 = file1Data ? file1Data.laps : [];
    const laps2 = file2Data ? file2Data.laps : [];

    const maxLaps = Math.max(laps1.length, laps2.length);

    if (maxLaps === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#888;">Keine Runden-Daten vorhanden</td></tr>';
        return;
    }

    for (let i = 0; i < maxLaps; i++) {
        const l1 = laps1[i];
        const l2 = laps2[i];

        const tr = document.createElement('tr');

        const numCell = `${i + 1}`;
        const distCell = renderValPair(l1 ? `${l1.distKm.toFixed(2)} km` : '-', l2 ? `${l2.distKm.toFixed(2)} km` : '-');
        const timeCell = renderValPair(l1 ? formatSecsToMinSec(l1.timeSec) : '-', l2 ? formatSecsToMinSec(l2.timeSec) : '-');
        const paceCell = renderValPair(l1 ? formatPaceVal(l1.paceMin) : '-', l2 ? formatPaceVal(l2.paceMin) : '-');
        const avgHrCell = renderValPair(l1 && l1.avgHr ? `${l1.avgHr} bpm` : '-', l2 && l2.avgHr ? `${l2.avgHr} bpm` : '-');
        const maxHrCell = renderValPair(l1 && l1.maxHr ? `${l1.maxHr} bpm` : '-', l2 && l2.maxHr ? `${l2.maxHr} bpm` : '-');

        tr.innerHTML = `
            <td><strong>${numCell}</strong></td>
            <td>${distCell}</td>
            <td>${timeCell}</td>
            <td>${paceCell}</td>
            <td>${avgHrCell}</td>
            <td>${maxHrCell}</td>
        `;

        tbody.appendChild(tr);
    }
}

function getTagVal(node, tagName) {
    if (!node) return null;
    const all = node.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
        if (all[i].localName && all[i].localName.toLowerCase() === tagName.toLowerCase()) {
            return all[i].textContent;
        }
    }
    return null;
}

function getHrVal(node) {
    if (!node) return null;
    const all = node.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
        if (all[i].localName && all[i].localName.toLowerCase() === 'heartratebpm') {
            const vals = all[i].getElementsByTagName('*');
            for (let j = 0; j < vals.length; j++) {
                if (vals[j].localName && vals[j].localName.toLowerCase() === 'value') {
                    return parseInt(vals[j].textContent, 10);
                }
            }
        }
    }
    return null;
}

function parseTCX(xmlText, fileName) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");

    if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
        throw new Error("Ungültige XML/TCX-Datei");
    }

    let sport = 'Running';
    const allNodes = xmlDoc.getElementsByTagName('*');
    for (let i = 0; i < allNodes.length; i++) {
        if (allNodes[i].localName && allNodes[i].localName.toLowerCase() === 'activity') {
            const sportAttr = allNodes[i].getAttribute('Sport') || allNodes[i].getAttribute('sport');
            if (sportAttr) {
                sport = sportAttr;
                break;
            }
        }
    }

    const trackpointNodes = [];
    for (let i = 0; i < allNodes.length; i++) {
        if (allNodes[i].localName && allNodes[i].localName.toLowerCase() === 'trackpoint') {
            trackpointNodes.push(allNodes[i]);
        }
    }

    if (trackpointNodes.length === 0) {
        throw new Error("Keine Trackpoints in der Datei gefunden");
    }

    const trackpoints = [];
    let hrs = [];

    let prevTimeSec = null;
    let prevDistMeters = null;
    let prevAlt = null;
    let startTimeSec = null;
    let firstTimeStr = null;

    const runnerWeightKg = 88;

    for (let i = 0; i < trackpointNodes.length; i++) {
        const tp = trackpointNodes[i];
        
        const distRaw = getTagVal(tp, "DistanceMeters");
        const distMeters = distRaw ? parseFloat(distRaw) : null;
        const dist = distMeters !== null ? distMeters / 1000 : 0;
        
        const timeStr = getTagVal(tp, "Time");
        if (!firstTimeStr && timeStr) firstTimeStr = timeStr;

        const timeSec = timeStr ? new Date(timeStr).getTime() / 1000 : null;
        if (startTimeSec === null && timeSec !== null) startTimeSec = timeSec;
        const elapsedSec = (timeSec !== null && startTimeSec !== null) ? (timeSec - startTimeSec) : 0;

        const hr = getHrVal(tp);
        const altRaw = getTagVal(tp, "AltitudeMeters");
        const alt = altRaw ? parseFloat(altRaw) : null;
        
        const speedRaw = getTagVal(tp, "Speed");
        let speed = speedRaw ? parseFloat(speedRaw) : null;

        if ((speed === null || isNaN(speed)) && prevTimeSec !== null && timeSec !== null && prevDistMeters !== null && distMeters !== null) {
            const deltaTime = timeSec - prevTimeSec;
            const deltaDist = distMeters - prevDistMeters;
            if (deltaTime > 0 && deltaDist >= 0) {
                speed = deltaDist / deltaTime;
            }
        }

        let gapPace = null;
        let rawPower = null;
        let speedKmh = null;

        if (speed !== null && speed > 0.3 && speed < 13.0) {
            speedKmh = speed * 3.6;

            let slope = 0;
            if (alt !== null && prevAlt !== null && distMeters !== null && prevDistMeters !== null) {
                const deltaAlt = alt - prevAlt;
                const deltaD = distMeters - prevDistMeters;
                if (deltaD > 1) {
                    slope = Math.max(-0.25, Math.min(0.25, deltaAlt / deltaD));
                }
            }

            const costFactor = 1 + (3.3 * slope) + (10.5 * slope * slope);
            const gapSpeed = speed * costFactor;
            if (gapSpeed > 0.3) {
                gapPace = (1000 / gapSpeed) / 60;
            }

            const g = 9.81;
            const totalAcc = Math.max(0.2, 1.04 + (g * Math.sin(Math.atan(slope))));
            rawPower = Math.round(runnerWeightKg * totalAcc * speed);
        }

        if (timeSec !== null) prevTimeSec = timeSec;
        if (distMeters !== null) prevDistMeters = distMeters;
        if (alt !== null) prevAlt = alt;

        let pace = null;
        if (speed !== null && speed > 0.3 && speed < 13.0) {
            pace = (1000 / speed) / 60;
        }

        let eff = null;
        if (speed !== null && speed > 0.3 && speed < 13.0 && hr && hr > 0) {
            eff = (speed / hr) * 1000;
        }

        if (hr) hrs.push(hr);

        trackpoints.push({
            dist: dist,
            elapsedSec: elapsedSec,
            speedKmh: speedKmh,
            hr: hr,
            pace: pace,
            power: rawPower,
            gap: gapPace,
            alt: alt,
            eff: eff
        });
    }

    // Runden / Lap parsing
    const laps = [];
    for (let i = 0; i < allNodes.length; i++) {
        if (allNodes[i].localName && allNodes[i].localName.toLowerCase() === 'lap') {
            const lapNode = allNodes[i];
            const timeSec = parseFloat(getTagVal(lapNode, "TotalTimeSeconds") || 0);
            const distMeters = parseFloat(getTagVal(lapNode, "DistanceMeters") || 0);
            const avgHr = parseInt(getTagVal(lapNode, "AverageHeartRateBpm") || getHrVal(lapNode) || 0, 10);
            const maxHr = parseInt(getTagVal(lapNode, "MaximumHeartRateBpm") || 0, 10);

            if (timeSec > 0 || distMeters > 0) {
                const distKm = distMeters / 1000;
                const paceMin = (distKm > 0 && timeSec > 0) ? (timeSec / 60) / distKm : 0;
                laps.push({
                    distKm: distKm,
                    timeSec: timeSec,
                    paceMin: paceMin,
                    avgHr: avgHr,
                    maxHr: maxHr
                });
            }
        }
    }

    // Fallback: Wenn im TCX keine Laps angelegt wurden, erstelle automatisch 1-km-Splits
    if (laps.length === 0 && trackpoints.length > 0) {
        let currentKm = 1;
        let startPt = trackpoints[0];
        let segmentHrs = [];

        for (let i = 0; i < trackpoints.length; i++) {
            const pt = trackpoints[i];
            if (pt.hr) segmentHrs.push(pt.hr);

            if (pt.dist >= currentKm || i === trackpoints.length - 1) {
                const deltaDist = pt.dist - startPt.dist;
                const deltaTime = pt.elapsedSec - startPt.elapsedSec;
                if (deltaDist > 0.05 && deltaTime > 0) {
                    const segAvgHr = segmentHrs.length ? Math.round(segmentHrs.reduce((a,b)=>a+b,0)/segmentHrs.length) : 0;
                    const segMaxHr = segmentHrs.length ? Math.max(...segmentHrs) : 0;
                    const pace = (deltaTime / 60) / deltaDist;
                    laps.push({
                        distKm: deltaDist,
                        timeSec: deltaTime,
                        paceMin: pace,
                        avgHr: segAvgHr,
                        maxHr: segMaxHr
                    });
                }
                startPt = pt;
                segmentHrs = [];
                currentKm = Math.floor(pt.dist) + 1;
            }
        }
    }

    const startDateRaw = getTagVal(xmlDoc, "Id") || firstTimeStr;
    const startDate = startDateRaw ? new Date(startDateRaw) : null;
    const maxDist = trackpoints.length > 0 ? trackpoints[trackpoints.length - 1].dist : 0;
    const avgHr = hrs.length > 0 ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : 0;
    const maxHr = hrs.length > 0 ? Math.max(...hrs) : 0;

    let drift = 0;
    if (trackpoints.length > 10) {
        const midIdx = Math.floor(trackpoints.length / 2);
        const h1Pts = trackpoints.slice(0, midIdx).filter(p => p.eff !== null);
        const h2Pts = trackpoints.slice(midIdx).filter(p => p.eff !== null);

        if (h1Pts.length > 0 && h2Pts.length > 0) {
            const avgEff1 = h1Pts.reduce((a, b) => a + b.eff, 0) / h1Pts.length;
            const avgEff2 = h2Pts.reduce((a, b) => a + b.eff, 0) / h2Pts.length;
            if (avgEff1 > 0) {
                drift = ((avgEff1 - avgEff2) / avgEff1) * 100;
            }
        }
    }

    return {
        name: fileName,
        sport: sport,
        startDate: startDate,
        trackpoints: trackpoints,
        laps: laps,
        stats: { dist: maxDist, avgHr: avgHr, maxHr: maxHr, drift: drift }
    };
}

function formatDate(d) {
    if (!d || isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
           d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr';
}

function createDataset(fileObj, metricKey, axisId, color, isDashed, filePrefix) {
    if (!fileObj || !fileObj.trackpoints || !fileObj.trackpoints.length) return null;

    const metricConfig = METRICS[metricKey];
    if (!metricConfig) return null;

    const propertyKey = metricKey === 'speed' ? 'speedKmh' : metricKey;

    const dataPoints = fileObj.trackpoints
        .filter(pt => {
            const val = pt[propertyKey];
            if (val === null || val === undefined) return false;
            if ((metricKey === 'pace' || metricKey === 'gap') && val > 15) return false;
            return true;
        })
        .map(pt => ({ x: pt.dist, y: pt[propertyKey] }));

    return {
        label: `${filePrefix} ${metricConfig.label}`,
        data: dataPoints,
        borderColor: color,
        backgroundColor: color,
        borderWidth: 1.5,
        borderDash: isDashed ? [5, 5] : [],
        pointRadius: 0,
        pointHoverRadius: 6,
        tension: 0.2,
        yAxisID: axisId
    };
}

function updateChart() {
    if (!file1Data && !file2Data) return;
    if (typeof Chart === 'undefined') {
        console.warn("Chart.js ist noch nicht geladen.");
        return;
    }

    const datasets = [];
    const primaryConfig = METRICS[activePrimaryMetric];

    const scales = {
        x: {
            type: 'linear',
            title: { display: true, text: 'Distanz (km)', color: '#aaa' },
            ticks: { color: '#aaa' },
            grid: { color: '#333' }
        },
        y: {
            type: 'linear',
            position: 'left',
            reverse: primaryConfig.reverseY,
            title: { display: true, text: primaryConfig.label, color: '#e0e0e0' },
            ticks: { color: '#e0e0e0' },
            grid: { color: '#333' }
        }
    };

    const ds1_y1 = createDataset(file1Data, activePrimaryMetric, 'y', COLOR_F1, false, 'TCX 1');
    if (ds1_y1) datasets.push(ds1_y1);

    const ds2_y1 = createDataset(file2Data, activePrimaryMetric, 'y', COLOR_F2, false, 'TCX 2');
    if (ds2_y1) datasets.push(ds2_y1);

    if (activeSecondaryMetric !== 'none' && activeSecondaryMetric !== activePrimaryMetric) {
        const secondaryConfig = METRICS[activeSecondaryMetric];
        scales.y1 = {
            type: 'linear',
            position: 'right',
            reverse: secondaryConfig.reverseY,
            title: { display: true, text: secondaryConfig.label, color: '#aaa' },
            ticks: { color: '#aaa' },
            grid: { drawOnChartArea: false }
        };

        const ds1_y2 = createDataset(file1Data, activeSecondaryMetric, 'y1', COLOR_F1, true, 'TCX 1');
        if (ds1_y2) datasets.push(ds1_y2);

        const ds2_y2 = createDataset(file2Data, activeSecondaryMetric, 'y1', COLOR_F2, true, 'TCX 2');
        if (ds2_y2) datasets.push(ds2_y2);

        if (primaryConfig.unit === secondaryConfig.unit) {
            const allYValues = datasets.flatMap(ds => ds.data.map(pt => pt.y));
            if (allYValues.length > 0) {
                let minY = Math.min(...allYValues);
                let maxY = Math.max(...allYValues);
                const margin = (maxY - minY) * 0.05 || 0.5;

                minY = Math.max(0, minY - margin);
                maxY = maxY + margin;

                if (primaryConfig.unit === 'min/km') {
                    maxY = Math.min(maxY, 15);
                }

                scales.y.min = minY;
                scales.y.max = maxY;
                scales.y1.min = minY;
                scales.y1.max = maxY;
            }
        }
    } else if (activePrimaryMetric === 'pace' || activePrimaryMetric === 'gap') {
        scales.y.max = 15;
    }

    const canvas = document.getElementById('tcxChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: scales,
            plugins: {
                legend: {
                    display: true,
                    labels: { color: '#e0e0e0', boxWidth: 12, font: { size: 10 } }
                },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x'
                    },
                    zoom: {
                        wheel: { enabled: true },
                        pinch: { enabled: true },
                        mode: 'x'
                    }
                }
            }
        }
    });
}
