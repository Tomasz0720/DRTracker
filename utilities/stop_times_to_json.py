# # # Python script that reads stop_times.txt and converts the data to stop_schedule.json
# # # Output: {stop_id: [{arrival_time, departure_time, route_id}, ...], ...}

from collections import defaultdict
import csv
import json

stop_times_file = 'static/gtfs/stop_times.txt'
trips_file = 'static/gtfs/trips.txt'

def time_to_seconds(time_str):
    """Convert HH:MM:SS time string to seconds for sorting"""
    try:
        parts = time_str.split(':')
        hours = int(parts[0])
        minutes = int(parts[1])
        seconds = int(parts[2]) if len(parts) > 2 else 0
        return hours * 3600 + minutes * 60 + seconds
    except (ValueError, IndexError):
        return float('inf')  # Put invalid times at the end

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

# Remove duplicates and sort for each stop
for stop_id in stop_schedule:
    # Remove duplicates (by arrival_time, departure_time, route_id, service_id)
    seen = set()
    unique = []
    for item in stop_schedule[stop_id]:
        key = (item['arrival_time'], item['departure_time'], item['route_id'], item['service_id'])
        if key not in seen:
            unique.append(item)
            seen.add(key)
    
    # Sort by arrival time (earliest to latest)
    unique.sort(key=lambda x: time_to_seconds(x['arrival_time']))
    
    stop_schedule[stop_id] = unique

# Save as JSON
with open('static/stop_schedule.json', 'w', encoding='utf-8') as f:
    json.dump(stop_schedule, f, indent=2)

print(f"Generated stop_schedule.json with {len(stop_schedule)} stops")
print("Arrival times are sorted from earliest to latest for each stop")