from flask import Flask, render_template, jsonify
from google.transit import gtfs_realtime_pb2
import requests
import time
import json
from datetime import datetime
import threading

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/routes')
def get_routes():
    try:
        feed = gtfs_realtime_pb2.FeedMessage()
        url = 'https://drtonline.durhamregiontransit.com/gtfsrealtime/VehiclePositions'
        response = requests.get(url)
        response.raise_for_status()
        feed.ParseFromString(response.content)
        
        route_ids = set()
        for entity in feed.entity:
            if entity.HasField('vehicle') and entity.vehicle.HasField('trip'):
                route_id = entity.vehicle.trip.route_id
                if route_id:
                    route_ids.add(route_id)
                    
        print(f"Detected route IDs: {sorted(list(route_ids))}", flush=True)
        return jsonify(sorted(list(route_ids)))
    except Exception as e:
        print(f"Error fetching or parsing feed: {e}")
        return jsonify([])

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



FEED_URL = "https://drtonline.durhamregiontransit.com/gtfsrealtime/TripUpdates"
OUTPUT_FILE = "static/trip_updates_by_stop.json"
UPDATE_INTERVAL = 300000  # 5 minutes in milliseconds

def fetch_trip_updates():
    response = requests.get(FEED_URL)
    feed = gtfs_realtime_pb2.FeedMessage()
    feed.ParseFromString(response.content)

    #Create structure organized by stop_id
    stop_updates = {}

    for entity in feed.entity:
        if not entity.HasField("trip_update"):
            continue

        trip_id = entity.trip_update.trip.trip_id
        route_id = entity.trip_update.trip.route_id

        for stop_time_update in entity.trip_update.stop_time_update:
            stop_id = stop_time_update.stop_id
            if stop_time_update.HasField("arrival"):
                arrival_time = stop_time_update.arrival.time  # epoch seconds
            elif stop_time_update.HasField("departure"):
                arrival_time = stop_time_update.departure.time
            else:
                continue

            entry = {
                "trip_id": trip_id,
                "route_id": route_id,
                "arrival": arrival_time
            }

            stop_updates.setdefault(stop_id, []).append(entry)

    #Save to file
    with open(OUTPUT_FILE, "w") as f:
        json.dump(stop_updates, f, indent=2)

    print(f"[{datetime.now().strftime('%H:%M:%S')}] Trip updates saved.")

def run_updater():
    while True:
        try:
            fetch_trip_updates()
        except Exception as e:
            print("Error updating trip data:", e)
        time.sleep(UPDATE_INTERVAL)


if __name__ == '__main__':
    #Start trip_updates_by_stop.json updater in a separate thread
    updater_thread = threading.Thread(target=run_updater, daemon=True)
    updater_thread.start()

    #Start the Flask app
    app.run(debug=True)