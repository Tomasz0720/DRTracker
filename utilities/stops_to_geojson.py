# Python script that reads stops.txt and converts the data to stops.geojson.

import csv
import json

features = []

with open('static/gtfs/stops.txt', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        stop_id = row['stop_id']
        stop_name = row.get('stop_name', '')
        lat = float(row['stop_lat'])
        lon = float(row['stop_lon'])

        features.append({
            "type": "Feature",
            "properties": {
                "stop_id": stop_id,
                "stop_name": stop_name
            },
            "geometry": {
                "type": "Point",
                "coordinates": [lon, lat]
            }
        })

geojson = {
    "type": "FeatureCollection",
    "features": features
}

with open('static/stops.geojson', 'w', encoding='utf-8') as f:
    json.dump(geojson, f, ensure_ascii=False, indent=2)