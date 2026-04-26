# Delay Predictor

A prototype web app that predicts travel delays between two locations on an interactive map.

Built with Flask and Leaflet.js as a learning project.

---

## What it does

Enter a start and destination, adjust the simulation panel (weather, vehicle type, speeds), and the app will draw available routes on the map — colour-coded by predicted delay severity.

- 🟢 Clear Path
- 🟠 Moderate Delay
- 🔴 Heavy Delay

---

## Tech Used

- Python + Flask (backend)
- Leaflet.js (map)
- OSRM (routing)
- Nominatim (geocoding)

No API keys needed for now.

---

## Running Locally

```bash
pip install flask
python app.py
```

Then open `http://127.0.0.1:5000` in your browser.

---

## Note

The prediction is currently simulation-based — you can manually set weather conditions and speed via the side panel to model different scenarios. The delay is calculated from those inputs, not live traffic data.

**Planned improvements:**
- Replace simulation with real traffic API calls
- Add an ML model for smarter delay predictions

---

*First project — feedback welcome!*
