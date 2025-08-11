// userLocation.js
// User location tracking and map integration

import { getNextArrivals } from "./nextArrivals.js";
import { map } from "./map.js";
import { routeList, routeColorMap } from "./routesAndStops.js";

// Initialize user location marker and watch ID
let userLocationMarker = null;
let watchId = null;

// Get user's current location and start tracking
export const getUserLocation = () => {
	if (navigator.geolocation) {
		navigator.geolocation.getCurrentPosition((position) => {
			let lat = position.coords.latitude;
			let lon = position.coords.longitude;

			map.setView([lat, lon], 14);

			if (userLocationMarker) {
				map.removeLayer(userLocationMarker);
			}

			const userIcon = L.icon({
                iconUrl: '/static/icons/user-icon.svg',
                iconSize: [32, 32],
                iconAnchor: [16, 16],
                popupAnchor: [0, -16]
            });

            userLocationMarker = L.marker([lat, lon], { icon: userIcon })
                .addTo(map)
                .bindPopup('Your Location');

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
	else {
		alert("Geolocation is not supported by this browser.")
	}
}

//Stop tracking user location
export const stopLocationTracking = () => {
	if (watchId !== null) {
		navigator.geolocation.clearWatch(watchId);
		watchId = null;
	}
	if (userLocationMarker) {
		map.removeLayer(userLocationMarker);
		userLocationMarker = null;
	}
}