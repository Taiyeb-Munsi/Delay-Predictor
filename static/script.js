const map = L.map('map').setView([51.505, -0.09], 13);
let currentRouteIndex = 0;

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
        return results.length > 0 ? [parseFloat(results[0].lat), parseFloat(results[0].lon)] : null;
    } catch (e) { 
        return null; 
    }
}

function updateUI(data, index, total) {
    document.getElementById('result').style.display = 'block';
    document.getElementById('resRoute').innerText = "Route " + (index + 1);
    document.getElementById('routeCount').innerText = `${index + 1} of ${total}`;
    
    const km = (data.rawDistance / 1000).toFixed(1);
    const mins = Math.round(data.rawDuration / 60);
    document.getElementById('resStats').innerText = `${km} km | ${mins} min trip`;

    document.getElementById('resChance').innerText = (data.chance * 100).toFixed(0);
    document.getElementById('resDelay').innerText = data.delay;
    document.getElementById('resChain').innerText = data.chain_impact;
    document.getElementById('resStatus').innerText = data.status;
    document.getElementById('resStatus').style.backgroundColor = data.color;
}

function switchToRoute(selectedLine) {
    if (!window.routeLines) return;
    window.routeLines.forEach((line, index) => {
        const isTarget = (line === selectedLine);
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
    if (!window.routeLines || window.routeLines.length === 0) return;
    currentRouteIndex = (currentRouteIndex + 1) % window.routeLines.length;
    switchToRoute(window.routeLines[currentRouteIndex]);
}

async function getPrediction() {
    const btn = document.getElementById('predictBtn');
    const startVal = document.getElementById('initalDestination').value;
    const endVal = document.getElementById('finalDestination').value;

    if (!startVal || !endVal) {
        alert("Please enter both start and destination");
        return;
    }

    btn.disabled = true;
    btn.innerText = "Loading...";

    const startCoords = await getCoords(startVal);
    const endCoords = await getCoords(endVal);

    if (!startCoords || !endCoords) {
        alert("Could not find coordinates for those locations.");
        btn.disabled = false;
        btn.innerText = "Predict Delay";
        return;
    }

    if (window.routingControl) map.removeControl(window.routingControl);
    if (window.routeLines) window.routeLines.forEach(l => map.removeLayer(l));
    
    window.routeLines = [];
    document.getElementById('nextRouteBtn').style.display = 'none';

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
        lineOptions: { styles: [{ opacity: 0 }] }
    }).addTo(map);

    window.routingControl.on('routesfound', async function(e) {
        const routes = e.routes;
        
        const predictionPromises = routes.map(async (route, i) => {
            const response = await fetch('/predict', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                    distance: route.summary.totalDistance,
                    duration: route.summary.totalTime,
                    routeIndex: i
                })
            });
            const data = await response.json();
            return {
                routeData: route,
                predictionData: {
                    ...data,
                    rawDistance: route.summary.totalDistance,
                    rawDuration: route.summary.totalTime
                }
            };
        });

        const allRouteResults = await Promise.all(predictionPromises);

        allRouteResults.sort((a, b) => a.predictionData.chance - b.predictionData.chance);

        allRouteResults.forEach((result, i) => {
            const isBestChance = (i === 0);
            
            const line = L.polyline(result.routeData.coordinates, {
                color: isBestChance ? result.predictionData.color : '#95a5a6',
                weight: isBestChance ? 8 : 4,
                opacity: isBestChance ? 0.9 : 0.4,
                dashArray: isBestChance ? '' : '5, 10',
                interactive: true
            }).addTo(map);

            line.predictionData = result.predictionData;
            window.routeLines.push(line);

            line.on('click', (ev) => {
                L.DomEvent.stopPropagation(ev);
                switchToRoute(line);
            });

            if (isBestChance) {
                currentRouteIndex = i;
                updateUI(result.predictionData, i, allRouteResults.length);
                line.bringToFront();
            }
        });

        btn.disabled = false;
        btn.innerText = "Predict Delay";
        
        if (window.routeLines.length > 1) {
            document.getElementById('nextRouteBtn').style.display = 'inline-block';
        }
        
        const group = new L.featureGroup(window.routeLines);
        map.fitBounds(group.getBounds());
    });

    window.routingControl.on('routingerror', () => {
        alert("Could not find a route between these points.");
        btn.disabled = false;
        btn.innerText = "Predict Delay";
    });
}
