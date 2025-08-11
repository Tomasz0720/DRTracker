# stop_id_by_route.py
# Generates a JSON file mapping route IDs to their stop IDs.

import json

with open('static/stop_schedule.json', 'r') as f:
    stop_schedule = json.load(f)

stops_by_route = {}

for stop_id, entries in stop_schedule.items():
    for entry in entries:
        route_id = entry.get('route_id')
        if route_id:
            stops_by_route.setdefault(route_id, set()).add(stop_id)

# Convert sets to lists for JSON serialization
stops_by_route = {route: list(stops) for route, stops in stops_by_route.items()}

with open('static/stops_by_route.json', 'w') as f:
    json.dump(stops_by_route, f, indent=2)

print("Generated stops_by_route.json")