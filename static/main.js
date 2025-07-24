const map = L.map('map').setView([43.7, -79.4], 12); //CHANGE TO GET USERS LOCATION

//Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

//Track bus data
const buses = {};
const fetchInterval = 5000; //5 seconds

let userLocationMarker = null;
let watchId = null;

const getUserLocation = () => {
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition((position) => {
      let lat = position.coords.latitude;
      let lon = position.coords.longitude;

      map.setView([lat, lon], 14);

      if(userLocationMarker){
        map.removeLayer(userLocationMarker);
      }

      userLocationMarker = L.circleMarker([lat, lon], {
        radius: 8,
        color: 'red',
        fillColor: 'red',
        fillOpacity: 1,
        weight: 2
      }).addTo(map).bindPopup('Your Location');

      console.log('User Location:', lat, lon);

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newLat = position.coords.latitude;
          const newLon = position.coords.longitude;

          userLocationMarker.setLatLng([newLat, newLon]);
          console.log('Location Updated:', newLat, newLon);
        },
        (error) => {
          console.error('Error watching position:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    },
    (error) => {
      console.error('Error getting initial position:', error);
      alert("Unable to retrieve your location. Using default view");
    });
  }
  else{
    alert("Geolocation is not supported by this browser.")
  }
}

const stopLocationTracking = () => {
  if(watchId !== null){
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if(userLocationMarker){
    map.removeLayer(userLocationMarker);
    userLocationMarker = null;
  }
}

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

//Load routes from JSON files
async function loadRoutes() {
  try {
    const geoRes = await fetch('/static/routes.geojson');
    const jsonRes = await fetch('/static/routes.json');
    const geoData = await geoRes.json();
    const routeList = await jsonRes.json();

    const routeColorMap = {};
    routeList.forEach(route => {
      routeColorMap[route.id] = route.color;
    });

    L.geoJSON(geoData, {
      style: feature => {
        const routeId = String(feature.properties.route_id);
        return {
          color: routeColorMap[routeId] || 'red',
          weight: 3
        };
      },
      onEachFeature: (feature, layer) => {
        const routeId = String(feature.properties.route_id);
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
          radius: 2.5,
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

fetchBusData();
setInterval(fetchBusData, fetchInterval);
animate();
loadRoutes();
loadStops();
getUserLocation();