document.addEventListener('DOMContentLoaded', function () {
    const map = L.map('map', { zoomControl: false }).setView([55.751244, 37.618423], 10); // Default to Moscow
    map.createPane('routeHoverPane');
    map.getPane('routeHoverPane').style.zIndex = 650;
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Add distance measurement functionality
    const measureDistanceBtn = document.getElementById('measure-distance-btn');
    
    // Initialize custom measurement functionality
    let isMeasuring = false;
    let measurementPoints = [];
    let measurementMarkers = [];
    let measurementPolyline = null;
    let measurementPopup = null;
    
    // Function to calculate distance between two points
    function calculateDistance(point1, point2) {
        return point1.distanceTo(point2) / 1000; // Convert to kilometers
    }
    
    // Function to update measurement display
    function updateMeasurementDisplay() {
        if (measurementPoints.length < 2) return;
        
        let totalDistance = 0;
        let segmentDistance = 0; // Distance between last and previous point
        
        for (let i = 1; i < measurementPoints.length; i++) {
            const segment = calculateDistance(measurementPoints[i-1], measurementPoints[i]);
            totalDistance += segment;
            
            // If this is the last segment, save it as segmentDistance
            if (i === measurementPoints.length - 1) {
                segmentDistance = segment;
            }
        }
        
        // Update existing polyline if it exists
        if (measurementPolyline) {
            measurementPolyline.remove();
        }
        
        // Add polyline to show the measured path
        measurementPolyline = L.polyline(measurementPoints, {
            color: 'red',
            weight: 3,
            opacity: 0.7
        }).addTo(map);
        
        // Update popup with distance information
        if (measurementPopup) {
            measurementPopup.remove();
        }
        
        const lastPoint = measurementPoints[measurementPoints.length - 1];
        
        // Create content with both segment distance and total distance
        let content = '';
        if (measurementPoints.length >= 2) {
            content += `${segmentDistance.toFixed(2)} км<br>`; // Distance between last and previous point
        }
        content += `Всего: ${totalDistance.toFixed(2)} км`; // Total distance
        
        measurementPopup = L.popup()
            .setLatLng(lastPoint)
            .setContent(content)
            .openOn(map);
    }
    
    // Function to handle map clicks during measurement
    function onMapClick(e) {
        measurementPoints.push(e.latlng);
        
        // Mark the point on the map
        const marker = L.circleMarker(e.latlng, {
            radius: 5,
            color: 'red',
            fillColor: 'red',
            fillOpacity: 0.8
        }).addTo(map);
        
        measurementMarkers.push(marker);
        
        updateMeasurementDisplay();
    }
    
    measureDistanceBtn.addEventListener('click', function() {
        console.log('Measure button clicked, current isMeasuring state:', isMeasuring);
        
        if (!isMeasuring) {
            // Start measuring
            isMeasuring = true;
            measureDistanceBtn.classList.add('active');
            measureDistanceBtn.textContent = 'Остановить измерение';
            console.log('Started measuring, button text changed to: Остановить измерение');
            
            // Clear previous measurements if any
            measurementPoints = [];
            measurementMarkers.forEach(marker => marker.remove());
            measurementMarkers = [];
            
            if (measurementPolyline) {
                measurementPolyline.remove();
                measurementPolyline = null;
            }
            if (measurementPopup) {
                map.closePopup(measurementPopup);
                measurementPopup = null;
            }
            
            // Add click event to map
            map.on('click', onMapClick);
        } else {
            // Stop measuring
            isMeasuring = false;
            measureDistanceBtn.classList.remove('active');
            measureDistanceBtn.textContent = 'Измерить расстояние';
            console.log('Stopped measuring, button text changed to: Измерить расстояние');
            
            // Remove click event from map
            map.off('click', onMapClick);
            
            // Clear all measurement elements
            measurementPoints = [];
            measurementMarkers.forEach(marker => marker.remove());
            measurementMarkers = [];
            
            if (measurementPolyline) {
                measurementPolyline.remove();
                measurementPolyline = null;
            }
            if (measurementPopup) {
                map.closePopup(measurementPopup);
                measurementPopup = null;
            }
        }
    });

    // Function to create tile layer
    const createTileLayer = (type) => {
        const layers = {
            opentopomap: () => L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
            }),
            monochrome: () => L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles &copy; Esri &mdash; Source: Esri',
                maxZoom: 13
            }),
            esriworldimagery: () => L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            }),
            thunderforestlandscape: () => L.tileLayer('https://{s}.tile.thunderforest.com/landscape/{z}/{x}/{y}.png?apikey=86dc7e1b09ba4c8d8d295be536865e6b', {
                attribution: '&copy; <a href="http://www.thunderforest.com/">Thunderforest</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 22
            }),
            openstreetmap: () => L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }),
            cyclosm: () => L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
                maxZoom: 20,
                attribution: '<a href="https://github.com/cyclosm/cyclosm-cartocss-style/releases" title="CyclOSM - Open Bicycle render">CyclOSM</a> | Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }),
            cartovoyager: () => L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 20
            }),
            esriocean: () => L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles &copy; Esri &mdash; Sources: GEBCO, NOAA, CHS, OSU, UNH, CSUMB, National Geographic, DeLorme, NAVTEQ, and Esri',
                maxNativeZoom: 13,
                maxZoom: 20
            }),
            nasanight: () => L.tileLayer('https://map1.vis.earthdata.nasa.gov/wmts-webmerc/VIIRS_CityLights_2012/default/{time}/{tilematrixset}{maxZoom}/{z}/{y}/{x}.{format}', {
                attribution: 'Imagery provided by services from the Global Imagery Browse Services (GIBS), operated by the NASA/GSFC/Earth Science Data and Information System (<a href="https://earthdata.nasa.gov">ESDIS</a>) with funding provided by NASA/HQ.',
                bounds: [[-85.0511287776, -179.999999975], [85.0511287776, 179.999999975]],
                minZoom: 1,
                maxZoom: 8,
                format: 'jpg',
                time: '',
                tilematrixset: 'GoogleMapsCompatible_Level'
            }),
            jawgdark: () => L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 20
            }),
        };
        return layers[type] ? layers[type]() : layers.opentopomap();
    };

    // Create custom panes for layer control
    map.createPane('basePane');
    map.getPane('basePane').style.zIndex = 200;
    
    map.createPane('roadsPane');
    map.getPane('roadsPane').style.zIndex = 250;
    
    map.createPane('overlayPane');
    map.getPane('overlayPane').style.zIndex = 300;

    let baseLayer = createTileLayer('opentopomap');
    baseLayer.options.pane = 'basePane';
    baseLayer.addTo(map);
    
    let roadsLayer = null;
    let overlayLayer = null;

    const hamburgerMenu = document.getElementById('hamburger-menu');
    const sideMenu = document.getElementById('side-menu');
    const closeMenuBtn = document.getElementById('close-menu-btn');

    function closeMenu() {
        sideMenu.classList.remove('open');
        hamburgerMenu.classList.remove('hidden');
    }

    hamburgerMenu.addEventListener('click', function (e) {
        e.stopPropagation(); // Prevent click from bubbling to the map
        sideMenu.classList.toggle('open');
        hamburgerMenu.classList.toggle('hidden');
    });

    closeMenuBtn.addEventListener('click', closeMenu);
    map.on('click', closeMenu);

    // Brightness control for base layer
    const brightnessSlider = document.getElementById('brightness-slider');
    brightnessSlider.addEventListener('input', function (e) {
        map.getPane('basePane').style.opacity = e.target.value / 100;
    });

    // Overlay controls
    const enableOverlayCheckbox = document.getElementById('enable-overlay-map');
    const overlayControls = document.getElementById('overlay-map-controls');
    const overlayOpacitySlider = document.getElementById('overlay-opacity-slider');

    // Load saved settings
    const lastBaseMapType = localStorage.getItem('baseMapType') || 'opentopomap';
    const lastOverlayMapType = localStorage.getItem('overlayMapType') || 'opentopomap';
    const lastOverlayEnabled = localStorage.getItem('overlayEnabled') === 'true';
    const lastOverlayOpacity = parseInt(localStorage.getItem('overlayOpacity') || '50');
    const lastRoadsEnabled = localStorage.getItem('roadsEnabled') === 'true';
    const lastRoadsOpacity = parseInt(localStorage.getItem('roadsOpacity') || '100');
    const lastZoomLevel = localStorage.getItem('mapZoomLevel');
    const lastBaseBrightness = parseInt(localStorage.getItem('baseBrightness') || '100');

    // Apply saved base map
    if (lastBaseMapType !== 'opentopomap') {
        map.removeLayer(baseLayer);
        baseLayer = createTileLayer(lastBaseMapType);
        baseLayer.options.pane = 'basePane';
        baseLayer.addTo(map);
    }
    
    // Check the corresponding base map radio button
    const selectedBaseRadio = document.querySelector(`input[name="base-map-type"][value="${lastBaseMapType}"]`);
    if (selectedBaseRadio) {
        selectedBaseRadio.checked = true;
    }

    // Apply saved base brightness
    brightnessSlider.value = lastBaseBrightness;
    map.getPane('basePane').style.opacity = lastBaseBrightness / 100;

    // Apply saved roads layer settings
    const enableRoadsCheckbox = document.getElementById('enable-roads-layer');
    const roadsControls = document.getElementById('roads-layer-controls');
    const roadsOpacitySlider = document.getElementById('roads-opacity-slider');
    
    if (lastRoadsEnabled) {
        enableRoadsCheckbox.checked = true;
        roadsControls.style.display = 'block';
        
        roadsLayer = L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Map style: &copy; <a href="https://www.OpenRailwayMap.org">OpenRailwayMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
            pane: 'roadsPane'
        });
        roadsLayer.setOpacity(lastRoadsOpacity / 100);
        roadsLayer.addTo(map);
        
        roadsOpacitySlider.value = lastRoadsOpacity;
    }

    // Apply saved overlay settings
    if (lastOverlayEnabled) {
        enableOverlayCheckbox.checked = true;
        overlayControls.style.display = 'block';
        
        overlayLayer = createTileLayer(lastOverlayMapType);
        overlayLayer.options.pane = 'overlayPane';
        overlayLayer.setOpacity(lastOverlayOpacity / 100);
        overlayLayer.addTo(map);
        
        const selectedOverlayRadio = document.querySelector(`input[name="overlay-map-type"][value="${lastOverlayMapType}"]`);
        if (selectedOverlayRadio) {
            selectedOverlayRadio.checked = true;
        }
        
        overlayOpacitySlider.value = lastOverlayOpacity;
    }

    // Update map zoom if it was saved
    if (lastZoomLevel) {
        map.setZoom(parseInt(lastZoomLevel));
    }

    // Save zoom level
    const saveZoomLevel = () => {
        localStorage.setItem('mapZoomLevel', map.getZoom());
    };
    map.on('zoomend', saveZoomLevel);

    // Base map type change handler
    const baseMapTypeRadios = document.querySelectorAll('input[name="base-map-type"]');
    baseMapTypeRadios.forEach(radio => {
        radio.addEventListener('change', function (e) {
            map.removeLayer(baseLayer);
            baseLayer = createTileLayer(e.target.value);
            baseLayer.options.pane = 'basePane';
            baseLayer.addTo(map);
            
            // Reapply brightness
            map.getPane('basePane').style.opacity = brightnessSlider.value / 100;
            
            localStorage.setItem('baseMapType', e.target.value);
        });
    });

    // Overlay map type change handler
    const overlayMapTypeRadios = document.querySelectorAll('input[name="overlay-map-type"]');
    overlayMapTypeRadios.forEach(radio => {
        radio.addEventListener('change', function (e) {
            if (overlayLayer) {
                map.removeLayer(overlayLayer);
            }
            
            overlayLayer = createTileLayer(e.target.value);
            overlayLayer.options.pane = 'overlayPane';
            overlayLayer.setOpacity(overlayOpacitySlider.value / 100);
            overlayLayer.addTo(map);
            
            localStorage.setItem('overlayMapType', e.target.value);
        });
    });

    // Enable/disable overlay map
    enableOverlayCheckbox.addEventListener('change', function (e) {
        if (e.target.checked) {
            overlayControls.style.display = 'block';
            
            const selectedOverlayType = document.querySelector('input[name="overlay-map-type"]:checked').value;
            overlayLayer = createTileLayer(selectedOverlayType);
            overlayLayer.options.pane = 'overlayPane';
            overlayLayer.setOpacity(overlayOpacitySlider.value / 100);
            overlayLayer.addTo(map);
            
            localStorage.setItem('overlayEnabled', 'true');
        } else {
            overlayControls.style.display = 'none';
            
            if (overlayLayer) {
                map.removeLayer(overlayLayer);
                overlayLayer = null;
            }
            
            localStorage.setItem('overlayEnabled', 'false');
        }
    });

    // Overlay opacity control
    overlayOpacitySlider.addEventListener('input', function (e) {
        if (overlayLayer) {
            overlayLayer.setOpacity(e.target.value / 100);
            localStorage.setItem('overlayOpacity', e.target.value);
        }
    });

    // Enable/disable roads layer
    enableRoadsCheckbox.addEventListener('change', function (e) {
        if (e.target.checked) {
            roadsControls.style.display = 'block';
            
            roadsLayer = L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Map style: &copy; <a href="https://www.OpenRailwayMap.org">OpenRailwayMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
                pane: 'roadsPane'
            });
            roadsLayer.setOpacity(roadsOpacitySlider.value / 100);
            roadsLayer.addTo(map);
            
            localStorage.setItem('roadsEnabled', 'true');
        } else {
            roadsControls.style.display = 'none';
            
            if (roadsLayer) {
                map.removeLayer(roadsLayer);
                roadsLayer = null;
            }
            
            localStorage.setItem('roadsEnabled', 'false');
        }
    });

    // Roads opacity control
    roadsOpacitySlider.addEventListener('input', function (e) {
        if (roadsLayer) {
            roadsLayer.setOpacity(e.target.value / 100);
            localStorage.setItem('roadsOpacity', e.target.value);
        }
    });

    // Save base brightness
    brightnessSlider.addEventListener('change', function (e) {
        localStorage.setItem('baseBrightness', e.target.value);
    });

    // --- Geolocation Logic ---
    const geoErrorModal = document.getElementById('geo-error-modal');
    const geoErrorCancelBtn = document.getElementById('geo-error-cancel');
    const geoErrorDontShowCheckbox = document.getElementById('geo-error-dont-show');

    function locateUser() {
        map.locate({ setView: true, maxZoom: 16 });
    }

    function onLocationFound(e) {
        const radius = e.accuracy / 2;

        const userIcon = L.divIcon({
            className: 'user-location-marker',
            html: '<div class="pulse"></div>',
            iconSize: [14, 14]
        });

        L.marker(e.latlng, { icon: userIcon }).addTo(map);
    }

    function onLocationError(e) {
        if (localStorage.getItem('hideGeoError') !== 'true') {
            geoErrorModal.classList.remove('hidden');
        }
    }

    geoErrorCancelBtn.addEventListener('click', () => {
        geoErrorModal.classList.add('hidden');
    });

    geoErrorDontShowCheckbox.addEventListener('change', (e) => {
        localStorage.setItem('hideGeoError', e.target.checked);
    });

    map.on('locationfound', onLocationFound);
    map.on('locationerror', onLocationError);

    // Initial call to locate user
    if (localStorage.getItem('hideGeoError') !== 'true') {
        locateUser();
    }



    try {
        let tg = window.Telegram.WebApp;
        tg.ready();
    } catch (e) {
        console.error("Telegram WebApp is not available.", e);
    }
    

    
    // Route building functionality
    let routePoints = [];
    let routePolyline = null;
    let routeMarkers = [];
    let isBuildingRoute = false;
    let isCalculatingRoute = false;
    let routeHoverMarker = null; // Marker for map hover sync
    let currentRouteData = []; // To store data for export
    let currentSampleStep = 50; // Default step in meters
    
    // Get DOM elements
    const buildRouteBtn = document.getElementById('build-route-btn');
    const calculateRouteBtn = document.getElementById('calculate-route-btn');
    const routeCalcControl = document.getElementById('route-calc-control');
    const elevationProfile = document.getElementById('elevation-profile');
    const profileContent = document.getElementById('profile-content');
    const finishRouteBtn = document.getElementById('finish-route-btn');
    const exportRouteBtn = document.getElementById('export-route-btn');
    const importRouteBtn = document.getElementById('import-route-btn');
    const csvImporter = document.getElementById('csv-importer');
    const stepButtons = document.querySelectorAll('.step-btn');
    
    // Function to calculate distance between two points in kilometers
    function calculateDistance(point1, point2) {
        // Convert meters to kilometers
        return point1.distanceTo(point2) / 1000;
    }
    
    // Handle step button clicks
    stepButtons.forEach(button => {
        button.addEventListener('click', async function() {
            // Remove active class from all buttons
            stepButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Update current sample step
            currentSampleStep = parseInt(this.getAttribute('data-step'));
            
            // Recalculate elevation profile if route exists
            if (routePoints.length >= 2) {
                await calculateRouteElevation();
            }
        });
    });
    
    function buildElevationProfile(elevationData) {
        const container = document.getElementById('profile-content');
        container.innerHTML = ''; // Clear previous chart

        const h3 = document.createElement('h3');
        h3.style.color = 'darkorange';
        h3.style.marginTop = '0';
        h3.style.marginBottom = '10px';
        h3.textContent = `Профиль высоты маршрута (шаг ${currentSampleStep}м, ${elevationData.length} точек)`;
        container.appendChild(h3);

        const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgNode.style.width = '100%';
        svgNode.style.height = 'calc(100% - 30px)';
        container.appendChild(svgNode);

        if (!routeHoverMarker) {
            routeHoverMarker = L.circleMarker([0, 0], {
                radius: 5,
                fillColor: '#32333d',
                color: 'darkorange',
                weight: 1,
                opacity: 0,
                fillOpacity: 0,
                interactive: false,
                pane: 'routeHoverPane' // Assign to the custom pane
            }).addTo(map);
        }
        
        const { width, height } = svgNode.getBoundingClientRect();

        const margin = { top: 20, right: 20, bottom: 30, left: 60 };
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;

        const elevations = elevationData.map(d => d.elevation);
        const minElev = Math.min(...elevations);
        const maxElev = Math.max(...elevations);
        const maxDist = Math.max(...elevationData.map(d => d.distance));

        const elevationRange = maxElev - minElev;
        let yScale;

        if (elevationRange === 0 || !isFinite(elevationRange)) {
            // Handle flat or invalid elevation profile: draw line in the middle.
            yScale = (elev) => margin.top + chartHeight / 2;
        } else {
            yScale = (elev) => margin.top + chartHeight - ((elev - minElev) / elevationRange) * chartHeight;
        }

        const xScale = (dist) => margin.left + (dist / maxDist) * chartWidth;
        
        let svgContent = '';

        svgContent += `<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="darkorange" stroke-width="1"/>`;
        svgContent += `<line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="darkorange" stroke-width="1"/>`;

        // Y-AXIS LABELS
        if (elevationRange === 0 || !isFinite(elevationRange)) {
            // For a flat line, show only one label in the middle.
            const singleElev = isFinite(minElev) ? minElev : 0;
            svgContent += `<text x="${margin.left - 10}" y="${margin.top + chartHeight / 2}" fill="darkorange" font-size="12" text-anchor="end" alignment-baseline="middle">${Math.round(singleElev)} м</text>`;
        } else {
            const yLabelCount = 10;
            for (let i = 0; i < yLabelCount; i++) {
                const elev = minElev + (i / (yLabelCount - 1)) * elevationRange;
                const y = yScale(elev);
                svgContent += `<text x="${margin.left - 10}" y="${y}" fill="darkorange" font-size="12" text-anchor="end" alignment-baseline="middle">${Math.round(elev)} м</text>`;
            }
        }

        const points = elevationData.map(d => `${xScale(d.distance)},${yScale(d.elevation)}`).join(' ');
        svgContent += `<polyline points="${points}" fill="none" stroke="darkorange" stroke-width="3"/>`;

        svgNode.innerHTML = svgContent;

        // --- X-AXIS LABELS (with overlap prevention) ---
        const waypoints = elevationData.filter(d => d.isWaypoint);
        let lastLabelEndX = -Infinity;
        const labelPadding = 10; // Min padding between labels

        waypoints.forEach(point => {
            const x = xScale(point.distance);
            
            const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            textNode.setAttribute('x', x);
            textNode.setAttribute('y', height - margin.bottom + 15);
            textNode.setAttribute('fill', 'darkorange');
            textNode.setAttribute('font-size', '12');
            textNode.setAttribute('text-anchor', 'middle');
            textNode.textContent = `${point.distance.toFixed(1)} км`;
            
            svgNode.appendChild(textNode);
            
            const bbox = textNode.getBBox();
            const currentLabelStartX = x - bbox.width / 2;
            
            if (currentLabelStartX < lastLabelEndX) {
                svgNode.removeChild(textNode);
            } else {
                lastLabelEndX = x + bbox.width / 2 + labelPadding;
            }
        });

        // --- INTERACTIVITY ---
        const hoverGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        hoverGroup.style.display = 'none';
        
        const hoverCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        hoverCircle.setAttribute('r', '5');
        hoverCircle.setAttribute('fill', '#32333d');
        hoverCircle.setAttribute('stroke', 'darkorange');
        hoverCircle.setAttribute('stroke-width', '1');

        const tooltipGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const tooltipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        tooltipRect.setAttribute('rx', '3');
        tooltipRect.setAttribute('ry', '3');
        tooltipRect.setAttribute('fill', 'rgba(0, 0, 0, 0.7)');
        
        const tooltipText1 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tooltipText1.setAttribute('fill', 'white');
        tooltipText1.setAttribute('font-size', '12');

        const tooltipText2 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tooltipText2.setAttribute('fill', 'white');
        tooltipText2.setAttribute('font-size', '12');

        tooltipGroup.appendChild(tooltipRect);
        tooltipGroup.appendChild(tooltipText1);
        tooltipGroup.appendChild(tooltipText2);
        hoverGroup.appendChild(tooltipGroup);
        hoverGroup.appendChild(hoverCircle);
        svgNode.appendChild(hoverGroup);

        svgNode.addEventListener('mousemove', (event) => {
            const rect = svgNode.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;

            if (mouseX < margin.left || mouseX > width - margin.right) {
                hoverGroup.style.display = 'none';
                if (routeHoverMarker) routeHoverMarker.setStyle({ opacity: 0, fillOpacity: 0 });
                return;
            }

            hoverGroup.style.display = 'block';
            if (routeHoverMarker) routeHoverMarker.setStyle({ opacity: 1, fillOpacity: 0.8 });
            
            const mouseDistance = ((mouseX - margin.left) / chartWidth) * maxDist;

            let i = 0;
            while (i < elevationData.length - 1 && elevationData[i].distance < mouseDistance) {
                i++;
            }
            const p1 = elevationData[i > 0 ? i - 1 : 0];
            const p2 = elevationData[i];

            const distanceSegment = p2.distance - p1.distance;
            const mouseDistInSegment = mouseDistance - p1.distance;
            const fraction = distanceSegment > 0 ? mouseDistInSegment / distanceSegment : 0;

            const interpolatedElevation = p1.elevation + fraction * (p2.elevation - p1.elevation);
            const interpolatedLat = p1.lat + fraction * (p2.lat - p1.lat);
            const interpolatedLng = p1.lng + fraction * (p2.lng - p1.lng);

            if (routeHoverMarker) {
                routeHoverMarker.setLatLng([interpolatedLat, interpolatedLng]);
            }

            const x = xScale(mouseDistance);
            const y = yScale(interpolatedElevation);

            hoverCircle.setAttribute('cx', x);
            hoverCircle.setAttribute('cy', y);

            tooltipText1.textContent = `Высота: ${interpolatedElevation.toFixed(0)} м`;
            tooltipText2.textContent = `Расстояние: ${mouseDistance.toFixed(2)} км`;
            
            const padding = 5;
            const bbox1 = tooltipText1.getBBox();
            const bbox2 = tooltipText2.getBBox();
            const tooltipWidth = Math.max(bbox1.width, bbox2.width) + 2 * padding;
            const tooltipHeight = bbox1.height + bbox2.height + 2 * padding;

            let tooltipX, tooltipY, textX, textY1, textY2;
            const offset = 3;
            const rightEdge = width - margin.right;
            const topEdge = margin.top;

            const overflowsRight = x + offset + tooltipWidth > rightEdge;
            const overflowsTop = y - offset - tooltipHeight < topEdge;

            if (!overflowsTop && !overflowsRight) {
                tooltipX = x + offset;
                tooltipY = y - offset - tooltipHeight;
            } else if (!overflowsTop && overflowsRight) {
                tooltipX = x - offset - tooltipWidth;
                tooltipY = y - offset - tooltipHeight;
            } else if (overflowsTop && !overflowsRight) {
                tooltipX = x + offset;
                tooltipY = y + offset;
            } else { 
                tooltipX = x - offset - tooltipWidth;
                tooltipY = y + offset;
            }
            
            textX = tooltipX + padding;
            textY1 = tooltipY + padding + bbox1.height - 2;
            textY2 = tooltipY + 2 * padding + bbox1.height + bbox2.height - 2;

            tooltipRect.setAttribute('x', tooltipX);
            tooltipRect.setAttribute('y', tooltipY);
            tooltipRect.setAttribute('width', tooltipWidth);
            tooltipRect.setAttribute('height', tooltipHeight);

            tooltipText1.setAttribute('x', textX);
            tooltipText1.setAttribute('y', textY1);
            tooltipText2.setAttribute('x', textX);
            tooltipText2.setAttribute('y', textY2);
        });

        svgNode.addEventListener('mouseleave', () => {
            hoverGroup.style.display = 'none';
            if (routeHoverMarker) {
                routeHoverMarker.setStyle({ opacity: 0, fillOpacity: 0 });
            }
        });
    }
    
    // Handle map click when building route
    function onMapClickForRoute(e) {
        // Check if we're still in route building mode
        if (!isBuildingRoute) return;
        
        // Check if we're still allowed to add points (not calculating)
        if (isCalculatingRoute) return;
        
        // Add point to route
        routePoints.push(e.latlng);
        
        // Create marker for the point with custom styling
        const marker = L.marker(e.latlng, {
            draggable: true,
            icon: L.divIcon({
                className: 'custom-marker',
                html: '<div style="background-color: #616363; border: 2px solid darkorange; border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center;"><div style="background-color: darkorange; border-radius: 50%; width: 8px; height: 8px;"></div></div>',
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            })
        }).addTo(map);
        
        marker.on('dragend', function(event) {
            // Update the point position when marker is dragged
            const index = routeMarkers.indexOf(marker);
            if (index !== -1) {
                routePoints[index] = event.target.getLatLng();
                // Update the route polyline
                updateRoutePolyline();
            }
        });
        
        routeMarkers.push(marker);
        
        // Update the route polyline
        updateRoutePolyline();
        
        // Enable calculate button if we have at least 2 points
        if (routePoints.length >= 2) {
            routeCalcControl.style.display = 'block';
        }
    }
    
    // Update route polyline
    function updateRoutePolyline() {
        // Remove existing polyline
        if (routePolyline) {
            map.removeLayer(routePolyline);
        }
        
        // Create new polyline if we have points
        if (routePoints.length > 0) {
            routePolyline = L.polyline(routePoints, {
                color: 'darkorange', // Changed to darkorange
                weight: 3,
                opacity: 0.7
            }).addTo(map);
        }
    }
    
    async function calculateRouteElevation() {
        if (routePoints.length < 2) return;

        isCalculatingRoute = true;
        map.off('click', onMapClickForRoute);

        profileContent.innerHTML = '<div style="color: white; font-family: sans-serif; text-align: center; padding-top: 50px;">Загрузка реальных данных о высоте...</div>';
        elevationProfile.style.display = 'block';

        const SAMPLE_INTERVAL_KM = currentSampleStep / 1000; // Convert meters to kilometers
        const elevationData = [];
        let cumulativeDist = 0;

        // Add the very first point
        elevationData.push({ 
            distance: 0, 
            lat: routePoints[0].lat, 
            lng: routePoints[0].lng, 
            isWaypoint: true 
        });

        // 1. Generate consistently spaced points along the entire route polyline
        for (let i = 0; i < routePoints.length - 1; i++) {
            const startPoint = routePoints[i];
            const endPoint = routePoints[i+1];
            const segmentDist = startPoint.distanceTo(endPoint) / 1000;
            const segmentEndDist = cumulativeDist + segmentDist;

            // Determine the distance of the next sample point
            let nextSampleDist = (Math.floor(cumulativeDist / SAMPLE_INTERVAL_KM) + 1) * SAMPLE_INTERVAL_KM;

            // Add intermediate sample points within the current segment
            while (nextSampleDist < segmentEndDist) {
                const fraction = (nextSampleDist - cumulativeDist) / segmentDist;
                const interLat = startPoint.lat + (endPoint.lat - startPoint.lat) * fraction;
                const interLng = startPoint.lng + (endPoint.lng - startPoint.lng) * fraction;
                
                elevationData.push({ 
                    distance: nextSampleDist, 
                    lat: interLat, 
                    lng: interLng, 
                    isWaypoint: false 
                });

                nextSampleDist += SAMPLE_INTERVAL_KM;
            }

            // Always include the user-defined waypoint at the end of the segment
            elevationData.push({ 
                distance: segmentEndDist, 
                lat: endPoint.lat, 
                lng: endPoint.lng, 
                isWaypoint: true 
            });

            cumulativeDist = segmentEndDist;
        }

        // 2. De-duplicate points and prepare for server request
        const uniqueElevationData = Array.from(new Map(elevationData.map(p => [p.distance, p])).values());
        uniqueElevationData.sort((a, b) => a.distance - b.distance);
        const pointsToQuery = uniqueElevationData.map(p => [p.lat, p.lng]);

        // 3. Fetch real elevation data from the server
        try {
            const response = await fetch('https://strekoza-ylfm.onrender.com/api/get_elevation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ points: pointsToQuery }),
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.statusText}`);
            }

            const data = await response.json();
            const realElevations = data.elevations;

            // 4. Populate elevationData with real elevations
            if (realElevations.length === uniqueElevationData.length) {
                for (let i = 0; i < uniqueElevationData.length; i++) {
                    uniqueElevationData[i].elevation = realElevations[i];
                }
            } else {
                throw new Error('Mismatch between requested points and received elevations.');
            }

            // Store data for export and build the chart
            currentRouteData = uniqueElevationData;
            buildElevationProfile(uniqueElevationData);

        } catch (error) {
            console.error('Failed to fetch elevation data:', error);
            profileContent.innerHTML = `<div style="color: red; font-family: sans-serif; text-align: center; padding-top: 50px;">Ошибка при загрузке данных о высоте.<br>Убедитесь, что сервер запущен.</div>`;
        }
    }
    
    function exportRouteToCSV() {
        if (currentRouteData.length === 0) {
            alert("Нет данных для экспорта.");
            return;
        }

        const headers = ["широта", "долгота", "высота_м", "расстояние_км", "is_waypoint"];
        // Export all points from elevation profile with current step
        const dataToExport = currentRouteData;

        const rows = dataToExport.map(p => 
            [
                p.lat.toFixed(6), 
                p.lng.toFixed(6), 
                p.elevation.toFixed(1), 
                p.distance.toFixed(3),
                p.isWaypoint ? '1' : '0' // Add the waypoint flag
            ].join(',')
        );

        let csvContent = headers.join(",") + "\n" + rows.join("\n");

        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `route_profile_step${currentSampleStep}m.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function resetRouteBuilding() {
        routeMarkers.forEach(marker => map.removeLayer(marker));
        routeMarkers = [];

        if (routePolyline) {
            map.removeLayer(routePolyline);
            routePolyline = null;
        }

        if (routeHoverMarker) {
            map.removeLayer(routeHoverMarker);
            routeHoverMarker = null;
        }

        routePoints.length = 0;
        currentRouteData = []; // Clear exported data
        isCalculatingRoute = false;

        routeCalcControl.style.display = 'none';
        elevationProfile.style.display = 'none';

        map.off('click', onMapClickForRoute);
        isBuildingRoute = false;
    }
    
    // Event listeners for route buttons
    buildRouteBtn.addEventListener('click', function() {
        // Enable route building mode
        isBuildingRoute = true;
        
        // Add map click handler for adding route points
        map.on('click', onMapClickForRoute);
        
        // Hide build button
        buildRouteBtn.style.display = 'none';
    });
    
    calculateRouteBtn.addEventListener('click', async function() {
        if (routePoints.length < 2) return;
        
        // Calculate and show elevation profile
        await calculateRouteElevation();
        
        // Hide calculate button
        routeCalcControl.style.display = 'none';
    });
    
    exportRouteBtn.addEventListener('click', exportRouteToCSV);



    finishRouteBtn.addEventListener('click', function() {
        // Reset route building
        resetRouteBuilding();
        
        // Show build route button again
        buildRouteBtn.style.display = 'block';
    });

    // --- IMPORT LOGIC ---
    importRouteBtn.addEventListener('click', () => {
        csvImporter.click();
    });

    csvImporter.addEventListener('change', handleCsvImport);

    function handleCsvImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async function(e) {
            const text = e.target.result;
            try {
                const parsedData = parseCsv(text);
                await reconstructRouteFromData(parsedData);
            } catch (error) {
                console.error("Ошибка при парсинге CSV:", error);
                alert(`Не удалось прочитать файл. Убедитесь, что это корректный CSV-файл.\nДетали: ${error.message}`);
            }
        };
        reader.readAsText(file);
        
        event.target.value = '';
    }

    function parseCsv(text) {
        const lines = text.trim().split(/\r\n|\n/);
        if (lines.length < 2) throw new Error("CSV файл должен содержать заголовок и хотя бы одну строку данных.");

        const headers = lines[0].split(',').map(h => h.trim());
        const latIndex = headers.indexOf('широта');
        const lngIndex = headers.indexOf('долгота');
        const waypointIndex = headers.indexOf('is_waypoint'); // Find the new column

        if (latIndex === -1 || lngIndex === -1) {
            throw new Error('CSV файл должен содержать столбцы: широта, долгота');
        }

        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            
            // If the waypoint column exists, only import rows where it's '1'.
            // If it doesn't exist (old format), import all rows.
            if (waypointIndex !== -1 && values[waypointIndex] !== '1') {
                continue;
            }

            data.push({
                lat: parseFloat(values[latIndex]),
                lng: parseFloat(values[lngIndex]),
            });
        }
        
        if (data.length === 0) {
            throw new Error("В файле не найдено ни одной ключевой точки маршрута (с атрибутом is_waypoint=1).");
        }

        return data;
    }

    async function reconstructRouteFromData(data) {
        if (!data || data.length < 2) {
            alert("Файл не содержит достаточного количества точек для построения маршрута.");
            return;
        }

        resetRouteBuilding();

        routePoints = data.map(p => L.latLng(p.lat, p.lng));

        routePoints.forEach(point => {
            const marker = L.marker(point, {
                draggable: true,
                icon: L.divIcon({
                    className: 'custom-marker',
                    html: '<div style="background-color: #616363; border: 2px solid darkorange; border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center;"><div style="background-color: darkorange; border-radius: 50%; width: 8px; height: 8px;"></div></div>',
                    iconSize: [16, 16],
                    iconAnchor: [8, 8]
                })
            }).addTo(map);
            routeMarkers.push(marker);
        });
        updateRoutePolyline();

        await calculateRouteElevation();

        buildRouteBtn.style.display = 'none';
        routeCalcControl.style.display = 'none';
        isBuildingRoute = true;

        const routeBounds = L.latLngBounds(routePoints);
        map.fitBounds(routeBounds, { padding: [50, 50] });
    }
});
