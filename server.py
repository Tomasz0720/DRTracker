from flask import Flask, render_template, jsonify
from google.transit import gtfs_realtime_pb2
import requests

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/vehicles')
def get_vehicles():
    try:
        feed = gtfs_realtime_pb2.FeedMessage()
        url = 'https://drtonline.durhamregiontransit.com/gtfsrealtime/VehiclePositions'
        response = requests.get(url)
        response.raise_for_status()
        feed.ParseFromString(response.content)

        vehicles = []
        for entity in feed.entity:
            if entity.HasField('vehicle'):
                vehicle = entity.vehicle
                pos = vehicle.position

                if not pos.HasField("latitude") or not pos.HasField("longitude"):
                    continue # If no position, skip

                vehicle_id = ""
                if vehicle.HasField("vehicle") and vehicle.vehicle.id:
                    vehicle_id = vehicle.vehicle.id
                elif vehicle.HasField("trip") and vehicle.trip.trip_id:
                    vehicle_id = vehicle.trip.trip_id
                else:
                    continue # If no ID, skip

                route_id = vehicle.trip.route_id if vehicle.HasField("trip") else "?"

                vehicles.append({
                    "id": vehicle_id,
                    "route": route_id,
                    "lat": pos.latitude,
                    "lon": pos.longitude
                })

        print(f"Returned {len(vehicles)} vehicles")
        return jsonify(vehicles)

    except Exception as e:
        print(f"Error fetching or parsing feed: {e}")
        return jsonify([])


if __name__ == '__main__':
    app.run(debug=True)