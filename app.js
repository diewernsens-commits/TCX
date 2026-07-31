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

document.addEventListener('DOMContentLoaded', () => {
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
});

function handleFileSelect(event, fileNumber) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const parsed = parseTCX(e.target.result, file.name);
        if (fileNumber === 1) {
            file1Data = parsed;
        } else {
            file2Data = parsed;
        }
        refreshAllUI();
    };
    reader.readAsText(file);
}

function refreshAllUI() {
    if (!file1Data && !file2Data) return;

    const noData = document.getElementById('noDataMessage');
    const dashboard = document.getElementById('dashboard');

    if (noData) noData.style.display = 'none';
    if (dashboard) dashboard.style.setProperty('display', 'block', 'important');

    updateDashboardUI();
    updateChart();
}

function updateDashboardUI() {
    const f1Sport = file1Data ? file1Data.sport : '-';
    const f2Sport = file2Data ? file2Data.sport : '-';
    document.getElementById('sportVal').innerHTML = `${f1Sport} / ${f2Sport}`;

    const f1Start = file1Data ? formatDate(file1Data.startDate) : '-';
    const f2Start = file2Data ? formatDate(file2Data.startDate) : '-';
    document.getElementById('startTimeVal').innerHTML = `${f1Start} / ${f2Start}`;

    const f1Dist = file1Data ? `${file1Data.stats.dist.toFixed(2)} km` : '-';
    const f2Dist = file2Data ? `${file2Data.stats.dist.toFixed(2)} km` : '-';
    document.getElementById('distanceVal').innerHTML = `${f1Dist} / ${f2Dist}`;

    const f1AvgHr = file1Data ? `${file1Data.stats.avgHr} bpm` : '-';
    const f2AvgHr = file2Data ? `${file2Data.stats.avgHr} bpm` : '-';
    document.getElementById('avgHrVal').innerHTML = `${f1AvgHr} / ${f2AvgHr}`;

    const f1MaxHr = file1Data ? `${file1Data.stats.maxHr} bpm` : '-';
    const f2MaxHr = file2Data ? `${file2Data.stats.maxHr} bpm` : '-';
    document.getElementById('maxHrVal').innerHTML = `${f1MaxHr} / ${f2MaxHr}`;

    const f1Drift = file1Data ? `${file1Data.stats.drift > 0 ? '+' : ''}${file1Data.stats.drift.toFixed(1)}%` : '-';
    const f2Drift = file2Data ? `${file2Data.stats.drift > 0 ? '+' : ''}${file2Data.stats.drift.toFixed(1)}%` : '-';
    document.getElementById('driftVal').innerHTML = `${f1Drift} / ${f2Drift}`;
}

function getTagVal(node, tagName) {
    const all = node.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
        if (all[i].localName.toLowerCase() === tagName.toLowerCase()) {
            return all[i].textContent;
        }
    }
    return null;
}

function getHrVal(node) {
    const all = node.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
        if (all[i].localName.toLowerCase() === 'heartratebpm') {
            const vals = all[i].getElementsByTagName('*');
            for (let j = 0; j < vals.length; j++) {
                if (vals[j].localName.toLowerCase() === 'value') {
                    return parseInt(vals[j].textContent);
                }
            }
        }
    }
    return null;
}

function parseTCX(xmlText, fileName) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    
    let sport = 'Running';
    const allNodes = xmlDoc.getElementsByTagName('*');
    for (let i = 0; i < allNodes.length; i++) {
        if (allNodes[i].localName.toLowerCase() === 'activity') {
            const sportAttr = allNodes[i].getAttribute('Sport') || allNodes[i].getAttribute('sport');
            if (sportAttr) {
                sport = sportAttr;
                break;
            }
        }
    }

    const trackpointNodes = [];
    for (let i = 0; i < allNodes.length; i++) {
        if (allNodes[i].localName.toLowerCase() === 'trackpoint') {
            trackpointNodes.push(allNodes[i]);
        }
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
        stats: { dist: maxDist, avgHr: avgHr, maxHr: maxHr, drift: drift }
    };
}

function formatDate(d) {
    if (!d || isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
           d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr';
}

function createDataset(fileObj, metricKey, axisId, color, isDashed, filePrefix) {
    if (!fileObj || !fileObj.trackpoints.length) return null;

    const metricConfig = METRICS[metricKey];
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

        // Achsensynchronisierung für identische Einheiten (z. B. Pace und GAP)
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

    const ctx = document.getElementById('tcxChart').getContext('2d');
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
                }
            }
        }
    });
}

// Klick außerhalb schließt das Menü
document.addEventListener('click', (e) => {
    if (!tcx2Menu.contains(e.target) && e.target !== tcx2SettingsBtn) {
        tcx2Menu.classList.add('hidden');
    }
});

// Menü Aktionen (Übernehmen / Zurücksetzen)
document.getElementById('f2ApplyBtn').addEventListener('click', () => {
    applyTCX2Changes();
    tcx2Menu.classList.add('hidden');
});

document.getElementById('f2ResetBtn').addEventListener('click', () => {
    document.getElementById('f2OffsetInput').value = 0;
    document.getElementById('f2TrimStartInput').value = 0;
    document.getElementById('f2TrimEndInput').value = 0;
    applyTCX2Changes();
    tcx2Menu.classList.add('hidden');
});

// Event-Listener für Intervall-Dropdown
document.getElementById('intervalSelect').addEventListener('change', () => {
    updateIntervalTable();
});

// Event-Listener Y1 (Links)
document.querySelectorAll('#primaryTabs .tab').forEach(button => {
    button.addEventListener('click', (e) => {
        document.querySelectorAll('#primaryTabs .tab').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        activePrimaryMetric = e.target.dataset.metric;
        updateChart();
    });
});

// Event-Listener Y2 (Rechts)
document.querySelectorAll('#secondaryTabs .tab').forEach(button => {
    button.addEventListener('click', (e) => {
        document.querySelectorAll('#secondaryTabs .tab').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        activeSecondaryMetric = e.target.dataset.metric;
        updateChart();
    });
});

// Event-Listener Zoom-Reset
document.getElementById('resetZoomBtn').addEventListener('click', () => {
    if (chartInstance) {
        chartInstance.resetZoom();
    }
});

function handleFileSelect(event, fileNumber) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const parsed = parseTCX(e.target.result, file.name);
        if (fileNumber === 1) {
            file1Data = parsed;
        } else {
            file2RawData = parsed;
            document.getElementById('f2OffsetInput').value = 0;
            document.getElementById('f2TrimStartInput').value = 0;
            document.getElementById('f2TrimEndInput').value = 0;
            tcx2SettingsBtn.classList.remove('hidden');
            
            applyTCX2Changes();
            return;
        }
        refreshAllUI();
    };
    reader.readAsText(file);
}

function applyTCX2Changes() {
    if (!file2RawData) return;

    const offsetSec = parseFloat(document.getElementById('f2OffsetInput').value) || 0;
    const trimStartSec = parseFloat(document.getElementById('f2TrimStartInput').value) || 0;
    const trimEndSec = parseFloat(document.getElementById('f2TrimEndInput').value) || 0;

    file2Data = adjustTCXData(file2RawData, offsetSec, trimStartSec, trimEndSec);
    refreshAllUI();
}

function refreshAllUI() {
    updateDashboardUI();
    updateChart();
    updateIntervalTable();
}

function adjustTCXData(rawData, offsetSec, trimStartSec, trimEndSec) {
    if (!rawData || !rawData.trackpoints.length) return null;

    const totalDuration = rawData.trackpoints[rawData.trackpoints.length - 1].elapsedSec;
    const minTime = trimStartSec;
    const maxTime = totalDuration - trimEndSec;

    const filteredPts = rawData.trackpoints.filter(pt => pt.elapsedSec >= minTime && pt.elapsedSec <= maxTime);

    if (filteredPts.length === 0) {
        return {
            name: rawData.name,
            sport: rawData.sport,
            startDate: rawData.startDate,
            trackpoints: [],
            stats: { dist: 0, avgHr: 0, maxHr: 0, drift: 0 }
        };
    }

    const distStartOffset = filteredPts[0].dist;

    const adjustedTrackpoints = filteredPts.map(pt => {
        return {
            ...pt,
            dist: Math.max(0, pt.dist - distStartOffset),
            elapsedSec: (pt.elapsedSec - minTime) + offsetSec
        };
    });

    const hrs = adjustedTrackpoints.filter(p => p.hr).map(p => p.hr);
    const maxDist = adjustedTrackpoints.length > 0 ? adjustedTrackpoints[adjustedTrackpoints.length - 1].dist : 0;
    const avgHr = hrs.length > 0 ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : 0;
    const maxHr = hrs.length > 0 ? Math.max(...hrs) : 0;

    let drift = 0;
    if (adjustedTrackpoints.length > 10) {
        const midIdx = Math.floor(adjustedTrackpoints.length / 2);
        const h1Pts = adjustedTrackpoints.slice(0, midIdx).filter(p => p.eff !== null);
        const h2Pts = adjustedTrackpoints.slice(midIdx).filter(p => p.eff !== null);

        if (h1Pts.length > 0 && h2Pts.length > 0) {
            const avgEff1 = h1Pts.reduce((a, b) => a + b.eff, 0) / h1Pts.length;
            const avgEff2 = h2Pts.reduce((a, b) => a + b.eff, 0) / h2Pts.length;
            if (avgEff1 > 0) {
                drift = ((avgEff1 - avgEff2) / avgEff1) * 100;
            }
        }
    }

    return {
        name: rawData.name,
        sport: rawData.sport,
        startDate: rawData.startDate,
        trackpoints: adjustedTrackpoints,
        stats: { dist: maxDist, avgHr: avgHr, maxHr: maxHr, drift: drift }
    };
}

function getTagVal(node, tagName) {
    const all = node.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
        if (all[i].localName.toLowerCase() === tagName.toLowerCase()) {
            return all[i].textContent;
        }
    }
    return null;
}

function getHrVal(node) {
    const all = node.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
        if (all[i].localName.toLowerCase() === 'heartratebpm') {
            const vals = all[i].getElementsByTagName('*');
            for (let j = 0; j < vals.length; j++) {
                if (vals[j].localName.toLowerCase() === 'value') {
                    return parseInt(vals[j].textContent);
                }
            }
        }
    }
    return null;
}

function parseTCX(xmlText, fileName) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    
    let sport = 'Lauf / Aktivität';
    const allNodes = xmlDoc.getElementsByTagName('*');
    for (let i = 0; i < allNodes.length; i++) {
        if (allNodes[i].localName.toLowerCase() === 'activity') {
            const sportAttr = allNodes[i].getAttribute('Sport') || allNodes[i].getAttribute('sport');
            if (sportAttr) {
                sport = sportAttr;
                break;
            }
        }
    }

    const trackpointNodes = [];
    for (let i = 0; i < allNodes.length; i++) {
        if (allNodes[i].localName.toLowerCase() === 'trackpoint') {
            trackpointNodes.push(allNodes[i]);
        }
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
        if (!firstTimeStr && timeStr) {
            firstTimeStr = timeStr;
        }

        const timeSec = timeStr ? new Date(timeStr).getTime() / 1000 : null;

        if (startTimeSec === null && timeSec !== null) {
            startTimeSec = timeSec;
        }
        const elapsedSec = (timeSec !== null && startTimeSec !== null) ? (timeSec - startTimeSec) : 0;

        const hr = getHrVal(tp);
        const altRaw = getTagVal(tp, "AltitudeMeters");
        const alt = altRaw ? parseFloat(altRaw) : null;
        
        const speedRaw = getTagVal(tp, "Speed");
        let speed = speedRaw ? parseFloat(speedRaw) : null;
        
        const cadRaw = getTagVal(tp, "Cadence") || getTagVal(tp, "RunCadence");
        let cadence = cadRaw ? parseInt(cadRaw) : null;

        let totalCadence = cadence;
        if (cadence !== null && cadence < 110 && cadence > 40) {
            totalCadence = cadence * 2;
        }

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
                    slope = deltaAlt / deltaD;
                    slope = Math.max(-0.25, Math.min(0.25, slope));
                }
            }

            // GAP
            const costFactor = 1 + (3.3 * slope) + (10.5 * slope * slope);
            const gapSpeed = speed * costFactor;
            if (gapSpeed > 0.3) {
                gapPace = (1000 / gapSpeed) / 60;
            }

            // Laufleistung Momentanwert (Watts)
            const g = 9.81;
            const flatCostAcc = 1.04;
            const inclineAcc = g * Math.sin(Math.atan(slope));
            const totalAcc = Math.max(0.2, flatCostAcc + inclineAcc);
            rawPower = Math.round(runnerWeightKg * totalAcc * speed);
        }

        let strideLength = null;
        if (speed !== null && speed > 0.3 && totalCadence !== null && totalCadence > 0) {
            strideLength = speed / (totalCadence / 60);
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
            speed: speed,
            speedKmh: speedKmh,
            hr: hr,
            pace: pace,
            power: rawPower,
            gap: gapPace,
            alt: alt,
            cadence: totalCadence,
            strideLength: strideLength,
            eff: eff
        });
    }

    // Gleitender Durchschnitt für Leistung (30 Sekunden Window)
    const WINDOW_SEC = 30;
    let windowStartIdx = 0;

    for (let i = 0; i < trackpoints.length; i++) {
        const currentSec = trackpoints[i].elapsedSec;

        while (windowStartIdx < i && trackpoints[windowStartIdx].elapsedSec < currentSec - WINDOW_SEC) {
            windowStartIdx++;
        }

        let sumPower = 0;
        let countPower = 0;

        for (let j = windowStartIdx; j <= i; j++) {
            if (trackpoints[j].power !== null && trackpoints[j].power !== undefined) {
                sumPower += trackpoints[j].power;
                countPower++;
            }
        }

        if (countPower > 0) {
            trackpoints[i].power = Math.round(sumPower / countPower);
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
        stats: { dist: maxDist, avgHr: avgHr, maxHr: maxHr, drift: drift }
    };
}

function formatDate(d) {
    if (!d || isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }) + ' ' + d.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit'
    }) + ' Uhr';
}

function updateDashboardUI() {
    if (!file1Data && !file2Data) return;

    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');

    const f1Sport = file1Data ? file1Data.sport : '-';
    const f2Sport = file2Data ? `<span class="tcx2-text">${file2Data.sport}</span>` : '-';
    document.getElementById('statSport').innerHTML = `${f1Sport} / ${f2Sport}`;

    const f1Start = file1Data ? formatDate(file1Data.startDate) : '-';
    const f2Start = file2Data ? `<span class="tcx2-text">${formatDate(file2Data.startDate)}</span>` : '-';
    document.getElementById('statStartTime').innerHTML = `${f1Start} / ${f2Start}`;

    const f1Dist = file1Data ? `${file1Data.stats.dist.toFixed(2)} km` : '-';
    const f2Dist = file2Data ? `<span class="tcx2-text">${file2Data.stats.dist.toFixed(2)} km</span>` : '-';
    document.getElementById('statDistance').innerHTML = `${f1Dist} / ${f2Dist}`;

    const f1AvgHr = file1Data ? `${file1Data.stats.avgHr} bpm` : '-';
    const f2AvgHr = file2Data ? `<span class="tcx2-text">${file2Data.stats.avgHr} bpm</span>` : '-';
    document.getElementById('statAvgHr').innerHTML = `${f1AvgHr} / ${f2AvgHr}`;

    const f1MaxHr = file1Data ? `${file1Data.stats.maxHr} bpm` : '-';
    const f2MaxHr = file2Data ? `<span class="tcx2-text">${file2Data.stats.maxHr} bpm</span>` : '-';
    document.getElementById('statMaxHr').innerHTML = `${f1MaxHr} / ${f2MaxHr}`;

    const f1Drift = file1Data ? `${file1Data.stats.drift > 0 ? '+' : ''}${file1Data.stats.drift.toFixed(1)}%` : '-';
    const f2Drift = file2Data ? `<span class="tcx2-text">${file2Data.stats.drift > 0 ? '+' : ''}${file2Data.stats.drift.toFixed(1)}%</span>` : '-';
    document.getElementById('statDrift').innerHTML = `${f1Drift} / ${f2Drift}`;
}

function formatPace(paceDecimal) {
    if (!paceDecimal || isNaN(paceDecimal)) return '-';
    const mins = Math.floor(paceDecimal);
    const secs = Math.round((paceDecimal - mins) * 60);
    const secsStr = secs < 10 ? `0${secs}` : `${secs}`;
    return `${mins}:${secsStr}`;
}

function updateIntervalTable() {
    if (!file1Data && !file2Data) return;

    const intervalMin = parseInt(document.getElementById('intervalSelect').value);
    const intervalSec = intervalMin * 60;
    const tbody = document.getElementById('intervalTableBody');
    tbody.innerHTML = '';

    const maxDurationSec = Math.max(
        file1Data && file1Data.trackpoints.length ? file1Data.trackpoints[file1Data.trackpoints.length - 1].elapsedSec : 0,
        file2Data && file2Data.trackpoints.length ? file2Data.trackpoints[file2Data.trackpoints.length - 1].elapsedSec : 0
    );

    const numIntervals = Math.ceil(maxDurationSec / intervalSec);

    for (let i = 0; i < numIntervals; i++) {
        const startSec = i * intervalSec;
        const endSec = (i + 1) * intervalSec;

        const startMinStr = Math.floor(startSec / 60);
        const endMinStr = Math.floor(endSec / 60);
        const timeLabel = `${startMinStr}:00 - ${endMinStr}:00 min`;

        const f1Bin = file1Data ? file1Data.trackpoints.filter(p => p.elapsedSec >= startSec && p.elapsedSec < endSec) : [];
        const f1Metrics = computeBinStats(f1Bin);

        let f2Metrics = null;
        if (file2Data) {
            const f2Bin = file2Data.trackpoints.filter(p => p.elapsedSec >= startSec && p.elapsedSec < endSec);
            f2Metrics = computeBinStats(f2Bin);
        }

        const tr = document.createElement('tr');

        let cellTime = `<td><strong>${timeLabel}</strong></td>`;

        let cellSpeed = `<td>${f1Metrics.kmh ? f1Metrics.kmh + ' km/h (' + formatPace(f1Metrics.pace) + ')' : '-'}`;
        if (f2Metrics && f2Metrics.kmh) {
            cellSpeed += `<span class="f2-subtext">${f2Metrics.kmh} km/h (${formatPace(f2Metrics.pace)})</span>`;
        }
        cellSpeed += `</td>`;

        let cellHr = `<td>${f1Metrics.hr ? f1Metrics.hr + ' bpm' : '-'}`;
        if (f2Metrics && f2Metrics.hr) {
            cellHr += `<span class="f2-subtext">${f2Metrics.hr} bpm</span>`;
        }
        cellHr += `</td>`;

        let cellCadence = `<td>${f1Metrics.cadence ? f1Metrics.cadence + ' spm' : '-'}`;
        if (f2Metrics && f2Metrics.cadence) {
            cellCadence += `<span class="f2-subtext">${f2Metrics.cadence} spm</span>`;
        }
        cellCadence += `</td>`;

        let cellStride = `<td>${f1Metrics.stride ? f1Metrics.stride + ' m' : '-'}`;
        if (f2Metrics && f2Metrics.stride) {
            cellStride += `<span class="f2-subtext">${f2Metrics.stride} m</span>`;
        }
        cellStride += `</td>`;

        tr.innerHTML = cellTime + cellSpeed + cellHr + cellCadence + cellStride;
        tbody.appendChild(tr);
    }
}

function computeBinStats(binPts) {
    if (!binPts || binPts.length === 0) return { hr: null, kmh: null, pace: null, cadence: null, stride: null };

    const hrs = binPts.filter(p => p.hr).map(p => p.hr);
    const speeds = binPts.filter(p => p.speed && p.speed > 0.3).map(p => p.speed);
    const cadences = binPts.filter(p => p.cadence && p.cadence > 0).map(p => p.cadence);
    const strides = binPts.filter(p => p.strideLength).map(p => p.strideLength);

    const avgHr = hrs.length > 0 ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null;
    const avgSpeed = speeds.length > 0 ? (speeds.reduce((a, b) => a + b, 0) / speeds.length) : null;
    const avgCadence = cadences.length > 0 ? Math.round(cadences.reduce((a, b) => a + b, 0) / cadences.length) : null;
    const avgStride = strides.length > 0 ? (strides.reduce((a, b) => a + b, 0) / strides.length) : null;

    const kmh = avgSpeed ? (avgSpeed * 3.6).toFixed(1) : null;
    const pace = avgSpeed ? (1000 / avgSpeed) / 60 : null;

    return {
        hr: avgHr,
        kmh: kmh,
        pace: pace,
        cadence: avgCadence,
        stride: avgStride ? avgStride.toFixed(2) : null
    };
}

function createDataset(fileObj, metricKey, axisId, color, isDashed, filePrefix) {
    if (!fileObj || !fileObj.trackpoints.length) return null;

    const metricConfig = METRICS[metricKey];
    const propertyKey = metricKey === 'speed' ? 'speedKmh' : metricKey;

    const dataPoints = fileObj.trackpoints
        .filter(pt => {
            const val = pt[propertyKey];
            if (val === null || val === undefined) return false;
            // Pace & GAP im Diagramm bei max. 15 min/km kappen
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

    const datasets = [];

    const scales = {
        x: {
            type: 'linear',
            title: { display: true, text: 'Distanz (km)', color: '#aaa' },
            ticks: { color: '#aaa' },
            grid: { color: '#333' }
        }
    };

    // Linke Y-Achse
    const primaryConfig = METRICS[activePrimaryMetric];
    scales.y = {
        type: 'linear',
        position: 'left',
        reverse: primaryConfig.reverseY,
        title: { display: true, text: primaryConfig.label, color: '#e0e0e0' },
        ticks: { color: '#e0e0e0' },
        grid: { color: '#333' }
    };
    if (activePrimaryMetric === 'pace' || activePrimaryMetric === 'gap') {
        scales.y.max = 15;
    }

    // Y1 Datasets (Durchgezogen) -> TCX 1 = Weiß, TCX 2 = Orange
    const ds1_y1 = createDataset(file1Data, activePrimaryMetric, 'y', COLOR_F1, false, 'TCX 1');
    if (ds1_y1) datasets.push(ds1_y1);

    const ds2_y1 = createDataset(file2Data, activePrimaryMetric, 'y', COLOR_F2, false, 'TCX 2');
    if (ds2_y1) datasets.push(ds2_y1);

    // Rechte Y-Achse
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
        if (activeSecondaryMetric === 'pace' || activeSecondaryMetric === 'gap') {
            scales.y1.max = 15;
        }

        // Y2 Datasets (Gestrichelt) -> TCX 1 = Weiß, TCX 2 = Orange
        const ds1_y2 = createDataset(file1Data, activeSecondaryMetric, 'y1', COLOR_F1, true, 'TCX 1');
        if (ds1_y2) datasets.push(ds1_y2);

        const ds2_y2 = createDataset(file2Data, activeSecondaryMetric, 'y1', COLOR_F2, true, 'TCX 2');
        if (ds2_y2) datasets.push(ds2_y2);
    }

    const ctx = document.getElementById('tcxChart').getContext('2d');

    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            scales: scales,
            plugins: {
                legend: {
                    display: true,
                    labels: { color: '#e0e0e0', boxWidth: 12, font: { size: 10 } }
                },
                zoom: {
                    pan: { enabled: true, mode: 'x' },
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
