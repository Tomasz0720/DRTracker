const map = L.map('map').setView([43.7, -79.4], 12);

//Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

//Track bus data
const buses = {};
const fetchInterval = 10000; //10 seconds

async function fetchBusData() {
  try {
    const res = await fetch('/vehicles');
    const data = await res.json();
    
    console.log("Bus data:", data);

    if (data.length === 0) {
        console.warn("Received 0 buses from backend. Not updating positions this time.");
        return;
    }

    const now = Date.now();
    const seen = new Set();

    data.forEach(bus => {
      const id = bus.id;
      seen.add(id);

      const lat = bus.lat;
      const lon = bus.lon;

      if (!buses[id]) {
        //Create marker for new bus
        const marker = L.circleMarker([lat, lon], {
          radius: 6,
          color: 'blue',
          fillColor: 'blue',
          fillOpacity: 0.8
        }).addTo(map).bindPopup(`Route ${bus.route}`);

        buses[id] = {
          marker,
          prevPos: [lat, lon],
          nextPos: [lat, lon],
          lastUpdate: now,
          lastSeen: now
        };
      } else {
        const busObj = buses[id];
        busObj.prevPos = busObj.marker.getLatLng();
        busObj.nextPos = [lat, lon];
        busObj.lastUpdate = now;
        busObj.lastSeen = now;
      }
    });

    //Remove buses that are no longer seen
    for (const id in buses) {
      if (!seen.has(id) && Date.now() - buses[id].lastSeen > fetchInterval * 3) {
        map.removeLayer(buses[id].marker);
        delete buses[id];
      }
    }
  } catch (err) {
    console.error("Failed to fetch bus data", err);
  }
}

//Animate markers between prevPos and nextPos
function animate() {
  const now = Date.now();

  for (const id in buses) {
    const bus = buses[id];
    const t = Math.min((now - bus.lastUpdate) / fetchInterval, 1);

    const [lat1, lon1] = [bus.prevPos.lat || bus.prevPos[0], bus.prevPos.lng || bus.prevPos[1]];
    const [lat2, lon2] = bus.nextPos;

    const lat = lat1 + (lat2 - lat1) * t;
    const lon = lon1 + (lon2 - lon1) * t;

    bus.marker.setLatLng([lat, lon]);
  }

  requestAnimationFrame(animate);
}


async function loadRoutes() {
  try {
    const res = await fetch('/static/routes.geojson');
    const data = await res.json();

    L.geoJSON(data, {
      style: {
        color: 'red',
        weight: 3
      },
      onEachFeature: (feature, layer) => {
        const routeId = feature.properties.route_id || "Unknown";
        layer.bindPopup(`Route ${routeId}`);
      }
    }).addTo(map);
  } catch (err) {
    console.error("Failed to load route lines:", err);
  }
}

async function loadStops() {
  try {
    const res = await fetch('/static/stops.geojson');
    const data = await res.json();

    L.geoJSON(data, {
      pointToLayer: (feature, latlng) => {
        return L.circleMarker(latlng, {
          radius: 1.5,
          color: 'black',
          fillColor: 'black',
          fillOpacity: 1
        });
      },
      onEachFeature: (feature, layer) => {
        const stopId = feature.properties.stop_id || "Unknown";
        layer.bindPopup(`Stop ${stopId}`);
      }
    }).addTo(map);
  } catch (err) {
    console.error("Failed to load stops:", err);
  }
}




loadRoutes();
loadStops();
fetchBusData();
setInterval(fetchBusData, fetchInterval);
animate();