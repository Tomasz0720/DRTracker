import * as nextArrivals from "./nextArrivals.js";
import * as busTracking from "./busTracking.js";
import * as userLocation from "./userLocation.js";
import * as mapModule from "./map.js";
import * as routesAndStops from "./routesAndStops.js";

(async () => {
    console.log("=== Starting application initialization ===");

    try {
        // Load route data
        await routesAndStops.loadRouteData();
        console.log("Route data loaded");

		const routeSelect = document.getElementById('route-select');

		// Add Show All option first
		const showAllOption = document.createElement('option');
		showAllOption.value = "__SHOW_ALL__";
		showAllOption.text = "Show All";
		routeSelect.appendChild(showAllOption);

		// Add each route only once
		routesAndStops.routeList.forEach(route => {
			const option = document.createElement('option');
			option.value = route.id;
			option.text = `Route ${route.id}`;
			routeSelect.appendChild(option);
		});

		$(routeSelect).select2({
			placeholder: "Select routes...",
			allowClear: true
		});

		$(routeSelect).on('change', function() {
			let selectedRouteIds = $(this).val();
			if (selectedRouteIds && selectedRouteIds.includes("__SHOW_ALL__")) {
				selectedRouteIds = routesAndStops.routeList.map(route => route.id);
				$(routeSelect).val(selectedRouteIds).trigger('change.select2');
			}
			routesAndStops.showRoutes(selectedRouteIds || []);
		});



        // Load routes
        await routesAndStops.loadRoutes();
        console.log("Routes loaded");

        // Load schedule data before loading stops
        console.log("Loading schedule data...");
        const [staticRes, liveRes] = await Promise.all([
			fetch('/static/stop_schedule.json'),
			fetch('/static/trip_updates_by_stop.json')
		]);

        routesAndStops.setStaticStopSchedule(await staticRes.json());
		routesAndStops.setStopSchedule(await liveRes.json());

        console.log("Schedule data loaded:", {
            staticStops: Object.keys(routesAndStops.staticStopSchedule).length,
            liveStops: Object.keys(routesAndStops.stopSchedule).length
        });

		// Load stops by route
		await routesAndStops.loadStopsByRoute();

        // Now load stops
        await routesAndStops.loadStops();
        console.log("Stops loaded");

        // Start bus tracking
        busTracking.fetchBusData();
        setInterval(busTracking.fetchBusData, busTracking.fetchInterval);
        busTracking.animate();

		// Initialize map
		routesAndStops.showRoutes([]);
        userLocation.getUserLocation();

        console.log("=== Application initialization complete ===");
    } catch (error) {
        console.error("Error during initialization:", error);
    }
})();