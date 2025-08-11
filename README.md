# DRTracker

<img src="assets/DRTrackerBlack.png#gh-light-mode-only" alt="Light mode logo" width="450">
<img src="assets/DRTrackerWhite.png#gh-dark-mode-only" alt="Dark mode logo" width="450">

## About

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Last Commit](https://img.shields.io/github/last-commit/Tomasz0720/DRTracker)
![Issues](https://img.shields.io/github/issues/Tomasz0720/DRTracker)
![Python](https://img.shields.io/badge/Python-3.12.8-blue)
![Flask](https://img.shields.io/badge/Flask-3.1.1-cyan)
![Leaflet](https://img.shields.io/badge/Leaflet.js-map-green)

### Description
DRTracker is a site that uses Durham Region Transit's live vehicle location feed to track buses in real time.


### How to Run
1. Clone the repository by selecting the green **code** button in GitHub, and copying the repository link.

2. Open a terminal and clone this repository to your local machine using the command:<br>
   ```bash
   git clone https://github.com/Tomasz0720/DRTracker.git

3. Navigate to the project folder and open it in your preferred IDE that supports Python.

4. Open a terminal and install prerequisites using
   ```bash
   pip install -r requirements.txt

6. Run `server.py`

7. Go to `http://127.0.0.1:5000/` in your browser to view a map with real-time bus locations, stops, and routes.

## Demo Screenshots

| ![](/assets/blank_map.png) | ![](/assets/route_selector.png) |
|----------------------------|---------------------------------|
| *User view before a route(s) is selected.* | *Route selector multi-select dropdown.* |

| ![](/assets/route_900.png) | ![](/assets/next_bus_900.png) |
|----------------------------|------------------------------|
| *Map with DRT Route 900 visible.* | *DRT Route 900 stop with next bus bubble.* |

| ![](/assets/routes_405_900_905.png) | ![](/assets/next_bus_405.png) |
|-------------------------------------|-------------------------------|
| *DRT Routes 405, 900, and 905 visible.* | *DRT Route 405 stop with next bus bubble.* |

## Future Features
- [x] Improved GeoJSON map data
- [x] Click on a stop for additional information (stop number, stop name, next bus arrival)
- [x] Search for a route
- [x] Select which route(s) to display
- [ ] Buses don't slide all over the map; they stick to their route
- [ ] Improve page design
