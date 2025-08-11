// map.js
// Map initialization and user location tracking

export const map = L.map('map').setView([43.7, -79.4], 12); // Default view, will be updated to user's location

//Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
	attribution: '© OpenStreetMap contributors'
}).addTo(map);