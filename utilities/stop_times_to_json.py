# Python script that reads stop_times.txt and converts the data to stop_schedule.json.

from collections import defaultdict
import csv
import json

stop_times_file = 'static/gtfs/stop_times.txt'
trips_file = 'static/gtfs/trips.txt'

#Load headsigns for each trip
trip_headsign = {}
with open(trips_file, newline='', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        trip_headsign[row['trip_id']] = row['trip_headsign']

#Build stop schedule
stop_schedule = defaultdict(list)

with open(stop_times_file, newline='', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        stop_id = row['stop_id']
        arrival_time = row['arrival_time']
        trip_id = row['trip_id']

        #Skip malformed times
        if not arrival_time or ':' not in arrival_time:
            continue

        #Convert time to seconds since midnight
        try:
            h, m, s = map(int, arrival_time.split(':'))
            seconds = h * 3600 + m * 60 + s
        except:
            continue

        #Append with headsign
        stop_schedule[stop_id].append({
            'arrival_time': arrival_time,
            'seconds': seconds,
            'headsign': trip_headsign.get(trip_id, '')
        })

#Remove duplicates for each stop
for stop_id in stop_schedule:
    seen = set()
    unique = []
    for item in sorted(stop_schedule[stop_id], key=lambda x: x['seconds']):
        if item['arrival_time'] not in seen:
            unique.append(item)
            seen.add(item['arrival_time'])
    stop_schedule[stop_id] = unique

#Save as JSON
with open('stop_schedule.json', 'w', encoding='utf-8') as f:
    json.dump(stop_schedule, f, indent=2)
