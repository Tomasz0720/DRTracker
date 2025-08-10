const map = L.map('map').setView([43.7, -79.4], 12); //Default view, will be updated to user's location

//Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

//Track bus data
const buses = {};
const fetchInterval = 5000; //5 seconds

//Initialize user location marker and watch ID
let userLocationMarker = null;
let watchId = null;
let routeList = [];
let routeColorMap = {};

//Get user's current location and start tracking
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

//Stop tracking user location
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

//Get live bus data
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

//Load route data from JSON file
async function loadRouteData() {
  const jsonRes = await fetch('/static/routes.json');
  routeList = await jsonRes.json();
  routeColorMap = {};
  routeList.forEach(route => {
    routeColorMap[route.id] = route.color;
  });
}

//Load routes from JSON files
async function loadRoutes() {
  try {
    const geoRes = await fetch('/static/routes.geojson');
    const geoData = await geoRes.json();

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

//Load stops from JSON files
async function loadStops() {
  try {
    const scheduleRes = await fetch('/static/trip_updates_by_stop.json');
    stopSchedule = await scheduleRes.json();

    const res = await fetch('/static/stops.geojson');
    const data = await res.json();

    L.geoJSON(data, {
      pointToLayer: (feature, latlng) => {
        const routeId = String(feature.properties.route_id || "");
        const outerCircle = L.circleMarker(latlng, {
          radius: 5,
          color: routeColorMap[routeId] || 'blue',
          fillColor: routeColorMap[routeId] || 'blue',
          fillOpacity: 0.5
        });

        const innerCircle = L.circleMarker(latlng, {
          radius: 2,
          color: 'white',
          fillColor: 'white',
          fillOpacity: 1,
          weight: 1
        });

        const group = L.featureGroup([outerCircle, innerCircle]);
        return group;

      },
      onEachFeature: (feature, layer) => {
        const stopId = feature.properties.stop_id || "Unknown";
        const stopName = feature.properties.stop_name || "Unnamed Stop";

        const nextBus = getNextArrivals(stopId) || "No upcoming buses.";

        const popupContent = `
          <strong>Stop ID:</strong> ${stopId}<br>
          <strong>Stop Name:</strong> ${stopName}<br><br>
          <strong>Next Buses:</strong><br>${nextBus}
        `;

        layer.bindPopup(popupContent);
      }
    }).addTo(map);
  } catch (err) {
    console.error("Failed to load stops or schedule:", err);
  }
}


let stopSchedule = {}; //Initialize empty object for live stop schedule
let staticStopSchedule = {}; //Initialize empty object for static schedule

fetch('/static/stop_schedule.json') //Fetch static stop schedule data
  .then(res => res.json())
  .then(data => staticStopSchedule = data);

fetch('/static/trip_updates_by_stop.json') //Fetch stop schedule data
  .then(res => res.json())
  .then(data => stopSchedule = data);

//Load bus schedule data
async function loadBusSchedule() {
  try {
    const res = await fetch('/static/trip_updates_by_stop.json');
    stopSchedule = await res.json();
    console.log("Stop schedule loaded:", stopSchedule);
  } catch (err) {
    console.error("Failed to load bus schedule data:", err);
  }
}

//Load stop schedule data
function getNextArrivals(stop_id) {
  const updates = stopSchedule[stop_id];

  // Check for live updates
  if (Array.isArray(updates) && updates.length > 0) {
    const now = Date.now() / 1000; // Current time in epoch seconds
    const upcoming = updates
      .filter(entry => entry.arrival >= now) // Only future arrivals
      .sort((a, b) => a.arrival - b.arrival) // Sort by arrival time
      .slice(0, 2); // Get the next 2 arrivals

    if (upcoming.length > 0) {
      return upcoming.map(entry => {
        const arrivalTime = convertEpochToStandardTime(entry.arrival);
        return `${arrivalTime} → Route ${entry.route_id}`;
      }).join('<br>');
    }
  }

  // Fallback to static schedule
  const staticUpdates = staticStopSchedule[stop_id];
  if (Array.isArray(staticUpdates) && staticUpdates.length > 0) {
    const now = new Date();
    const nowSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

    const upcoming = staticUpdates
      .map(entry => ({
        ...entry,
        seconds: parseTimeToSeconds(entry.arrival_time)
      }))
      .filter(entry => entry.seconds >= nowSeconds) // Only future arrivals
      .sort((a, b) => a.seconds - b.seconds) // Sort by arrival time
      .slice(0, 2); // Get the next 2 arrivals

    if (upcoming.length > 0) {
      return upcoming.map(entry => {
        const arrivalTime = convertTimeToStandard(entry.arrival_time);
        return `${arrivalTime} → Route ${entry.route_id}`;
      }).join('<br>');
    }
  }

  return "No schedule available for this stop.";
}

// Helper to parse "HH:MM:SS" time format to seconds
function parseTimeToSeconds(timeStr) {
  const [h, m, s] = timeStr.split(':').map(Number);
  return h * 3600 + m * 60 + (s || 0);
}

// Helper to convert "HH:MM" time format to AM/PM format
function convertTimeToStandard(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const adjustedHours = h % 12 || 12;
  return `${adjustedHours}:${m.toString().padStart(2, '0')} ${ampm}`;
}

//Helper to convert epoch seconds to AM/PM format
function convertEpochToStandardTime(epochSeconds) {
  const date = new Date(epochSeconds * 1000);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const adjustedHours = hours % 12 || 12;

  return `${adjustedHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

// Helper to get service ID based on date
function getServiceIdForDate(date) {
  const hour = date.getHours();
  const day = date.getDay(); // 0=Sunday, 6=Saturday

  if (hour < 5) {
    return "Overnight";
  }

  if (day === 0) return "Sunday";
  if (day === 6) return "Saturday";
  return "Weekday";
}


(async () => {
  await loadRouteData();
  loadRoutes();
  loadStops();
  fetchBusData();
  setInterval(fetchBusData, fetchInterval);
  animate();
  getUserLocation();
})();