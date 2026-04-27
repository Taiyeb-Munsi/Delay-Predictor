from flask import Flask, render_template, jsonify, request
import math
import requests

app = Flask(__name__)

TOMTOM_KEY = 'i0znLHvfdagnqjE1KTS2J8FpFBNpBAIg'
OWM_KEY = 'ece32be66ae6a28334d1a573cc06540d'

def fetch_traffic(lat, lon):
    try:
        url = f'https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point={lat},{lon}&key={TOMTOM_KEY}'
        r = requests.get(url, timeout=4)
        d = r.json()
        seg = d['flowSegmentData']
        return seg['freeFlowSpeed'], seg['currentSpeed']
    except Exception:
        return None, None

def fetch_weather(lat, lon):
    try:
        url = f'https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={OWM_KEY}'
        r = requests.get(url, timeout=4)
        d = r.json()
        main = d['weather'][0]['main'].lower()
        if 'snow' in main:
            return 'snow'
        if 'rain' in main:
            rain_1h = d.get('rain', {}).get('1h', 0)
            return 'heavy rain' if rain_1h > 5 else 'light rain'
        return 'clear'
    except Exception:
        return None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    data = request.json

    dist_km = data.get('distance', 0) / 1000
    osrm_time_secs = data.get('osrmTimeSecs', 0)
    osrm_time_mins = osrm_time_secs / 60.0
    num_instructions = data.get('numInstructions', 0)
    sampled_points = data.get('sampledPoints', [])
    vehicle_type = data.get('vehicleType', 'car')

    free_flow_speeds = []
    current_speeds = []
    weather_counts = {}

    for pt in sampled_points:
        lat, lon = pt['lat'], pt['lng']

        ff, cs = fetch_traffic(lat, lon)
        if ff is not None and cs is not None:
            free_flow_speeds.append(ff)
            current_speeds.append(cs)

        w = fetch_weather(lat, lon)
        if w:
            weather_counts[w] = weather_counts.get(w, 0) + 1

    if free_flow_speeds:
        avg_free_flow = sum(free_flow_speeds) / len(free_flow_speeds)
        avg_current = sum(current_speeds) / len(current_speeds)
    else:
        avg_free_flow = 50.0
        avg_current = 40.0

    if weather_counts:
        dominant_weather = max(weather_counts, key=weather_counts.get)
    else:
        dominant_weather = 'clear'

    weather_map = {
        'clear': 1.0,
        'light rain': 1.15,
        'heavy rain': 1.35,
        'snow': 1.65
    }
    w_term = weather_map.get(dominant_weather, 1.0)

    avg_free_flow = max(avg_free_flow, 1)
    avg_current = max(avg_current, 1)
    congestion_ratio = max(avg_free_flow / avg_current, 1.0)

    delay_ratio = w_term * congestion_ratio

    vehicle_max_speed = {
        'bike': 25,
        'car': 90,
        'truck': 60
    }
    v_max = vehicle_max_speed.get(vehicle_type, 90)

    if osrm_time_mins > 0:
        base_mins = osrm_time_mins
    else:
        base_mins = (dist_km / max(min(avg_current, v_max), 1)) * 60

    turn_penalty = num_instructions * 0.1

    total_mins = (base_mins * congestion_ratio * w_term) + turn_penalty

    if vehicle_type == 'bike':
        cap_speed = min(avg_current, v_max)
        total_mins = max(total_mins, (dist_km / max(cap_speed, 1)) * 60 * w_term)

    if delay_ratio >= 1.5:
        status = 'HEAVY DELAY'
        color = '#e74c3c'
    elif delay_ratio >= 1.2:
        status = 'MODERATE DELAY'
        color = '#f39c12'
    elif delay_ratio >= 1.05:
        status = 'MINOR DELAY'
        color = '#f1c40f'
    else:
        status = 'CLEAR PATH'
        color = '#27ae60'

    z = 7.0 * (delay_ratio - 1.15)
    prob = 1 / (1 + math.exp(-z))

    free_flow_mins = (dist_km / avg_free_flow) * 60
    extra_delay = max(total_mins - free_flow_mins, 0)
    chain_impact = round(total_mins + extra_delay * 1.5)

    return jsonify({
        'route': f"Route Option {data.get('routeIndex', 0) + 1}",
        'chance': round(prob, 3),
        'delay': round(total_mins, 1),
        'chain_impact': chain_impact,
        'status': status,
        'color': color,
        'weather': dominant_weather,
        'avgSpeed': round(avg_current, 1),
        'congestion': round(congestion_ratio, 2)
    })

if __name__ == '__main__':
    app.run(debug=True)
