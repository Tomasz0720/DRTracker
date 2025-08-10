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


async function loadStops() {
  try {
    // Load both schedule files with proper error handling
    console.log("Loading schedule data...");
    
    const scheduleRes = await fetch('/static/trip_updates_by_stop.json');
    if (!scheduleRes.ok) {
      console.error('Failed to fetch trip_updates_by_stop.json:', scheduleRes.status);
    }
    stopSchedule = await scheduleRes.json();
    console.log("Live schedule loaded, stops count:", Object.keys(stopSchedule).length);

    const staticScheduleRes = await fetch('/static/stop_schedule.json');
    if (!staticScheduleRes.ok) {
      console.error('Failed to fetch stop_schedule.json:', staticScheduleRes.status);
    }
    staticStopSchedule = await staticScheduleRes.json();
    console.log("Static schedule loaded, stops count:", Object.keys(staticStopSchedule).length);

    // Load stops geojson
    const res = await fetch('/static/stops.geojson');
    const data = await res.json();
    console.log("Stops geojson loaded, features count:", data.features.length);

    // Sample a few stop IDs to verify they exist in our schedule data
    const sampleStopIds = data.features.slice(0, 5).map(f => f.properties.stop_id);
    console.log("Sample stop IDs from geojson:", sampleStopIds);
    
    sampleStopIds.forEach(stopId => {
      const hasStatic = staticStopSchedule[stopId] ? staticStopSchedule[stopId].length : 0;
      const hasLive = stopSchedule[stopId] ? stopSchedule[stopId].length : 0;
      console.log(`Stop ${stopId}: Static entries=${hasStatic}, Live entries=${hasLive}`);
    });

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

        // Create a click handler that gets fresh data when clicked
        layer.on('click', () => {
          const nextBus = getNextArrivals(stopId) || "No upcoming buses.";
          
          const popupContent = `
            <strong>Stop ID:</strong> ${stopId}<br>
            <strong>Stop Name:</strong> ${stopName}<br><br>
            <strong>Next Buses:</strong><br>${nextBus}
          `;
          
          layer.bindPopup(popupContent).openPopup();
        });

        // Set initial popup content
        const initialNextBus = getNextArrivals(stopId) || "No upcoming buses.";
        const initialPopupContent = `
          <strong>Stop ID:</strong> ${stopId}<br>
          <strong>Stop Name:</strong> ${stopName}<br><br>
          <strong>Next Buses:</strong><br>${initialNextBus}
        `;
        
        layer.bindPopup(initialPopupContent);
      }
    }).addTo(map);
  } catch (err) {
    console.error("Failed to load stops or schedule:", err);
  }
}


let stopSchedule = {}; // Initialize empty object for live stop schedule
let staticStopSchedule = {}; // Initialize empty object for static schedule

fetch('/static/stop_schedule.json') // Fetch static stop schedule data
  .then(res => res.json())
  .then(data => staticStopSchedule = data);

fetch('/static/trip_updates_by_stop.json') // Fetch stop schedule data
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


function getNextArrivals(stop_id) {
  console.log(`=== Getting next arrivals for stop ${stop_id} ===`);
  
  // Check if schedule data is loaded
  if (Object.keys(staticStopSchedule).length === 0) {
    console.warn("Static schedule not loaded yet!");
    return "Schedule data still loading...";
  }

  // Check for live arrivals
  const liveArrivals = getLiveNextArrivals(stop_id);
  if(liveArrivals){
    console.log(`Found live arrivals for stop ${stop_id}`);
    return liveArrivals;
  }

  // Fall back on static schedule if no live arrivals
  const staticArrivals = getStaticNextArrivals(stop_id);
  console.log(`Static arrivals result for stop ${stop_id}:`, staticArrivals);
  return staticArrivals || "No upcoming buses.";
}


function getLiveNextArrivals(stop_id) {
  const updates = stopSchedule[stop_id];

  if(!Array.isArray(updates) || updates.length === 0){
    console.log(`No live updates for stop ${stop_id}`);
    return null; // No live updates available
  }

  const now = Date.now() / 1000;
  const upcoming = updates
    .filter(entry => entry.arrival >= now) // Only future arrivals
    .sort((a, b) => a.arrival - b.arrival) // Sort by arrival time
    .slice(0, 2); // Get the next 2 arrivals

  if(upcoming.length === 0){
    console.log(`No upcoming live arrivals for stop ${stop_id}`);
    return null; // No upcoming arrivals
  }

  return upcoming.map(entry => {
    const arrivalTime = convertEpochToStandardTime(entry.arrival);
    return `${arrivalTime} → Route ${entry.route_id}`;
  }).join('<br>');
}


function getStaticNextArrivals(stop_id) {
  console.log(`--- Checking static arrivals for stop ${stop_id} ---`);
  
  const staticUpdates = staticStopSchedule[stop_id];

  if (!staticUpdates) {
    console.log(`Stop ${stop_id} not found in staticStopSchedule`);
    // List some available stop IDs for comparison
    const availableStops = Object.keys(staticStopSchedule).slice(0, 10);
    console.log("Sample available stop IDs:", availableStops);
    return "No schedule data available for this stop.";
  }

  if (!Array.isArray(staticUpdates)) {
    console.log(`Stop ${stop_id} data is not an array:`, typeof staticUpdates);
    return "Invalid schedule data format.";
  }

  if (staticUpdates.length === 0) {
    console.log(`Stop ${stop_id} has empty schedule array`);
    return "No schedule entries for this stop.";
  }

  console.log(`Found ${staticUpdates.length} static schedule entries for stop ${stop_id}`);
  console.log("Sample entries:", staticUpdates.slice(0, 3));

  const now = new Date();
  const currentServiceId = getServiceIdForDate(now);
  const nowSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  console.log(`Current service ID: ${currentServiceId}, Current time in seconds: ${nowSeconds}`);

  // Get all unique service IDs for this stop
  const availableServiceIds = [...new Set(staticUpdates.map(entry => entry.service_id))];
  console.log(`Available service IDs for stop ${stop_id}:`, availableServiceIds);

  // Filter by current service ID
  const relevantSchedule = staticUpdates.filter(entry => {
    return entry.service_id === currentServiceId;
  });

  console.log(`Found ${relevantSchedule.length} entries for current service ID: ${currentServiceId}`);

  if(relevantSchedule.length === 0){
    console.log(`No service for ${currentServiceId}, looking for next available service`);
    return getNextAvailableService(stop_id, now);
  }

  const upcoming = relevantSchedule
    .map(entry => ({
      ...entry,
      seconds: parseTimeToSeconds(entry.arrival_time)
    }))
    .filter(entry => entry.seconds >= nowSeconds) // Only future arrivals
    .sort((a, b) => a.seconds - b.seconds) // Sort by arrival time
    .slice(0, 2); // Get the next 2 arrivals

  if(upcoming.length === 0){
    console.log(`No upcoming arrivals today for stop ${stop_id}, checking next available service`);
    return getNextAvailableService(stop_id, now);
  }

  const result = upcoming.map(entry => {
    const arrivalTime = convertTimeToStandard(entry.arrival_time);
    return `${arrivalTime} → Route ${entry.route_id}`;
  }).join('<br>');

  console.log(`Returning result for stop ${stop_id}:`, result);
  return result;
}


function getNextDayArrivals(stop_id) {
  const staticUpdates = staticStopSchedule[stop_id];

  if(!Array.isArray(staticUpdates) || staticUpdates.length === 0){
    return "No service available for next day.";
  }

  // Try up to 7 days ahead to find next service
  for (let daysAhead = 1; daysAhead <= 7; daysAhead++) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    const futureServiceId = getServiceIdForDate(futureDate);
    const dayName = getDayName(futureDate.getDay());

    // Get earliest arrival for this future day
    const futureSchedule = staticUpdates
      .filter(entry => entry.service_id === futureServiceId)
      .map(entry => ({
        ...entry,
        seconds: parseTimeToSeconds(entry.arrival_time)
      }))
      .sort((a, b) => a.seconds - b.seconds)
      .slice(0, 2); // Get the first two

    if (futureSchedule.length > 0) {
      const nextArrival = futureSchedule[0];
      const arrivalTime = convertTimeToStandard(nextArrival.arrival_time);
      
      if (daysAhead === 1) {
        return `Next Arrival: Tomorrow at ${arrivalTime} → Route ${nextArrival.route_id}`;
      } else {
        return `Next Arrival: ${dayName} at ${arrivalTime} → Route ${nextArrival.route_id}`;
      }
    }
  }

  return "No service available in the next week.";
}


function getNextAvailableService(stop_id, currentDate = new Date()) {
  const staticUpdates = staticStopSchedule[stop_id];

  if(!Array.isArray(staticUpdates) || staticUpdates.length === 0){
    return "No schedule data available for this stop.";
  }

  // Get all unique service IDs for this stop
  const availableServiceIds = [...new Set(staticUpdates.map(entry => entry.service_id))];
  console.log(`Available service IDs for stop ${stop_id}:`, availableServiceIds);

  // Collect all upcoming arrivals across multiple days
  let allUpcomingArrivals = [];

  // Try up to 14 days ahead to find next service
  for (let daysAhead = 0; daysAhead <= 14; daysAhead++) {
    const checkDate = new Date(currentDate);
    checkDate.setDate(checkDate.getDate() + daysAhead);
    
    const serviceIdForDate = getServiceIdForDate(checkDate);
    console.log(`Day ${daysAhead}: ${getDayName(checkDate.getDay())}, Service ID: ${serviceIdForDate}`);
    
    // For current day, only check remaining time
    const checkSeconds = daysAhead === 0 ? 
      (currentDate.getHours() * 3600 + currentDate.getMinutes() * 60 + currentDate.getSeconds()) : 
      0; // Start of day for future days

    // Get schedule for this service ID
    const daySchedule = staticUpdates
      .filter(entry => entry.service_id === serviceIdForDate)
      .map(entry => ({
        ...entry,
        seconds: parseTimeToSeconds(entry.arrival_time),
        daysAhead: daysAhead,
        checkDate: new Date(checkDate),
        displayDay: daysAhead === 0 ? "Today" : 
                   daysAhead === 1 ? "Tomorrow" : 
                   getDayName(checkDate.getDay())
      }))
      .filter(entry => entry.seconds >= checkSeconds) // Only future arrivals
      .sort((a, b) => a.seconds - b.seconds);

    // Add all arrivals from this day to our collection
    allUpcomingArrivals.push(...daySchedule);

    // If we have at least 2 arrivals, we can stop searching
    if (allUpcomingArrivals.length >= 2) {
      break;
    }
  }

  // Sort all arrivals by day first, then by time
  allUpcomingArrivals.sort((a, b) => {
    if (a.daysAhead !== b.daysAhead) {
      return a.daysAhead - b.daysAhead;
    }
    return a.seconds - b.seconds;
  });

  // Take the first 2 arrivals
  const nextTwoArrivals = allUpcomingArrivals.slice(0, 2);

  if (nextTwoArrivals.length === 0) {
    return `No service in next 2 weeks. Available service types: ${availableServiceIds.join(', ')}`;
  }

  // Format the results
  const formattedArrivals = nextTwoArrivals.map(entry => {
    const arrivalTime = convertTimeToStandard(entry.arrival_time);
    
    if (entry.daysAhead === 0) {
      return `${arrivalTime} → Route ${entry.route_id}`;
    } else {
      return `${entry.displayDay} at ${arrivalTime} → Route ${entry.route_id}`;
    }
  });

  return formattedArrivals.join('<br>');
}


function getDayName(dayNumber) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayNumber];
}


// Helper to get service ID based on date
function getServiceIdForDate(date) {
  const hour = date.getHours();
  const day = date.getDay(); // 0=Sunday, 6=Saturday

  // Handle overnight service (after midnight but before 5 AM)
  if (hour < 5) {
    return "Overnight";
  }

  // Weekend service
  if (day === 0 || day === 6) {
    return "SatSun";
  }
  
  // Weekday service
  return "Weekday";
}


// Helper to parse "HH:MM:SS" time format to seconds
function parseTimeToSeconds(timeStr) {
  try {
    const parts = timeStr.split(':');
    const h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    const s = parseInt(parts[2]) || 0;
    return h * 3600 + m * 60 + s;
  } catch (error) {
    console.error(`Error parsing time: ${timeStr}`, error);
    return 0;
  }
}


// Helper to convert "HH:MM" time format to AM/PM format
function convertTimeToStandard(timeStr) {
  try {
    const parts = timeStr.split(':');
    const h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const adjustedHours = h % 12 || 12;
    return `${adjustedHours}:${m.toString().padStart(2, '0')} ${ampm}`;
  } catch (error) {
    console.error(`Error converting time: ${timeStr}`, error);
    return timeStr;
  }
}


//Helper to convert epoch seconds to AM/PM format
function convertEpochToStandardTime(epochSeconds) {
  try {
    const date = new Date(epochSeconds * 1000);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const adjustedHours = hours % 12 || 12;

    return `${adjustedHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  } catch (error) {
    console.error(`Error converting epoch time: ${epochSeconds}`, error);
    return 'Invalid time';
  }
}


(async () => {
  console.log("=== Starting application initialization ===");
  
  try {
    // Load route data first
    await loadRouteData();
    console.log("Route data loaded");
    
    // Load routes
    loadRoutes();
    console.log("Routes loaded");
    
    // Load schedule data before loading stops
    console.log("Loading schedule data...");
    const [staticRes, liveRes] = await Promise.all([
      fetch('/static/stop_schedule.json'),
      fetch('/static/trip_updates_by_stop.json')
    ]);
    
    staticStopSchedule = await staticRes.json();
    stopSchedule = await liveRes.json();
    
    console.log("Schedule data loaded:", {
      staticStops: Object.keys(staticStopSchedule).length,
      liveStops: Object.keys(stopSchedule).length
    });
    
    // Now load stops
    await loadStops();
    console.log("Stops loaded");
    
    // Start bus tracking
    fetchBusData();
    setInterval(fetchBusData, fetchInterval);
    animate();
    getUserLocation();
    
    console.log("=== Application initialization complete ===");
  } catch (error) {
    console.error("Error during initialization:", error);
  }
})();