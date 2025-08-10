from google.transit import gtfs_realtime_pb2
import requests
import pprint

FEED_URL = "https://drtonline.durhamregiontransit.com/gtfsrealtime/VehiclePositions"  # or TripUpdates

def dump_gtfs_rt(url):
    feed = gtfs_realtime_pb2.FeedMessage()
    response = requests.get(url)
    feed.ParseFromString(response.content)

    for entity in feed.entity:
        for field, value in entity.ListFields():
            print(f"{field.name}: {value}")
        print("-" * 60)

dump_gtfs_rt(FEED_URL)
