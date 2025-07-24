# Python script that reads routes.txt and converts the data to routes.geojson.

import csv
import json
from collections import defaultdict


#Build mapping from shape_id to route_id using trips.txt
shape_id_to_route_id = {}
with open('static/gtfs/trips.txt', 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        shape_id_to_route_id[row['shape_id']] = row['route_id']

shapes = defaultdict(list)

with open('static/gtfs/shapes.txt', 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        shape_id = row['shape_id']
        lat = float(row['shape_pt_lat'])
        lon = float(row['shape_pt_lon'])
        seq = int(row['shape_pt_sequence'])

        shapes[shape_id].append((seq, lat, lon))

#Sort each shape path by point sequence
features = []
for shape_id, points in shapes.items():
    points.sort()
    coords = [[lon, lat] for _, lat, lon in points]

    features.append({
        "type": "Feature",
        "properties": {"shape_id": shape_id},
        "geometry": {
            "type": "LineString",
            "coordinates": coords
        }
    })
    
features = []
for shape_id, points in shapes.items():
    points.sort()
    coords = [[lon, lat] for _, lat, lon in points]
    route_id = shape_id_to_route_id.get(shape_id)
    features.append({
        "type": "Feature",
        "properties": {
            "shape_id": shape_id,
            "route_id": route_id
        },
        "geometry": {
            "type": "LineString",
            "coordinates": coords
        }
    })

geojson = {
    "type": "FeatureCollection",
    "features": features
}

#Save GeoJSON
with open('static/routes.geojson', 'w') as f:
    json.dump(geojson, f)