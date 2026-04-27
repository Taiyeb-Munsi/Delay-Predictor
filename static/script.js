const map = L.map('map').setView([28.6139, 77.2090], 12);
let currentRouteIndex = 0;
window.routeLines = [];

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

async function getCoords(address) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
        const results = await response.json();
        return results.length > 0 ? [parseFloat(results[0].lat), parseFloat(results[0].lon)] : null;
    } catch (e) { return null; }
}

function sampleCoords(coordinates, count) {
    const total = coordinates.length;
    if (total <= count) return coordinates.map(c => ({ lat: c.lat, lng: c.lng }));
    const result = [];
    for (let i = 0; i < count; i++) {
        const idx = Math.round((i / (count - 1)) * (total - 1));
        result.push({ lat: coordinates[idx].lat, lng: coordinates[idx].lng });
    }
    return result;
}

function updateUI(data, index, total) {
    document.getElementById('result').style.display = 'block';
    document.getElementById('resRoute').innerText = 'Route ' + (index + 1);
    document.getElementById('routeCount').innerText = `${index + 1} of ${total}`;
    document.getElementById('resStats').innerText = `${(data.rawDistance / 1000).toFixed(1)} km | ${data.delay} min trip`;
    document.getElementById('resChance').innerText = (data.chance * 100).toFixed(0);
    document.getElementById('resDelay').innerText = data.delay;
    document.getElementById('resChain').innerText = data.chain_impact;
    document.getElementById('resStatus').innerText = data.status;
    document.getElementById('resStatus').style.backgroundColor = data.color;
}

function switchToRoute(selectedLine) {
    window.routeLines.forEach((line, index) => {
        const isTarget = line === selectedLine;
        if (isTarget) currentRouteIndex = index;
        line.setStyle({
            weight: isTarget ? 8 : 4,
            opacity: isTarget ? 0.9 : 0.4,
            dashArray: isTarget ? '' : '5, 10',
            color: isTarget ? line.predictionData.color : '#95a5a6'
        });
        if (isTarget) {
            line.bringToFront();
            updateUI(line.predictionData, index, window.routeLines.length);
        }
    });
}

function cycleRoute() {
    if (window.routeLines.length === 0) return;
    currentRouteIndex = (currentRouteIndex + 1) % window.routeLines.length;
    switchToRoute(window.routeLines[currentRouteIndex]);
}

async function getPrediction() {
    const btn = document.getElementById('predictBtn');
    const startVal = document.getElementById('initalDestination').value.trim();
    const endVal = document.getElementById('finalDestination').value.trim();

    if (!startVal || !endVal) return alert('Enter both locations');

    btn.disabled = true;
    btn.innerText = 'Analyzing Routes...';

    const startCoords = await getCoords(startVal);
    const endCoords = await getCoords(endVal);

    if (!startCoords || !endCoords) {
        btn.disabled = false;
        btn.innerText = 'Predict Delay';
        return alert('Locations not found');
    }

    if (window.routingControl) map.removeControl(window.routingControl);
    window.routeLines.forEach(l => map.removeLayer(l));
    window.routeLines = [];

    window.routingControl = L.Routing.control({
        waypoints: [L.latLng(startCoords), L.latLng(endCoords)],
        router: L.Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1',
            profile: 'driving',
            serviceParameters: { alternatives: true }
        }),
        show: false,
        lineOptions: { styles: [{ opacity: 0 }] }
    }).addTo(map);

    window.routingControl.on('routesfound', async function(e) {
        const routes = e.routes;
        const vehicle = document.getElementById('vehicleSelect').value;

        const results = await Promise.all(routes.map(async (route, i) => {
            const sampledPoints = sampleCoords(route.coordinates, 7);

            const res = await fetch('/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    distance: route.summary.totalDistance,
                    osrmTimeSecs: route.summary.totalTime,
                    routeIndex: i,
                    vehicleType: vehicle,
                    numInstructions: route.instructions ? route.instructions.length : 0,
                    sampledPoints: sampledPoints
                })
            });
            const pData = await res.json();
            return { route, pData };
        }));

        results.sort((a, b) => a.pData.delay - b.pData.delay);

        results.forEach((res, i) => {
            const isBest = i === 0;
            const line = L.polyline(res.route.coordinates, {
                color: isBest ? res.pData.color : '#95a5a6',
                weight: isBest ? 8 : 4,
                opacity: isBest ? 0.9 : 0.4,
                dashArray: isBest ? '' : '5, 10',
                interactive: true
            }).addTo(map);

            line.predictionData = { ...res.pData, rawDistance: res.route.summary.totalDistance };
            window.routeLines.push(line);
            line.on('click', () => switchToRoute(line));
            if (isBest) updateUI(line.predictionData, 0, results.length);
        });

        document.getElementById('nextRouteBtn').style.display = results.length > 1 ? 'inline-block' : 'none';
        map.fitBounds(new L.featureGroup(window.routeLines).getBounds());
        btn.disabled = false;
        btn.innerText = 'Predict Delay';
    });

    window.routingControl.on('routingerror', function() {
        btn.disabled = false;
        btn.innerText = 'Predict Delay';
        alert('Could not find a route between these locations.');
    });
}
