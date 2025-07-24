# Python script that reads routes.txt and converts the data to routes.json.

import csv
import json

routes = []

with open("static/gtfs/routes.txt", newline='') as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        routes.append({
            "id": row["route_id"],
            "short_name": row["route_short_name"],
            "long_name": row["route_long_name"],
            "color": f"#{row['route_color']}",
            "text_color": f"#{row['route_text_color']}"
        })

with open("routes.json", "w") as f:
    json.dump(routes, f, indent=2)

print("routes.json created")
