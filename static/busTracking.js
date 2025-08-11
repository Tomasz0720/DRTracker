// busTracking.js
// Fetch and display live bus data on the map

import { map } from "./map.js";

// Track bus data
export const buses = {};
export const fetchInterval = 5000; //5 seconds

// Get live bus data
export async function fetchBusData() {
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
				// Create marker for new bus
				const busIcon = L.icon({
					iconUrl: '/static/icons/bus-icon.svg',
					iconSize: [32, 32],
					iconAnchor: [16, 16],
					popupAnchor: [0, -16]
				});
				const marker = L.marker([lat, lon], {
                    icon: busIcon,
                    route_id: bus.route_id
                }).bindPopup(`Route ${bus.route_id}`);

				buses[id] = {
					marker,
					route_id: bus.route_id,
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

		// Remove buses that are no longer seen
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

// Animate markers between prevPos and nextPos
export function animate() {
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