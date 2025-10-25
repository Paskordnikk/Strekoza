window.onload = function () {
    const map = L.map('map', { zoomControl: false }).setView([55.751244, 37.618423], 10); // Default to Moscow
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // --- Polyline Measure Control (Basic) ---
    L.control.polylineMeasure({ position: 'topright' }).addTo(map);

    const tileLayers = {
        opentopomap: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
        }),
        monochrome: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri',
            maxZoom: 13
        }),
        thunderforestlandscape: L.tileLayer('https://{s}.tile.thunderforest.com/landscape/{z}/{x}/{y}.png?apikey=86dc7e1b09ba4c8d8d295be536865e6b', {
            attribution: '&copy; <a href="http://www.thunderforest.com/">Thunderforest</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 22
        }),
        openstreetmap: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }),
        cyclosm: L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
            maxZoom: 20,
            attribution: '<a href="https://github.com/cyclosm/cyclosm-cartocss-style/releases" title="CyclOSM - Open Bicycle render">CyclOSM</a> | Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }),
        
        cartovoyager: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }),
        esriocean: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Sources: GEBCO, NOAA, CHS, OSU, UNH, CSUMB, National Geographic, DeLorme, NAVTEQ, and Esri',
            maxNativeZoom: 13,
            maxZoom: 20
        }),
        jawgdark: L.tileLayer('https://tile.jawg.io/jawg-matrix/{z}/{x}/{y}{r}.png?access-token=hqhKonehBnQndr33yLl8cxfqGBr6JCJt6daPEBohzFSyGcJViFHdYRNWFNQOb1jf', {
            attribution: '<a href="https://jawg.io" title="Tiles Courtesy of Jawg Maps" target="_blank">&copy; <b>Jawg</b>Maps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            minZoom: 0,
            maxZoom: 22
        }),
    };

    let currentTileLayer = tileLayers.opentopomap;
    currentTileLayer.addTo(map);

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

    const brightnessSlider = document.getElementById('brightness-slider');
    brightnessSlider.addEventListener('input', function (e) {
        map.getPane('tilePane').style.opacity = e.target.value / 100;
    });

    const mapTypeRadios = document.querySelectorAll('input[name="map-type"]');
    mapTypeRadios.forEach(radio => {
        radio.addEventListener('change', function (e) {
            map.removeLayer(currentTileLayer);
            currentTileLayer = tileLayers[e.target.value];
            currentTileLayer.addTo(map);
        });
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
};
