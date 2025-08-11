// routesAndStops.js
// Route and stop data management

import { getNextArrivals } from "./nextArrivals.js";
import { map } from "./map.js";
import { buses } from "./busTracking.js";

// Load route data from JSON file
export async function loadRouteData() {
	const jsonRes = await fetch('/static/routes.json');
	routeList = await jsonRes.json();
	routeColorMap = {};
	routeList.forEach(route => {
		routeColorMap[route.id] = route.color;
	});
}

// Load routes from JSON files
export async function loadRoutes() {
	try {
		const geoRes = await fetch('/static/routes.geojson');
		const geoData = await geoRes.json();

		geoData.features.forEach(feature => {
            const routeId = String(feature.properties.route_id);
            const layer = L.geoJSON(feature, {
                style: {
                    color: routeColorMap[routeId] || 'red',
                    weight: 3
                }
            }).bindPopup(`Route ${routeId}`);
            routeLayers[routeId] = layer;
        });
	} catch (err) {
		console.error("Failed to load route lines:", err);
	}
}

export async function loadStops() {
	try {
		// Load both schedule files with error handling
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

                const routeId = String(feature.properties.route_id || "");
                if(!stopLayersByRoute[routeId]) stopLayersByRoute[routeId] = [];
                stopLayersByRoute[routeId].push(layer);

				const stopId = feature.properties.stop_id || "Unknown";
				const stopName = feature.properties.stop_name || "Unnamed Stop";

                stopLayersById[stopId] = layer;

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
		});
	} catch (err) {
		console.error("Failed to load stops or schedule:", err);
	}
}

export let routeColorMap = {}; // Initialize empty object for route colors
export let routeList = []; // Initialize empty array for routes
export let stopSchedule = {}; // Initialize empty object for live stop schedule
export let staticStopSchedule = {}; // Initialize empty object for static schedule
export let routeLayers = {}; // Initialize empty object for route layers
export let stopLayersByRoute = {}; // Initialize empty object for stop layers by route
export let stopsByRoute = {}; // Initialize empty object for stops by route
export let stopLayersById = {}; // Initialize empty object for stop layers by ID

export function setStaticStopSchedule(data) {
    staticStopSchedule = data;
}


export function setStopSchedule(data) {
    stopSchedule = data;
}


//Load bus schedule data
export async function loadBusSchedule() {
	try {
		const res = await fetch('/static/trip_updates_by_stop.json');
		stopSchedule = await res.json();
		console.log("Stop schedule loaded:", stopSchedule);
	} catch (err) {
		console.error("Failed to load bus schedule data:", err);
	}
}


export async function loadStopsByRoute(){
    const res = await fetch('/static/stops_by_route.json');
    stopsByRoute = await res.json();
    console.log("Stops by route loaded:", stopsByRoute);
}


export function showRoutes(selectedRouteIds){
    // Hide all route layers
    Object.values(routeLayers).forEach(layer => map.removeLayer(layer));

    // Hide all stop layers
    Object.values(stopLayersById).forEach(layer => map.removeLayer(layer));

    // Hide all buses
    Object.values(buses).forEach(busObj => map.removeLayer(busObj.marker));

        // Show selected routes and their stops
    selectedRouteIds.forEach(routeId => {
        if(routeLayers[routeId]){
            routeLayers[routeId].addTo(map);
        }
        if(stopsByRoute[routeId]){
            const stopColor = routeColorMap[routeId] || 'blue';
            stopsByRoute[routeId].forEach(stopId => {
                const layer = stopLayersById[stopId];
                if(layer){
                    // Set color for the outer circle in the featureGroup
                    const outerCircle = layer.getLayers()[0];
					if(outerCircle instanceof L.CircleMarker){
						outerCircle.setStyle({
							color: stopColor,
							fillColor: stopColor
						});
					}
					layer.addTo(map);
                }
            });
        }
    });

    // Show buses on selected routes
    Object.values(buses).forEach(busObj => {
        if (selectedRouteIds.includes(String(busObj.route_id))) {
            busObj.marker.addTo(map);
        }
    });
}


export function showStops(selectedStopIds){
    Object.values(routeLayers).forEach(layer => map.removeLayer(layer));

    selectedStopIds.forEach(stopId => {
        if(routeLayers[stopId]){
            routeLayers[stopId].addTo(map);
        }
    });
}