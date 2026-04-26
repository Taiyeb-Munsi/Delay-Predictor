from flask import Flask, render_template, jsonify, request
import random

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    data = request.json
    
    chance = round(random.uniform(0, 1), 2)
    
    dist_km = data.get('distance', 0) / 1000
    base_time = int(dist_km * 1.2) + random.randint(1, 10)
    
    if chance > 0.7:
        status = "HEAVY DELAY"
        color = "#e74c3c" 
    elif chance > 0.3:
        status = "MODERATE DELAY"
        color = "#f39c12"
    else:
        status = "CLEAR PATH"
        color = "#27ae60"

    return jsonify({
        "route": f"Route Option {data.get('routeIndex', 0) + 1}",
        "chance": chance,
        "delay": base_time,
        "chain_impact": round(base_time * 1.3),
        "status": status,
        "color": color
    })

if __name__ == '__main__':
    app.run(debug=True)
