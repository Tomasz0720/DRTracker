// nextArrivals.js
// This file contains functions to get the next bus arrivals for a given stop

import { stopSchedule } from "./routesAndStops.js";
import { staticStopSchedule } from "./routesAndStops.js";

export function getNextArrivals(stop_id) {
	console.log(`=== Getting next arrivals for stop ${stop_id} ===`);

	// Check if schedule data is loaded
	if (Object.keys(staticStopSchedule).length === 0) {
		console.warn("Static schedule not loaded yet!");
		return "Schedule data still loading...";
	}

	// Check for live arrivals
	const liveArrivals = getLiveNextArrivals(stop_id);
	if (liveArrivals) {
		console.log(`Found live arrivals for stop ${stop_id}`);
		return liveArrivals;
	}

	// Fall back on static schedule if no live arrivals
	const staticArrivals = getStaticNextArrivals(stop_id);
	console.log(`Static arrivals result for stop ${stop_id}:`, staticArrivals);
	return staticArrivals || "No upcoming buses.";
}


export function getLiveNextArrivals(stop_id) {
	const updates = stopSchedule[stop_id];

	if (!Array.isArray(updates) || updates.length === 0) {
		console.log(`No live updates for stop ${stop_id}`);
		return null; // No live updates available
	}

	const now = Date.now() / 1000;
	const upcoming = updates
		.filter(entry => entry.arrival >= now) // Only future arrivals
		.sort((a, b) => a.arrival - b.arrival) // Sort by arrival time
		.slice(0, 2); // Get the next 2 arrivals

	if (upcoming.length === 0) {
		console.log(`No upcoming live arrivals for stop ${stop_id}`);
		return null; // No upcoming arrivals
	}

	return upcoming.map(entry => {
		const arrivalTime = convertEpochToStandardTime(entry.arrival);
		return `${arrivalTime} → Route ${entry.route_id}`;
	}).join('<br>');
}


export function getStaticNextArrivals(stop_id) {
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

	if (relevantSchedule.length === 0) {
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

	if (upcoming.length === 0) {
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


export function getNextDayArrivals(stop_id) {
	const staticUpdates = staticStopSchedule[stop_id];

	if (!Array.isArray(staticUpdates) || staticUpdates.length === 0) {
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


export function getNextAvailableService(stop_id, currentDate = new Date()) {
	const staticUpdates = staticStopSchedule[stop_id];

	if (!Array.isArray(staticUpdates) || staticUpdates.length === 0) {
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


// Helper to get day name from day number
export function getDayName(dayNumber) {
	const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	return days[dayNumber];
}


// Helper to get service ID based on date
export function getServiceIdForDate(date) {
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
export function parseTimeToSeconds(timeStr) {
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
export function convertEpochToStandardTime(epochSeconds) {
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