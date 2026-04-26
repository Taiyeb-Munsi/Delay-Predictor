from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    data = request.json
    
    dist_km = data.get('distance', 0) / 1000
    weather = data.get('weather', 'clear')
    
    weather_map = {
        'clear': 1.0,
        'light rain': 1.2,
        'heavy rain': 1.4,
        'snow': 1.8
    }
    w_term = weather_map.get(weather, 1.0)

    free_flow = data.get('freeFlowSpeed', 50) 
    current_speed = max(data.get('currentSpeed', 50), 1) 
    t_term = free_flow / current_speed

    vehicle_type = data.get('vehicleType', 'car')
    vehicle_speeds = {
        'bike': 20,
        'car': 50,
        'truck': 35
    }
    base_speed = vehicle_speeds.get(vehicle_type, 50)

    total_mins = (dist_km / base_speed) * 60 * w_term * t_term
    
    delay_ratio = w_term * t_term
    
    if delay_ratio > 1.5:
        status = "HEAVY DELAY"
        color = "#e74c3c" 
    elif delay_ratio > 1.1:
        status = "MODERATE DELAY"
        color = "#f39c12"
    else:
        status = "CLEAR PATH"
        color = "#27ae60"

    return jsonify({
        "route": f"Route Option {data.get('routeIndex', 0) + 1}",
        "chance": round(min(delay_ratio - 1, 1), 2),
        "delay": round(total_mins, 1),
        "chain_impact": round(total_mins * 1.3, 1),
        "status": status,
        "color": color
    })

if __name__ == '__main__':
    app.run(debug=True)
