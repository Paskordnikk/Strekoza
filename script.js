document.addEventListener('DOMContentLoaded', function () {
    const map = L.map('map').setView([55.751244, 37.618423], 10); // Default to Moscow

    const tileLayers = {
        opentopomap: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
        }),
        monochrome: L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'
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
        document.getElementById('map').style.filter = `brightness(${e.target.value}%)`;
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
