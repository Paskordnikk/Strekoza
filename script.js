document.addEventListener('DOMContentLoaded', function () {
    const map = L.map('map', { zoomControl: false }).setView([55.751244, 37.618423], 10); // Default to Moscow
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const tileLayers = {
        opentopomap: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
        }),
        monochrome: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        }),
        openstreetmap: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        })
    };

    let currentTileLayer = tileLayers.opentopomap;
    currentTileLayer.addTo(map);

    const hamburgerMenu = document.getElementById('hamburger-menu');
    const sideMenu = document.getElementById('side-menu');

    hamburgerMenu.addEventListener('click', function () {
        sideMenu.classList.toggle('open');
    });

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

    try {
        let tg = window.Telegram.WebApp;
        tg.ready();
    } catch (e) {
        console.error("Telegram WebApp is not available.", e);
    }
});
