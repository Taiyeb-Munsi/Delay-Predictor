const map = L.map('map').setView([51.505, -0.09], 13);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
}).addTo(map);

async function getCoords(address) {
    if (!address) return null;
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
        const response = await fetch(url);
        const results = await response.json();
        if (results.length > 0) {
            return [parseFloat(results[0].lat), parseFloat(results[0].lon)];
        }
    } catch (e) { console.error("Geocoding error:", e); }
    return null;
}

function updateUI(data) {
    document.getElementById('result').style.display = 'block';
    document.getElementById('resRoute').innerText = data.route;
    document.getElementById('resChance').innerText = (data.chance * 100).toFixed(0);
    document.getElementById('resDelay').innerText = data.delay;
    document.getElementById('resChain').innerText = data.chain_impact;
    document.getElementById('resStatus').innerText = data.status;
    document.getElementById('resStatus').style.backgroundColor = data.color;
}

function switchToRoute(selectedLine) {
    if (!window.routeLines) return;

    window.routeLines.forEach(line => {
        if (line === selectedLine) {
            line.setStyle({ 
                weight: 8, 
                opacity: 0.9, 
                dashArray: '',
                color: line.predictionData.color
            });
            line.bringToFront();
            updateUI(line.predictionData);
        } else {
            line.setStyle({ 
                weight: 4, 
                opacity: 0.4, 
                dashArray: '5, 10',
                color: '#95a5a6'
            });
        }
    });
}

async function getPrediction() {
    const startVal = document.getElementById('initalDestination').value;
    const endVal = document.getElementById('finalDestination').value;

    const startCoords = await getCoords(startVal);
    const endCoords = await getCoords(endVal);

    if (!startCoords || !endCoords) return;

    if (window.routingControl) { map.removeControl(window.routingControl); }
    if (window.routeLines) { window.routeLines.forEach(l => map.removeLayer(l)); }
    window.routeLines = [];

    window.routingControl = L.Routing.control({
        waypoints: [L.latLng(startCoords), L.latLng(endCoords)],
        router: L.Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1',
            profile: 'driving',
            serviceParameters: { alternatives: true } 
        }),
        show: false,
        addWaypoints: false,
        createMarker: () => null,
        lineOptions: {
            styles: [{ opacity: 0 }] 
        }
    }).addTo(map);

    window.routingControl.on('routesfound', async function(e) {
        const routes = e.routes;

        for (let i = 0; i < routes.length; i++) {
            const route = routes[i];
            
            try {
                const response = await fetch('/predict', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ 
                        start: startVal, 
                        end: endVal,
                        distance: route.summary.totalDistance,
                        duration: route.summary.totalTime,
                        routeIndex: i
                    })
                });
                const data = await response.json();

                const isPrimary = (i === 0);
                const line = L.polyline(route.coordinates, {
                    color: isPrimary ? data.color : '#95a5a6',
                    weight: isPrimary ? 8 : 4,
                    opacity: isPrimary ? 0.9 : 0.4,
                    dashArray: isPrimary ? '' : '5, 10',
                    interactive: true
                }).addTo(map);

                line.predictionData = data;
                window.routeLines.push(line);

                line.on('click', (e) => {
                    L.DomEvent.stopPropagation(e); 
                    switchToRoute(line);
                });

                if (isPrimary) updateUI(data);

            } catch (err) {
                console.error("Prediction failed", err);
            }
        }
    });
}
