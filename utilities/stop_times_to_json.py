# # Python script that reads stop_times.txt and converts the data to stop_schedule.json
# # Output: {stop_id: [{arrival_time, departure_time, route_id}, ...], ...}

from collections import defaultdict
import csv
import json

stop_times_file = 'static/gtfs/stop_times.txt'
trips_file = 'static/gtfs/trips.txt'

# Load route_id for each trip_id
trip_route = {}
trip_service = {}
with open(trips_file, newline='', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        trip_route[row['trip_id']] = row['route_id']
        trip_service[row['trip_id']] = row['service_id']

# Build stop schedule
stop_schedule = defaultdict(list)

with open(stop_times_file, newline='', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        stop_id = row['stop_id']
        arrival_time = row['arrival_time']
        departure_time = row['departure_time']
        trip_id = row['trip_id']

        # Skip malformed times
        if not arrival_time or ':' not in arrival_time:
            continue
        if not departure_time or ':' not in departure_time:
            continue

        route_id = trip_route.get(trip_id, '')
        service_id = trip_service.get(trip_id, '')
        
        stop_schedule[stop_id].append({
            'arrival_time': arrival_time,
            'departure_time': departure_time,
            'route_id': route_id,
            'service_id': service_id
        })

# Remove duplicates for each stop (by arrival_time, departure_time, route_id)
for stop_id in stop_schedule:
    seen = set()
    unique = []
    for item in stop_schedule[stop_id]:
        key = (item['arrival_time'], item['departure_time'], item['route_id'])
        if key not in seen:
            unique.append(item)
            seen.add(key)
    stop_schedule[stop_id] = unique

# Save as JSON
with open('static/stop_schedule.json', 'w', encoding='utf-8') as f:
    json.dump(stop_schedule, f, indent=2)
