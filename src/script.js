// API Configuration
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://127.0.0.1:8000' 
    : 'https://strekoza-ylfm.onrender.com';

// Encryption configuration
const ENCRYPTION_ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits для GCM

// Encryption functions
/**
 * Получает ключ шифрования с сервера
 * @returns {Promise<CryptoKey>} Ключ шифрования
 */
async function getEncryptionKey() {
    const token = getAuthToken();
    if (!token) {
        throw new Error('Требуется аутентификация для получения ключа шифрования');
    }

    try {
        const response = await fetch(`${API_URL}/api/get_encryption_key`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Не удалось получить ключ шифрования');
        }

        const data = await response.json();
        const keyMaterial = data.key;

        // Импортируем ключ из строки
        const keyBuffer = Uint8Array.from(atob(keyMaterial), c => c.charCodeAt(0));
        
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyBuffer,
            {
                name: ENCRYPTION_ALGORITHM,
                length: KEY_LENGTH
            },
            false,
            ['encrypt', 'decrypt']
        );

        return cryptoKey;
    } catch (error) {
        console.error('Ошибка при получении ключа шифрования:', error);
        throw error;
    }
}

/**
 * Шифрует данные перед сохранением в localStorage
 * @param {string} plaintext - Данные для шифрования (JSON строка)
 * @returns {Promise<string>} Зашифрованные данные в формате base64
 */
async function encryptData(plaintext) {
    try {
        const key = await getEncryptionKey();
        
        // Преобразуем текст в ArrayBuffer
        const data = new TextEncoder().encode(plaintext);
        
        // Генерируем случайный IV
        const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
        
        // Шифруем данные
        const encryptedData = await crypto.subtle.encrypt(
            {
                name: ENCRYPTION_ALGORITHM,
                iv: iv
            },
            key,
            data
        );
        
        // Объединяем IV и зашифрованные данные
        const combined = new Uint8Array(iv.length + encryptedData.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encryptedData), iv.length);
        
        // Преобразуем в base64 для хранения
        const base64 = btoa(String.fromCharCode(...combined));
        
        return base64;
    } catch (error) {
        console.error('Ошибка при шифровании данных:', error);
        throw new Error('Не удалось зашифровать данные');
    }
}

/**
 * Расшифровывает данные из localStorage
 * @param {string} encryptedBase64 - Зашифрованные данные в формате base64
 * @returns {Promise<string>} Расшифрованные данные (JSON строка)
 */
async function decryptData(encryptedBase64) {
    try {
        const key = await getEncryptionKey();
        
        // Преобразуем base64 в ArrayBuffer
        const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
        
        // Извлекаем IV и зашифрованные данные
        const iv = combined.slice(0, IV_LENGTH);
        const encryptedData = combined.slice(IV_LENGTH);
        
        // Расшифровываем данные
        const decryptedData = await crypto.subtle.decrypt(
            {
                name: ENCRYPTION_ALGORITHM,
                iv: iv
            },
            key,
            encryptedData
        );
        
        // Преобразуем в строку
        const plaintext = new TextDecoder().decode(decryptedData);
        
        return plaintext;
    } catch (error) {
        console.error('Ошибка при расшифровке данных:', error);
        throw new Error('Не удалось расшифровать данные. Возможно, данные повреждены или ключ изменился.');
    }
}

/**
 * Сохраняет зашифрованные данные в localStorage
 * @param {string} key - Ключ для localStorage
 * @param {any} data - Данные для сохранения (будут преобразованы в JSON)
 * @returns {Promise<void>}
 */
async function saveEncryptedToLocalStorage(key, data) {
    try {
        const jsonData = JSON.stringify(data);
        const encrypted = await encryptData(jsonData);
        
        // Проверка: зашифрованные данные должны быть в base64 и не содержать читаемый JSON
        const isEncrypted = encrypted.length > 50 && !encrypted.includes('"lat"') && !encrypted.includes('"lng"');
        
        if (!isEncrypted) {
            console.warn('⚠️ Предупреждение: данные могут быть не зашифрованы!');
        }
        
        localStorage.setItem(key, encrypted);
        console.log(`✅ Данные сохранены в localStorage (ключ: ${key}, размер: ${encrypted.length} символов)`);
        console.log(`🔒 Первые 50 символов зашифрованных данных: ${encrypted.substring(0, 50)}...`);
    } catch (error) {
        console.error('❌ Ошибка при сохранении зашифрованных данных:', error);
        throw error;
    }
}

/**
 * Загружает и расшифровывает данные из localStorage
 * @param {string} key - Ключ для localStorage
 * @returns {Promise<any>} Расшифрованные данные
 */
async function loadDecryptedFromLocalStorage(key) {
    try {
        const encrypted = localStorage.getItem(key);
        if (!encrypted) {
            return null;
        }
        
        // Проверяем, зашифрованы ли данные (зашифрованные данные обычно длиннее и не содержат читаемый JSON)
        const isLikelyEncrypted = encrypted.length > 50 && !encrypted.includes('"lat"') && !encrypted.includes('"lng"');
        
        if (isLikelyEncrypted) {
            console.log(`🔓 Расшифровка данных из localStorage (ключ: ${key})...`);
        } else {
            console.warn('⚠️ Данные в localStorage могут быть не зашифрованы!');
        }
        
        const decrypted = await decryptData(encrypted);
        const parsed = JSON.parse(decrypted);
        console.log(`✅ Данные успешно расшифрованы и загружены (ключ: ${key})`);
        return parsed;
    } catch (error) {
        console.error('❌ Ошибка при загрузке расшифрованных данных:', error);
        // Если не удалось расшифровать, возможно это старые незашифрованные данные
        // Попробуем загрузить как обычный JSON
        try {
            const plainData = localStorage.getItem(key);
            if (plainData) {
                console.warn('⚠️ Загружены незашифрованные данные (старый формат)');
                return JSON.parse(plainData);
            }
        } catch (e) {
            // Игнорируем ошибку
        }
        throw error;
    }
}

/**
 * Проверяет, зашифрованы ли данные в localStorage
 * @param {string} key - Ключ для проверки
 * @returns {boolean} true если данные зашифрованы, false если нет
 */
function isDataEncrypted(key) {
    const data = localStorage.getItem(key);
    if (!data) return false;
    
    // Зашифрованные данные в base64 обычно:
    // 1. Длиннее 50 символов
    // 2. Не содержат читаемые JSON структуры
    // 3. Состоят из base64 символов (A-Z, a-z, 0-9, +, /, =)
    const isBase64 = /^[A-Za-z0-9+/=]+$/.test(data);
    const hasJsonStructure = data.includes('"lat"') || data.includes('"lng"') || data.includes('"points"');
    const isLongEnough = data.length > 50;
    
    return isBase64 && !hasJsonStructure && isLongEnough;
}

// Добавляем функцию в глобальную область для проверки в консоли
window.checkEncryption = function() {
    console.log('🔍 Проверка шифрования данных в localStorage:');
    console.log('─'.repeat(50));
    
    const routeKey = 'saved_route';
    const pointsKey = 'saved_points';
    
    const routeEncrypted = isDataEncrypted(routeKey);
    const pointsEncrypted = isDataEncrypted(pointsKey);
    
    if (localStorage.getItem(routeKey)) {
        const routeData = localStorage.getItem(routeKey);
        console.log(`📌 Маршрут (${routeKey}):`);
        console.log(`   Зашифровано: ${routeEncrypted ? '✅ ДА' : '❌ НЕТ'}`);
        console.log(`   Размер: ${routeData.length} символов`);
        console.log(`   Превью: ${routeData.substring(0, 80)}...`);
    } else {
        console.log(`📌 Маршрут (${routeKey}): не найден`);
    }
    
    if (localStorage.getItem(pointsKey)) {
        const pointsData = localStorage.getItem(pointsKey);
        console.log(`📌 Точки (${pointsKey}):`);
        console.log(`   Зашифровано: ${pointsEncrypted ? '✅ ДА' : '❌ НЕТ'}`);
        console.log(`   Размер: ${pointsData.length} символов`);
        console.log(`   Превью: ${pointsData.substring(0, 80)}...`);
    } else {
        console.log(`📌 Точки (${pointsKey}): не найдены`);
    }
    
    console.log('─'.repeat(50));
    console.log('💡 Для проверки введите: checkEncryption()');
};

// Authentication functions
function getAuthToken() {
    return localStorage.getItem('auth_token');
}

function getAuthHeaders() {
    const token = getAuthToken();
    const headers = {
        'Content-Type': 'application/json',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

async function checkAuthentication() {
    const token = getAuthToken();
    if (!token) {
        // Нет токена - перенаправляем на страницу входа
        window.location.href = 'login.html';
        return false;
    }
    
    // Проверяем валидность токена, делая тестовый запрос
    try {
        const response = await fetch(`${API_URL}/api/get_elevation`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ points: [] })
        });
        
        if (response.status === 401) {
            // Токен невалидный - удаляем и перенаправляем на вход
            localStorage.removeItem('auth_token');
            window.location.href = 'login.html';
            return false;
        }
        
        // Токен валидный (даже если запрос вернул ошибку валидации 422 - это нормально для пустого массива)
        // Любой статус кроме 401 означает, что токен принят сервером
        return true;
    } catch (error) {
        // При ошибке соединения разрешаем доступ (может быть сервер недоступен)
        // Пользователь сможет увидеть ошибку при реальном запросе
        return true;
    }
}

// Проверяем аутентификацию сразу при загрузке скрипта
(async function() {
    const isAuthenticated = await checkAuthentication();
    if (!isAuthenticated) {
        // Перенаправление уже произошло в checkAuthentication
        return;
    }
    
    // Если пользователь аутентифицирован, продолжаем загрузку страницы
    // Ждем загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMap);
    } else {
        initMap();
    }
})();

function initMap() {
    // Инициализация карты происходит здесь, когда DOM уже загружен
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
        
        // Generate geodesic points for the measurement line to account for Earth's curvature
        let geodesicMeasurementPoints = [];
        
        for (let i = 0; i < measurementPoints.length - 1; i++) {
            const startPoint = measurementPoints[i];
            const endPoint = measurementPoints[i + 1];
            
            // Generate intermediate points for this segment
            const segmentPoints = generateGeodesicPoints(startPoint, endPoint);
            
            if (i === 0) {
                // For the first segment, include all points
                geodesicMeasurementPoints = [...segmentPoints];
            } else {
                // For subsequent segments, skip the first point to avoid duplication
                geodesicMeasurementPoints = [...geodesicMeasurementPoints, ...segmentPoints.slice(1)];
            }
        }
        
        // Add polyline to show the measured path with geodesic segments
        measurementPolyline = L.polyline(geodesicMeasurementPoints, {
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
        if (!isMeasuring) {
            // Start measuring
            isMeasuring = true;
            measureDistanceBtn.classList.add('active');
            measureDistanceBtn.textContent = 'Остановить измерение';
            
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
            
            // Update cursor for all point markers
            updateAllPointMarkersCursor();
        } else {
            // Stop measuring
            isMeasuring = false;
            measureDistanceBtn.classList.remove('active');
            measureDistanceBtn.textContent = 'Измерить расстояние';
            
            // Remove click event from map
            map.off('click', onMapClick);
            
            // Update cursor for all point markers
            updateAllPointMarkersCursor();
            
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

    // Helper function to create overlay layer with proper mobile settings
    function createOverlayLayer(url, options = {}) {
        // Более надежное определение мобильного устройства
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                         ('ontouchstart' in window) ||
                         (navigator.maxTouchPoints > 0) ||
                         (window.innerWidth <= 768);
        
        const defaultOptions = {
            pane: 'roadsPane',
            crossOrigin: true,
            // Ключевое изменение: на мобильных обновляем во время движения и зумирования
            updateWhenIdle: false, // Всегда обновляем сразу, не ждем остановки
            updateWhenZooming: true, // Обновляем во время зумирования
            // Увеличиваем буфер для предзагрузки тайлов
            keepBuffer: isMobile ? 3 : 2,
            // Уменьшаем интервал обновления для более быстрого отклика
            updateInterval: 50,
            ...options
        };
        
        const layer = L.tileLayer(url, defaultOptions);
        
        // Обработка ошибок загрузки тайлов
        layer.on('tileerror', function(error, tile) {
            // При ошибке загрузки тайла, попробуем перезагрузить через небольшую задержку
            setTimeout(() => {
                if (layer && map.hasLayer(layer)) {
                    try {
                        layer.removeTile(tile);
                        layer._addTile(tile);
                    } catch (e) {
                        // Игнорируем ошибки при попытке обновить тайл
                    }
                }
            }, 500);
        });
        
        return layer;
    }

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
            'super-contrast-relief': () => L.tileLayer('https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://github.com/tilezen/joerd">Terrain Tiles</a>',
                maxZoom: 15
            }),
            'contrast-relief': () => L.tileLayer('https://maps-for-free.com/layer/relief/z{z}/row{y}/{z}_{x}-{y}.jpg', {
                attribution: '&copy; <a href="https://maps-for-free.com">Maps-for-free.com</a>',
                maxZoom: 15
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
            gray: () => L.tileLayer('http://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles &copy; Esri &mdash; Source: Esri',
                maxZoom: 16
            }),
            waze: () => L.tileLayer('https://il-livemap-tiles3.waze.com/tiles/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.waze.com">Waze</a>',
                maxZoom: 18
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

    let baseLayer = createTileLayer('jawgdark');
    baseLayer.options.pane = 'basePane';
    baseLayer.addTo(map);
    
    let roadsLayer = null;
    let bordersLayer = null;
    let labelsLayer = null;
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
        // Initialize route color buttons when menu opens
        if (sideMenu.classList.contains('open')) {
            initializeRouteColorButtons();
        }
    });

    closeMenuBtn.addEventListener('click', closeMenu);
    map.on('click', closeMenu);

    // Обработчик кнопки выхода
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            // Удаляем токен из localStorage
            localStorage.removeItem('auth_token');
            // Перенаправляем на страницу входа
            window.location.href = 'login.html';
        });
    }

    // Обработчик для модального окна инструкции
    const instructionLabel = document.getElementById('instruction-label');
    const instructionModal = document.getElementById('instruction-modal');
    const instructionCloseBtn = document.getElementById('instruction-close-btn');

    if (instructionLabel && instructionModal && instructionCloseBtn) {
        // Открытие модального окна
        instructionLabel.addEventListener('click', function(e) {
            e.stopPropagation();
            instructionModal.style.display = 'flex';
        });

        // Закрытие модального окна по клику на крестик
        instructionCloseBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            instructionModal.style.display = 'none';
        });

        // Закрытие модального окна по клику вне его области
        instructionModal.addEventListener('click', function(e) {
            if (e.target === instructionModal) {
                instructionModal.style.display = 'none';
            }
        });
    }

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
    const lastBaseMapType = localStorage.getItem('baseMapType') || 'jawgdark';
    const lastOverlayMapType = localStorage.getItem('overlayMapType') || 'opentopomap';
    const lastOverlayEnabled = localStorage.getItem('overlayEnabled') === 'true';
    const lastOverlayOpacity = parseInt(localStorage.getItem('overlayOpacity') || '50');
    const lastRoadsEnabled = localStorage.getItem('roadsEnabled') === 'true';
    const lastRoadsOpacity = parseInt(localStorage.getItem('roadsOpacity') || '100');
    const lastBordersEnabled = localStorage.getItem('bordersEnabled') === 'true';
    const lastBordersOpacity = parseInt(localStorage.getItem('bordersOpacity') || '100');
    const lastLabelsEnabled = localStorage.getItem('labelsEnabled') === 'true';
    const lastLabelsOpacity = parseInt(localStorage.getItem('labelsOpacity') || '100');
    const lastZoomLevel = localStorage.getItem('mapZoomLevel');
    const lastBaseBrightness = parseInt(localStorage.getItem('baseBrightness') || '100');

    // Apply saved base map
    if (lastBaseMapType !== 'jawgdark') {
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
        
        // Асинхронная загрузка слоя при старте
        setTimeout(() => {
            roadsLayer = createOverlayLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Map style: &copy; <a href="https://www.OpenRailwayMap.org">OpenRailwayMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
            });
            roadsLayer.setOpacity(lastRoadsOpacity / 100);
            roadsLayer.addTo(map);
            
            setTimeout(() => {
                map.invalidateSize();
            }, 100);
        }, 100);
        
        roadsOpacitySlider.value = lastRoadsOpacity;
    }

    // Apply saved borders layer settings
    const enableBordersCheckbox = document.getElementById('enable-borders-layer');
    const bordersControls = document.getElementById('borders-layer-controls');
    const bordersOpacitySlider = document.getElementById('borders-opacity-slider');
    
    if (lastBordersEnabled) {
        enableBordersCheckbox.checked = true;
        bordersControls.style.display = 'block';
        
        // Асинхронная загрузка слоя при старте
        setTimeout(() => {
            bordersLayer = createOverlayLayer('https://tiles.stadiamaps.com/tiles/stamen_toner_lines/{z}/{x}/{y}{r}.png?api_key=1e09df77-cc36-4be2-8ed9-6c5eaf3476ff', {
                minZoom: 0,
                maxZoom: 20,
                attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.stamen.com/" target="_blank">Stamen Design</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            });
            bordersLayer.setOpacity(lastBordersOpacity / 100);
            bordersLayer.addTo(map);
            
            setTimeout(() => {
                map.invalidateSize();
            }, 100);
        }, 100);
        
        bordersOpacitySlider.value = lastBordersOpacity;
    }

    // Apply saved labels layer settings
    const enableLabelsCheckbox = document.getElementById('enable-labels-layer');
    const labelsControls = document.getElementById('labels-layer-controls');
    const labelsOpacitySlider = document.getElementById('labels-opacity-slider');
    
    if (lastLabelsEnabled) {
        enableLabelsCheckbox.checked = true;
        labelsControls.style.display = 'block';
        
        // Асинхронная загрузка слоя при старте
        setTimeout(() => {
            labelsLayer = createOverlayLayer('https://tiles.stadiamaps.com/tiles/stamen_toner_labels/{z}/{x}/{y}{r}.png?api_key=1e09df77-cc36-4be2-8ed9-6c5eaf3476ff', {
                minZoom: 0,
                maxZoom: 20,
                attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.stamen.com/" target="_blank">Stamen Design</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            });
            labelsLayer.setOpacity(lastLabelsOpacity / 100);
            labelsLayer.addTo(map);
            
            setTimeout(() => {
                map.invalidateSize();
            }, 100);
        }, 100);
        
        labelsOpacitySlider.value = lastLabelsOpacity;
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
    const baseRadioTouched = new WeakMap();
    
    // Функция для мгновенного визуального переключения радиокнопки (только UI)
    function handleBaseRadioToggle(radioInput) {
        baseRadioTouched.set(radioInput, true);
        // Мгновенно устанавливаем checked для всех радиокнопок в группе
        baseMapTypeRadios.forEach(r => r.checked = false);
        radioInput.checked = true;
        // Принудительно обновляем DOM для мгновенного визуального отклика
        void radioInput.offsetWidth;
        
        // Запускаем логику изменения карты асинхронно, чтобы не блокировать визуальное обновление
        setTimeout(() => {
            map.removeLayer(baseLayer);
            baseLayer = createTileLayer(radioInput.value);
            baseLayer.options.pane = 'basePane';
            baseLayer.addTo(map);
            
            // Reapply brightness
            map.getPane('basePane').style.opacity = brightnessSlider.value / 100;
            
            localStorage.setItem('baseMapType', radioInput.value);
        }, 0);
    }
    
    baseMapTypeRadios.forEach(radio => {
        // Добавляем обработчик mousedown для мгновенного переключения на ПК (до отпускания кнопки мыши)
        radio.addEventListener('mousedown', function (e) {
            e.preventDefault(); // Предотвращаем стандартное поведение браузера
            handleBaseRadioToggle(e.target);
        });
        
        // Добавляем обработчик touchstart на сам input
        radio.addEventListener('touchstart', function (e) {
            e.preventDefault(); // Предотвращаем стандартное поведение для мгновенного отклика
            handleBaseRadioToggle(e.target);
        }, { passive: false });
        
        // Добавляем обработчик click для предотвращения стандартного поведения
        radio.addEventListener('click', function (e) {
            // Всегда предотвращаем стандартное поведение, так как уже обработали через mousedown/touchstart
            e.preventDefault();
            if (baseRadioTouched.get(e.target)) {
                baseRadioTouched.delete(e.target);
            }
        });
        
        // Обработчик change оставляем для случаев, когда состояние меняется программно
        radio.addEventListener('change', function (e) {
            // Выполняем тяжелые операции асинхронно, чтобы не блокировать визуальное обновление
            requestAnimationFrame(() => {
                map.removeLayer(baseLayer);
                baseLayer = createTileLayer(e.target.value);
                baseLayer.options.pane = 'basePane';
                baseLayer.addTo(map);
                
                // Reapply brightness
                map.getPane('basePane').style.opacity = brightnessSlider.value / 100;
                
                localStorage.setItem('baseMapType', e.target.value);
            });
        });
    });

    // Overlay map type change handler
    const overlayMapTypeRadios = document.querySelectorAll('input[name="overlay-map-type"]');
    const overlayRadioTouched = new WeakMap();
    
    // Функция для мгновенного визуального переключения радиокнопки (только UI)
    function handleOverlayRadioToggle(radioInput) {
        overlayRadioTouched.set(radioInput, true);
        // Мгновенно устанавливаем checked для всех радиокнопок в группе
        overlayMapTypeRadios.forEach(r => r.checked = false);
        radioInput.checked = true;
        // Принудительно обновляем DOM для мгновенного визуального отклика
        void radioInput.offsetWidth;
        
        // Запускаем логику изменения карты асинхронно, чтобы не блокировать визуальное обновление
        setTimeout(() => {
            if (overlayLayer) {
                map.removeLayer(overlayLayer);
            }
            
            overlayLayer = createTileLayer(radioInput.value);
            overlayLayer.options.pane = 'overlayPane';
            overlayLayer.setOpacity(overlayOpacitySlider.value / 100);
            overlayLayer.addTo(map);
            
            localStorage.setItem('overlayMapType', radioInput.value);
        }, 0);
    }
    
    overlayMapTypeRadios.forEach(radio => {
        // Добавляем обработчик mousedown для мгновенного переключения на ПК (до отпускания кнопки мыши)
        radio.addEventListener('mousedown', function (e) {
            e.preventDefault(); // Предотвращаем стандартное поведение браузера
            handleOverlayRadioToggle(e.target);
        });
        
        // Добавляем обработчик touchstart на сам input
        radio.addEventListener('touchstart', function (e) {
            e.preventDefault(); // Предотвращаем стандартное поведение для мгновенного отклика
            handleOverlayRadioToggle(e.target);
        }, { passive: false });
        
        // Добавляем обработчик click для предотвращения стандартного поведения
        radio.addEventListener('click', function (e) {
            // Всегда предотвращаем стандартное поведение, так как уже обработали через mousedown/touchstart
            e.preventDefault();
            if (overlayRadioTouched.get(e.target)) {
                overlayRadioTouched.delete(e.target);
            }
        });
        
        // Обработчик change оставляем для случаев, когда состояние меняется программно
        radio.addEventListener('change', function (e) {
            // Выполняем тяжелые операции асинхронно, чтобы не блокировать визуальное обновление
            requestAnimationFrame(() => {
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
    });

    // Enable/disable overlay map
    // Добавляем обработчик touchstart для мгновенного визуального отклика на мобильных устройствах
    let overlayCheckboxTouched = false;
    enableOverlayCheckbox.addEventListener('touchstart', function (e) {
        overlayCheckboxTouched = true;
        // Мгновенно переключаем состояние чекбокса
        e.target.checked = !e.target.checked;
        // Принудительно обновляем DOM
        void e.target.offsetWidth;
        // Триггерим change событие сразу для немедленного выполнения логики
        e.target.dispatchEvent(new Event('change', { bubbles: true }));
    }, { passive: true });
    
    enableOverlayCheckbox.addEventListener('click', function (e) {
        // Если уже обработали через touchstart, предотвращаем стандартное поведение
        if (overlayCheckboxTouched) {
            e.preventDefault();
            overlayCheckboxTouched = false;
        }
    });
    
    enableOverlayCheckbox.addEventListener('change', function (e) {
        // Выполняем тяжелые операции асинхронно, чтобы не блокировать визуальное обновление
        requestAnimationFrame(() => {
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
    });

    // Overlay opacity control
    overlayOpacitySlider.addEventListener('input', function (e) {
        if (overlayLayer) {
            overlayLayer.setOpacity(e.target.value / 100);
            localStorage.setItem('overlayOpacity', e.target.value);
        }
    });

    // Enable/disable roads layer
    // Добавляем обработчик touchstart для мгновенного визуального отклика на мобильных устройствах
    let roadsCheckboxTouched = false;
    enableRoadsCheckbox.addEventListener('touchstart', function (e) {
        e.preventDefault(); // Предотвращаем стандартное поведение
        roadsCheckboxTouched = true;
        // Мгновенно переключаем состояние чекбокса (используем сам элемент, а не e.target)
        enableRoadsCheckbox.checked = !enableRoadsCheckbox.checked;
        // Принудительно обновляем DOM
        void enableRoadsCheckbox.offsetWidth;
        // Триггерим change событие сразу для немедленного выполнения логики
        enableRoadsCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    }, { passive: false });
    
    enableRoadsCheckbox.addEventListener('click', function (e) {
        // Если уже обработали через touchstart, предотвращаем стандартное поведение
        if (roadsCheckboxTouched) {
            e.preventDefault();
            roadsCheckboxTouched = false;
            return;
        }
    });
    
    enableRoadsCheckbox.addEventListener('change', function (e) {
        // Выполняем тяжелые операции асинхронно, чтобы не блокировать визуальное обновление
        requestAnimationFrame(() => {
            if (enableRoadsCheckbox.checked) {
                roadsControls.style.display = 'block';
                
                // Асинхронная загрузка слоя с задержкой для мобильных устройств
                setTimeout(() => {
                    roadsLayer = createOverlayLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
                        maxZoom: 19,
                        attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Map style: &copy; <a href="https://www.OpenRailwayMap.org">OpenRailwayMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
                    });
                    roadsLayer.setOpacity(roadsOpacitySlider.value / 100);
                    roadsLayer.addTo(map);
                    
                    // Даем слою время на инициализацию, затем принудительно обновляем размер карты
                    setTimeout(() => {
                        map.invalidateSize();
                    }, 100);
                }, 50);
                
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
    });

    // Roads opacity control
    roadsOpacitySlider.addEventListener('input', function (e) {
        if (roadsLayer) {
            roadsLayer.setOpacity(e.target.value / 100);
            localStorage.setItem('roadsOpacity', e.target.value);
        }
    });

    // Enable/disable borders layer
    // Добавляем обработчик touchstart для мгновенного визуального отклика на мобильных устройствах
    let bordersCheckboxTouched = false;
    enableBordersCheckbox.addEventListener('touchstart', function (e) {
        e.preventDefault(); // Предотвращаем стандартное поведение
        bordersCheckboxTouched = true;
        // Мгновенно переключаем состояние чекбокса (используем сам элемент, а не e.target)
        enableBordersCheckbox.checked = !enableBordersCheckbox.checked;
        // Принудительно обновляем DOM
        void enableBordersCheckbox.offsetWidth;
        // Триггерим change событие сразу для немедленного выполнения логики
        enableBordersCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    }, { passive: false });
    
    enableBordersCheckbox.addEventListener('click', function (e) {
        // Если уже обработали через touchstart, предотвращаем стандартное поведение
        if (bordersCheckboxTouched) {
            e.preventDefault();
            bordersCheckboxTouched = false;
            return;
        }
    });
    
    enableBordersCheckbox.addEventListener('change', function (e) {
        // Выполняем тяжелые операции асинхронно, чтобы не блокировать визуальное обновление
        requestAnimationFrame(() => {
            if (enableBordersCheckbox.checked) {
                bordersControls.style.display = 'block';
                
                // Асинхронная загрузка слоя с задержкой для мобильных устройств
                setTimeout(() => {
                    bordersLayer = createOverlayLayer('https://tiles.stadiamaps.com/tiles/stamen_toner_lines/{z}/{x}/{y}{r}.png?api_key=1e09df77-cc36-4be2-8ed9-6c5eaf3476ff', {
                        minZoom: 0,
                        maxZoom: 20,
                        attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.stamen.com/" target="_blank">Stamen Design</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    });
                    bordersLayer.setOpacity(bordersOpacitySlider.value / 100);
                    bordersLayer.addTo(map);
                    
                    setTimeout(() => {
                        map.invalidateSize();
                    }, 100);
                }, 50);
                
                localStorage.setItem('bordersEnabled', 'true');
            } else {
                bordersControls.style.display = 'none';
                
                if (bordersLayer) {
                    map.removeLayer(bordersLayer);
                    bordersLayer = null;
                }
                
                localStorage.setItem('bordersEnabled', 'false');
            }
        });
    });

    // Borders opacity control
    bordersOpacitySlider.addEventListener('input', function (e) {
        if (bordersLayer) {
            bordersLayer.setOpacity(e.target.value / 100);
            localStorage.setItem('bordersOpacity', e.target.value);
        }
    });

    // Enable/disable labels layer
    // Добавляем обработчик touchstart для мгновенного визуального отклика на мобильных устройствах
    let labelsCheckboxTouched = false;
    enableLabelsCheckbox.addEventListener('touchstart', function (e) {
        e.preventDefault(); // Предотвращаем стандартное поведение
        labelsCheckboxTouched = true;
        // Мгновенно переключаем состояние чекбокса (используем сам элемент, а не e.target)
        enableLabelsCheckbox.checked = !enableLabelsCheckbox.checked;
        // Принудительно обновляем DOM
        void enableLabelsCheckbox.offsetWidth;
        // Триггерим change событие сразу для немедленного выполнения логики
        enableLabelsCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    }, { passive: false });
    
    enableLabelsCheckbox.addEventListener('click', function (e) {
        // Если уже обработали через touchstart, предотвращаем стандартное поведение
        if (labelsCheckboxTouched) {
            e.preventDefault();
            labelsCheckboxTouched = false;
            return;
        }
    });
    
    enableLabelsCheckbox.addEventListener('change', function (e) {
        // Выполняем тяжелые операции асинхронно, чтобы не блокировать визуальное обновление
        requestAnimationFrame(() => {
            if (enableLabelsCheckbox.checked) {
                labelsControls.style.display = 'block';
                
                // Асинхронная загрузка слоя с задержкой для мобильных устройств
                setTimeout(() => {
                    labelsLayer = createOverlayLayer('https://tiles.stadiamaps.com/tiles/stamen_toner_labels/{z}/{x}/{y}{r}.png?api_key=1e09df77-cc36-4be2-8ed9-6c5eaf3476ff', {
                        minZoom: 0,
                        maxZoom: 20,
                        attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.stamen.com/" target="_blank">Stamen Design</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    });
                    labelsLayer.setOpacity(labelsOpacitySlider.value / 100);
                    labelsLayer.addTo(map);
                    
                    setTimeout(() => {
                        map.invalidateSize();
                    }, 100);
                }, 50);
                
                localStorage.setItem('labelsEnabled', 'true');
            } else {
                labelsControls.style.display = 'none';
                
                if (labelsLayer) {
                    map.removeLayer(labelsLayer);
                    labelsLayer = null;
                }
                
                localStorage.setItem('labelsEnabled', 'false');
            }
        });
    });

    // Labels opacity control
    labelsOpacitySlider.addEventListener('input', function (e) {
        if (labelsLayer) {
            labelsLayer.setOpacity(e.target.value / 100);
            localStorage.setItem('labelsOpacity', e.target.value);
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

    // Функция для принудительного обновления слоев (перезагрузка тайлов)
    function refreshOverlayLayers() {
        // Используем refresh() вместо redraw() - это заставит перезагрузить тайлы
        if (roadsLayer && map.hasLayer(roadsLayer)) {
            roadsLayer.refresh();
        }
        if (bordersLayer && map.hasLayer(bordersLayer)) {
            bordersLayer.refresh();
        }
        if (labelsLayer && map.hasLayer(labelsLayer)) {
            labelsLayer.refresh();
        }
    }

    // Добавляем обработчики для обновления слоев при движении карты
    // Используем debounce для оптимизации
    let refreshTimeout;
    
    map.on('moveend', function() {
        clearTimeout(refreshTimeout);
        refreshTimeout = setTimeout(() => {
            refreshOverlayLayers();
        }, 300);
    });

    map.on('zoomend', function() {
        clearTimeout(refreshTimeout);
        refreshTimeout = setTimeout(() => {
            refreshOverlayLayers();
        }, 300);
    });

    // Handle window resize for mobile devices to ensure proper tile loading
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
            map.invalidateSize();
            setTimeout(function() {
                refreshOverlayLayers();
            }, 300);
        }, 250);
    });

    // Also handle orientation change on mobile devices
    window.addEventListener('orientationchange', function() {
        setTimeout(function() {
            map.invalidateSize();
            setTimeout(function() {
                refreshOverlayLayers();
            }, 300);
        }, 500);
    });



    

    
    // Route building functionality
    let routePoints = [];
    let routePolyline = null;
    let routeMarkers = [];
    let isBuildingRoute = false;
    let isCalculatingRoute = false;
    let routeHoverMarker = null; // Marker for map hover sync
    let currentRouteData = []; // To store data for export
    let currentSampleStep = 50; // Default step in meters
    let routeHoverPolyline = null; // Wide invisible polyline for capturing mouse events
    let routeLineColor = 'darkorange'; // Default route line color
    
    // Chart elements for route-to-chart interaction
    let chartHoverGroup = null;
    let chartHoverCircle = null;
    let chartTooltipRect = null;
    let chartTooltipText1 = null;
    let chartTooltipText2 = null;
    
    // Get DOM elements
    const buildRouteBtn = document.getElementById('build-route-btn');
    const cancelRouteBtn = document.getElementById('cancel-route-btn');
    const calculateRouteBtn = document.getElementById('calculate-route-btn');
    const routeSubmenu = document.getElementById('route-submenu');
    const routeControl = document.getElementById('route-control');
    const pointsControl = document.getElementById('points-control');
    const measureControl = document.getElementById('measure-control');
    const elevationProfile = document.getElementById('elevation-profile');
    const profileCloseBtn = document.getElementById('profile-close-btn');
    const exportRouteBtn = document.getElementById('export-route-btn');
    const importRouteBtn = document.getElementById('import-route-btn');
    const csvImporter = document.getElementById('csv-importer');
    
    // Function to update points control position based on route submenu state
    function updatePointsControlPosition() {
        // Calculate the distance between "Измерить расстояние" and "Построить маршрут"
        const measureControlTop = parseInt(measureControl.style.top) || 10;
        const measureControlHeight = measureControl.offsetHeight;
        const measureControlBottom = measureControlTop + measureControlHeight;
        
        const routeControlTop = parseInt(routeControl.style.top) || 60;
        const distanceBetweenMeasureAndRoute = routeControlTop - measureControlBottom;
        
        // Calculate route control bottom (including submenu if visible)
        let routeControlHeight = buildRouteBtn.offsetHeight;
        const submenuStyle = window.getComputedStyle(routeSubmenu);
        if (submenuStyle.display !== 'none') {
            routeControlHeight += routeSubmenu.offsetHeight;
            const marginTop = parseInt(submenuStyle.marginTop) || 0;
            routeControlHeight += marginTop;
        }
        const routeControlBottom = routeControlTop + routeControlHeight;
        
        // Apply the same distance between route control and points control
        const newTop = routeControlBottom + distanceBetweenMeasureAndRoute;
        pointsControl.style.top = newTop + 'px';
    }
    
    // Initialize points control position on page load
    setTimeout(updatePointsControlPosition, 0);
    
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
    
    // Initialize route color buttons in side menu
    function initializeRouteColorButtons() {
        const colorButtonsContainer = document.getElementById('route-color-buttons-container');
        if (!colorButtonsContainer) {
            return;
        }
        // Only initialize if not already created
        if (colorButtonsContainer.querySelector('.route-color-btn')) {
            return;
        }

        // Create color selection buttons container
        colorButtonsContainer.style.display = 'flex';
        colorButtonsContainer.style.gap = '5px';
        colorButtonsContainer.style.alignItems = 'center';

        // Orange line button
        const orangeBtn = document.createElement('button');
        orangeBtn.className = 'route-color-btn';
        orangeBtn.setAttribute('data-color', 'darkorange');
        orangeBtn.title = 'Оранжевая линия (для темных карт)';
        
        // Create SVG icon for orange line
        const orangeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        orangeSvg.setAttribute('width', '20');
        orangeSvg.setAttribute('height', '20');
        orangeSvg.setAttribute('viewBox', '0 0 24 24');
        orangeSvg.style.display = 'block';
        const orangeLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        orangeLine.setAttribute('x1', '2');
        orangeLine.setAttribute('y1', '12');
        orangeLine.setAttribute('x2', '22');
        orangeLine.setAttribute('y2', '12');
        orangeLine.setAttribute('stroke', 'darkorange');
        orangeLine.setAttribute('stroke-width', '3');
        orangeLine.setAttribute('stroke-linecap', 'round');
        orangeSvg.appendChild(orangeLine);
        orangeBtn.appendChild(orangeSvg);

        // Gray line button
        const grayBtn = document.createElement('button');
        grayBtn.className = 'route-color-btn';
        grayBtn.setAttribute('data-color', '#34353e');
        grayBtn.title = 'Серая линия (для светлых карт)';
        
        // Create SVG icon for gray line
        const graySvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        graySvg.setAttribute('width', '20');
        graySvg.setAttribute('height', '20');
        graySvg.setAttribute('viewBox', '0 0 24 24');
        graySvg.style.display = 'block';
        const grayLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        grayLine.setAttribute('x1', '2');
        grayLine.setAttribute('y1', '12');
        grayLine.setAttribute('x2', '22');
        grayLine.setAttribute('y2', '12');
        grayLine.setAttribute('stroke', '#34353e');
        grayLine.setAttribute('stroke-width', '3');
        grayLine.setAttribute('stroke-linecap', 'round');
        graySvg.appendChild(grayLine);
        grayBtn.appendChild(graySvg);

        // Set initial active state based on current routeLineColor
        if (routeLineColor === '#34353e') {
            grayBtn.classList.add('active');
        } else {
            orangeBtn.classList.add('active');
        }

        // Add click handlers
        orangeBtn.addEventListener('click', function() {
            routeLineColor = 'darkorange';
            if (routePolyline) {
                routePolyline.setStyle({ color: routeLineColor });
            }
            // Update active state
            grayBtn.classList.remove('active');
            orangeBtn.classList.add('active');
        });

        grayBtn.addEventListener('click', function() {
            routeLineColor = '#34353e';
            if (routePolyline) {
                routePolyline.setStyle({ color: routeLineColor });
            }
            // Update active state
            orangeBtn.classList.remove('active');
            grayBtn.classList.add('active');
        });

        colorButtonsContainer.appendChild(orangeBtn);
        colorButtonsContainer.appendChild(grayBtn);
    }

    // Initialize profile header with title
    function initializeProfileHeader() {
        const titleWrapper = document.getElementById('profile-title-wrapper');
        // Only initialize if not already created
        if (titleWrapper.querySelector('.profile-title-container')) {
            return;
        }

        // Check if mobile (screen width < 768px) or very small (< 480px)
        const isMobile = window.innerWidth < 768;
        const isVerySmall = window.innerWidth < 480;

        // Create title container for flex layout
        const titleContainer = document.createElement('div');
        titleContainer.className = 'profile-title-container';
        titleContainer.style.display = 'flex';
        titleContainer.style.alignItems = 'center';
        titleContainer.style.gap = '10px';
        titleContainer.style.flexWrap = 'wrap';

        if (isMobile) {
            // Mobile: two lines
            const titleTextContainer = document.createElement('div');
            const h3 = document.createElement('h3');
            h3.className = 'profile-title';
            h3.id = 'profile-title-h3';
            h3.textContent = `Профиль высоты маршрута`;
            titleTextContainer.appendChild(h3);

            const subtitle = document.createElement('div');
            subtitle.className = 'profile-subtitle';
            subtitle.id = 'profile-subtitle';
            subtitle.textContent = `(Шаг ${currentSampleStep}м, вычисление...)`;
            titleTextContainer.appendChild(subtitle);
            
            titleContainer.appendChild(titleTextContainer);
        } else {
            // Desktop/Tablet: one line
            const h3 = document.createElement('h3');
            h3.className = 'profile-title';
            h3.id = 'profile-title-h3';
            h3.textContent = `Профиль высоты маршрута (шаг ${currentSampleStep}м, вычисление...)`;
            titleContainer.appendChild(h3);
        }

        titleWrapper.appendChild(titleContainer);
    }

    function buildElevationProfile(elevationData) {
        // Update title text if header already exists, otherwise initialize it
        const titleH3 = document.getElementById('profile-title-h3');
        const subtitle = document.getElementById('profile-subtitle');
        
        // Check if mobile (screen width < 768px) or very small (< 480px)
        const isMobile = window.innerWidth < 768;
        const isVerySmall = window.innerWidth < 480;

        if (titleH3) {
            // Update existing title
            if (isMobile) {
                if (subtitle) {
                    subtitle.textContent = `(Шаг ${currentSampleStep}м, ${elevationData.length} точек)`;
                }
            } else {
                titleH3.textContent = `Профиль высоты маршрута (шаг ${currentSampleStep}м, ${elevationData.length} точек)`;
            }
        } else {
            // Initialize header if it doesn't exist
            initializeProfileHeader();
            // Update title after initialization
            const updatedTitleH3 = document.getElementById('profile-title-h3');
            const updatedSubtitle = document.getElementById('profile-subtitle');
            if (updatedTitleH3) {
                if (isMobile) {
                    if (updatedSubtitle) {
                        updatedSubtitle.textContent = `(Шаг ${currentSampleStep}м, ${elevationData.length} точек)`;
                    }
                } else {
                    updatedTitleH3.textContent = `Профиль высоты маршрута (шаг ${currentSampleStep}м, ${elevationData.length} точек)`;
                }
            }
        }

        const chartContainer = document.getElementById('profile-chart');
        chartContainer.innerHTML = ''; // Clear previous chart

        const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgNode.setAttribute('width', '100%');
        svgNode.setAttribute('height', '100%');
        chartContainer.appendChild(svgNode);

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

        // Уменьшенные отступы для всех устройств
        const margin = isVerySmall
            ? { top: 5, right: 5, bottom: 25, left: 55 }
            : isMobile 
                ? { top: 10, right: 10, bottom: 30, left: 65 }
                : { top: 10, right: 20, bottom: 20, left: 50 };
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

        waypoints.forEach((point, index) => {
            const x = xScale(point.distance);
            const isLastWaypoint = index === waypoints.length - 1;
            
            const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            textNode.setAttribute('x', x);
            textNode.setAttribute('y', height - margin.bottom + 15);
            textNode.setAttribute('fill', 'darkorange');
            textNode.setAttribute('font-size', '12');
            // Последнюю метку выравниваем по правому краю
            textNode.setAttribute('text-anchor', isLastWaypoint ? 'end' : 'middle');
            textNode.textContent = `${point.distance.toFixed(1)} км`;
            
            svgNode.appendChild(textNode);
            
            const bbox = textNode.getBBox();
            const currentLabelStartX = isLastWaypoint ? (x - bbox.width) : (x - bbox.width / 2);
            
            if (currentLabelStartX < lastLabelEndX) {
                svgNode.removeChild(textNode);
            } else {
                lastLabelEndX = isLastWaypoint ? x : (x + bbox.width / 2 + labelPadding);
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
        
        // Save references to global variables for route-to-chart interaction
        chartHoverGroup = hoverGroup;
        chartHoverCircle = hoverCircle;
        chartTooltipRect = tooltipRect;
        chartTooltipText1 = tooltipText1;
        chartTooltipText2 = tooltipText2;

        const handleInteraction = (clientX) => {
            const rect = svgNode.getBoundingClientRect();
            const mouseX = clientX - rect.left;

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
            const topPadding = padding;        // Отступ сверху
            const bottomPadding = padding + 6; // Отступ снизу (на 2 больше, чтобы уравновесить)
            const horizontalPadding = padding;
            
            const bbox1 = tooltipText1.getBBox();
            const bbox2 = tooltipText2.getBBox();
            const tooltipWidth = Math.max(bbox1.width, bbox2.width) + 2 * horizontalPadding;
            const tooltipHeight = bbox1.height + bbox2.height + topPadding + bottomPadding;

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
            
            textX = tooltipX + horizontalPadding;
            textY1 = tooltipY + topPadding + bbox1.height - 2;
            textY2 = tooltipY + topPadding + bbox1.height + bbox2.height + 2; // Позиция второго текста с учетом нижнего отступа

            tooltipRect.setAttribute('x', tooltipX);
            tooltipRect.setAttribute('y', tooltipY);
            tooltipRect.setAttribute('width', tooltipWidth);
            tooltipRect.setAttribute('height', tooltipHeight);

            tooltipText1.setAttribute('x', textX);
            tooltipText1.setAttribute('y', textY1);
            tooltipText2.setAttribute('x', textX);
            tooltipText2.setAttribute('y', textY2);
        };

        const hideInteraction = () => {
            hoverGroup.style.display = 'none';
            if (routeHoverMarker) {
                routeHoverMarker.setStyle({ opacity: 0, fillOpacity: 0 });
            }
        };

        // Mouse events (desktop)
        svgNode.addEventListener('mousemove', (event) => {
            handleInteraction(event.clientX);
        });

        svgNode.addEventListener('mouseleave', hideInteraction);

        // Touch events (mobile)
        svgNode.addEventListener('touchstart', (event) => {
            if (event.touches.length > 0) {
                handleInteraction(event.touches[0].clientX);
            }
        }, { passive: true });

        svgNode.addEventListener('touchmove', (event) => {
            if (event.touches.length > 0) {
                handleInteraction(event.touches[0].clientX);
            }
        }, { passive: true });

        svgNode.addEventListener('touchend', hideInteraction, { passive: true });
        svgNode.addEventListener('touchcancel', hideInteraction, { passive: true });
    }
    
    // Setup route hover interactions (from route to chart)
    function setupRouteToChartInteraction(elevationData) {
        if (!routePolyline || !elevationData || elevationData.length < 2) return;
        
        const chartContainer = document.getElementById('profile-chart');
        const svgNode = chartContainer.querySelector('svg');
        if (!svgNode) return;
        
        const { width, height } = svgNode.getBoundingClientRect();
        const isMobile = window.innerWidth < 768;
        const isVerySmall = window.innerWidth < 480;
        const margin = isVerySmall
            ? { top: 5, right: 5, bottom: 25, left: 55 }
            : isMobile 
                ? { top: 10, right: 10, bottom: 30, left: 65 }
                : { top: 10, right: 20, bottom: 20, left: 50 };
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;
        
        const elevations = elevationData.map(d => d.elevation);
        const minElev = Math.min(...elevations);
        const maxElev = Math.max(...elevations);
        const maxDist = Math.max(...elevationData.map(d => d.distance));
        const elevationRange = maxElev - minElev;
        
        let yScale;
        if (elevationRange === 0 || !isFinite(elevationRange)) {
            yScale = (elev) => margin.top + chartHeight / 2;
        } else {
            yScale = (elev) => margin.top + chartHeight - ((elev - minElev) / elevationRange) * chartHeight;
        }
        const xScale = (dist) => margin.left + (dist / maxDist) * chartWidth;
        
        // Get existing hover elements from the chart - use global references
        function getChartElements() {
            return {
                hoverGroup: chartHoverGroup,
                hoverCircle: chartHoverCircle,
                tooltipRect: chartTooltipRect,
                tooltipText1: chartTooltipText1,
                tooltipText2: chartTooltipText2
            };
        }
        
        // Helper function to find closest point on segment using perpendicular projection
        function findClosestPointOnRoute(latlng) {
            let minDistance = Infinity;
            let closestIndex = 0;
            let closestFraction = 0;
            
            const mouseLat = latlng.lat;
            const mouseLng = latlng.lng;
            
            // Search through all segments
            for (let i = 0; i < elevationData.length - 1; i++) {
                const p1Lat = elevationData[i].lat;
                const p1Lng = elevationData[i].lng;
                const p2Lat = elevationData[i + 1].lat;
                const p2Lng = elevationData[i + 1].lng;
                
                // Calculate the bearing from p1 to p2
                const segmentBearing = calculateBearing(p1Lat, p1Lng, p2Lat, p2Lng);
                const p1LatLng = L.latLng(p1Lat, p1Lng);
                const p2LatLng = L.latLng(p2Lat, p2Lng);
                const segmentDistance = p1LatLng.distanceTo(p2LatLng);
                
                // Calculate bearing from p1 to mouse point
                const bearingToMouse = calculateBearing(p1Lat, p1Lng, mouseLat, mouseLng);
                
                // Calculate the angle between the segment direction and direction to mouse point
                let angleDiff = bearingToMouse - segmentBearing;
                // Normalize the angle difference to [-π, π]
                angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
                
                // Calculate how far along the segment is the closest point
                // Using the law of cosines in spherical geometry
                const distToMouse = p1LatLng.distanceTo(latlng);
                
                // Project the distance to the segment
                let projectedDistance = distToMouse * Math.cos(angleDiff);
                
                // Calculate the fraction along the segment
                let fraction;
                if (segmentDistance > 0) {
                    fraction = projectedDistance / segmentDistance;
                    // Clamp the fraction to [0, 1] to stay within the segment
                    fraction = Math.max(0, Math.min(1, fraction));
                } else {
                    fraction = 0; // Degenerate segment
                }
                
                // Calculate the perpendicular point on the segment
                const closestPoint = calculateDestinationPoint(p1Lat, p1Lng, segmentBearing, segmentDistance * fraction);
                
                // Calculate distance from mouse point to the closest point on the segment
                const distance = latlng.distanceTo(L.latLng(closestPoint.lat, closestPoint.lng));
                
                if (distance < minDistance) {
                    minDistance = distance;
                    closestIndex = i;
                    closestFraction = fraction;
                }
            }
            
            // Return the interpolated point and associated data
            const p1 = elevationData[closestIndex];
            const p2 = elevationData[closestIndex + 1];
            const p1LatLng = L.latLng(p1.lat, p1.lng);
            const p2LatLng = L.latLng(p2.lat, p2.lng);
            
            const segmentBearing = calculateBearing(p1.lat, p1.lng, p2.lat, p2.lng);
            const segmentDistance = p1LatLng.distanceTo(p2LatLng);
            const finalPoint = calculateDestinationPoint(p1.lat, p1.lng, segmentBearing, segmentDistance * closestFraction);
            
            return {
                lat: finalPoint.lat,
                lng: finalPoint.lng,
                elevation: p1.elevation + closestFraction * (p2.elevation - p1.elevation),
                distance: p1.distance + closestFraction * (p2.distance - p1.distance)
            };
        }
        
        // Update chart display
        function updateChartDisplay(pointData) {
            const elements = getChartElements();
            
            if (!elements || !elements.hoverGroup || !elements.hoverCircle || !elements.tooltipRect || !elements.tooltipText1 || !elements.tooltipText2) {
                return;
            }
            
            elements.hoverGroup.style.display = 'block';
            
            const x = xScale(pointData.distance);
            const y = yScale(pointData.elevation);
            
            elements.hoverCircle.setAttribute('cx', x);
            elements.hoverCircle.setAttribute('cy', y);
            
            elements.tooltipText1.textContent = `Высота: ${pointData.elevation.toFixed(0)} м`;
            elements.tooltipText2.textContent = `Расстояние: ${pointData.distance.toFixed(2)} км`;
            
            const padding = 5;
            const topPadding = padding;        // Отступ сверху
            const bottomPadding = padding + 6; // Отступ снизу (на 2 больше, чтобы уравновесить)
            const horizontalPadding = padding;
            
            const bbox1 = elements.tooltipText1.getBBox();
            const bbox2 = elements.tooltipText2.getBBox();
            const tooltipWidth = Math.max(bbox1.width, bbox2.width) + 2 * horizontalPadding;
            const tooltipHeight = bbox1.height + bbox2.height + topPadding + bottomPadding;
            
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
            
            textX = tooltipX + horizontalPadding;
            textY1 = tooltipY + topPadding + bbox1.height - 2;
            textY2 = tooltipY + topPadding + bbox1.height + bbox2.height + 2; // Позиция второго текста с учетом нижнего отступа
            
            elements.tooltipRect.setAttribute('x', tooltipX);
            elements.tooltipRect.setAttribute('y', tooltipY);
            elements.tooltipRect.setAttribute('width', tooltipWidth);
            elements.tooltipRect.setAttribute('height', tooltipHeight);
            
            elements.tooltipText1.setAttribute('x', textX);
            elements.tooltipText1.setAttribute('y', textY1);
            elements.tooltipText2.setAttribute('x', textX);
            elements.tooltipText2.setAttribute('y', textY2);
        }
        
        // Cache for previous position to prevent excessive updates
        let lastHoverPosition = null;
        // Minimum distance threshold (in meters) to update the marker position
        const MIN_UPDATE_DISTANCE = 10; // 10 meters minimum movement before updating
        
        // Handle route hover
        function handleRouteHover(e) {
            const latlng = e.latlng;
            const pointData = findClosestPointOnRoute(latlng);
            
            // Check if we should update the marker position based on distance threshold
            let shouldUpdate = true;
            if (lastHoverPosition) {
                const distanceMoved = L.latLng(pointData.lat, pointData.lng).distanceTo(
                    L.latLng(lastHoverPosition.lat, lastHoverPosition.lng)
                );
                shouldUpdate = distanceMoved >= MIN_UPDATE_DISTANCE;
            }
            
            if (shouldUpdate) {
                // Update marker on route
                if (routeHoverMarker) {
                    routeHoverMarker.setLatLng([pointData.lat, pointData.lng]);
                    routeHoverMarker.setStyle({ opacity: 1, fillOpacity: 0.8 });
                }
                
                // Update chart display
                updateChartDisplay(pointData);
                
                // Save the current position as the last position
                lastHoverPosition = { lat: pointData.lat, lng: pointData.lng, distance: pointData.distance };
            }
        }
        
        function hideRouteHover() {
            if (routeHoverMarker) {
                routeHoverMarker.setStyle({ opacity: 0, fillOpacity: 0 });
            }
            // Reset the cache when hiding the hover
            lastHoverPosition = null;
            const elements = getChartElements();
            if (elements && elements.hoverGroup) {
                elements.hoverGroup.style.display = 'none';
            }
        }
        
        // Create wide invisible polyline for event capture (40px width) using geodesic segments
        if (routeHoverPolyline) {
            map.removeLayer(routeHoverPolyline);
        }
        
        // Generate geodesic points for the hover polyline to match the displayed route
        let geodesicHoverPoints = [];
        
        for (let i = 0; i < routePoints.length - 1; i++) {
            const startPoint = routePoints[i];
            const endPoint = routePoints[i + 1];
            
            // Generate intermediate points for this segment
            const segmentPoints = generateGeodesicPoints(startPoint, endPoint);
            
            if (i === 0) {
                // For the first segment, include all points
                geodesicHoverPoints = [...segmentPoints];
            } else {
                // For subsequent segments, skip the first point to avoid duplication
                geodesicHoverPoints = [...geodesicHoverPoints, ...segmentPoints.slice(1)];
            }
        }
        
        routeHoverPolyline = L.polyline(geodesicHoverPoints, {
            color: 'transparent',
            weight: 40,
            opacity: 0,
            interactive: true,
            pane: 'routeHoverPane'
        }).addTo(map);
        
        // Attach event listeners
        routeHoverPolyline.on('mousemove', handleRouteHover);
        routeHoverPolyline.on('touchmove', handleRouteHover);
        routeHoverPolyline.on('touchstart', handleRouteHover);
        
        routeHoverPolyline.on('mouseleave', hideRouteHover);
        routeHoverPolyline.on('touchend', hideRouteHover);
        routeHoverPolyline.on('touchcancel', hideRouteHover);
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
        
        // Show calculate button in submenu if we have at least 2 points
        if (routePoints.length >= 2) {
            calculateRouteBtn.style.display = 'block';
        } else {
            calculateRouteBtn.style.display = 'none';
        }
        
        // Update build route button active state
        updateBuildRouteButtonState();
        
        // Update points control position after button visibility change
        setTimeout(updatePointsControlPosition, 0);
    }
    
    // Function to generate intermediate points along a geodesic line
    function generateGeodesicPoints(startPoint, endPoint, maxSegmentDistance = 1000) { // max segment distance in meters
        const points = [startPoint]; // Start with the initial point
        
        // Calculate total distance between points
        const totalDistance = startPoint.distanceTo(endPoint);
        
        // If distance is less than max segment distance, return start and end points
        if (totalDistance <= maxSegmentDistance || totalDistance === 0) {
            if (points.length === 1) points.push(endPoint);
            return points;
        }
        
        // Calculate bearing from start to end point
        const bearing = calculateBearing(startPoint.lat, startPoint.lng, endPoint.lat, endPoint.lng);
        
        // Calculate number of segments needed
        const numSegments = Math.ceil(totalDistance / maxSegmentDistance);
        const segmentDistance = totalDistance / numSegments;
        
        // Generate intermediate points along the geodesic
        for (let i = 1; i < numSegments; i++) {
            const distance = segmentDistance * i;
            const intermediatePoint = calculateDestinationPoint(startPoint.lat, startPoint.lng, bearing, distance);
            points.push(L.latLng(intermediatePoint.lat, intermediatePoint.lng));
        }
        
        // Add the end point
        points.push(endPoint);
        
        return points;
    }
    
    // Update route polyline with geodesic segments
    function updateRoutePolyline() {
        // Remove existing polyline
        if (routePolyline) {
            map.removeLayer(routePolyline);
        }
        
        // Create new polyline if we have points
        if (routePoints.length > 0) {
            // For geodesic polyline, we need to create segments with intermediate points
            let geodesicPoints = [];
            
            for (let i = 0; i < routePoints.length - 1; i++) {
                const startPoint = routePoints[i];
                const endPoint = routePoints[i + 1];
                
                // Generate intermediate points for this segment
                const segmentPoints = generateGeodesicPoints(startPoint, endPoint);
                
                if (i === 0) {
                    // For the first segment, include all points
                    geodesicPoints = [...segmentPoints];
                } else {
                    // For subsequent segments, skip the first point to avoid duplication
                    geodesicPoints = [...geodesicPoints, ...segmentPoints.slice(1)];
                }
            }
            
            routePolyline = L.polyline(geodesicPoints, {
                color: routeLineColor,
                weight: 3,
                opacity: 0.7
            }).addTo(map);
        }
    }
    
    // Helper functions for geodesic calculations
    function toRadians(degrees) {
        return degrees * Math.PI / 180;
    }
    
    function toDegrees(radians) {
        return radians * 180 / Math.PI;
    }
    
    // Calculate bearing from point A to point B
    function calculateBearing(latA, lngA, latB, lngB) {
        const φ1 = toRadians(latA);
        const φ2 = toRadians(latB);
        const Δλ = toRadians(lngB - lngA);
        
        const y = Math.sin(Δλ) * Math.cos(φ2);
        const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
        const θ = Math.atan2(y, x);
        
        return (toDegrees(θ) + 360) % 360; // Normalize to 0-360
    }
    
    // Calculate destination point given start point, bearing, and distance
    function calculateDestinationPoint(lat, lng, bearing, distanceMeters) {
        const R = 6371000; // Earth's radius in meters
        const δ = distanceMeters / R; // Angular distance
        const θ = toRadians(bearing);
        
        const φ1 = toRadians(lat);
        const λ1 = toRadians(lng);
        
        const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
        const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
        
        return {
            lat: toDegrees(φ2),
            lng: toDegrees(λ2)
        };
    }

    async function calculateRouteElevation() {
        if (routePoints.length < 2) return;

        isCalculatingRoute = true;
        updateBuildRouteButtonState();
        map.off('click', onMapClickForRoute);

        // Initialize profile header with title and color buttons before showing the profile
        initializeProfileHeader();

        const chartContainer = document.getElementById('profile-chart');
        chartContainer.innerHTML = `
            <div class="loading-container">
                <div class="loading-text">Построение профиля высоты...</div>
                <div class="progress-container">
                    <div class="progress-bar" id="progress-bar"></div>
                </div>
            </div>
        `;

        // Get the progress bar element
        const progressBar = document.getElementById('progress-bar');
        elevationProfile.classList.add('visible');
        
        // Use setTimeout to allow the UI to update before starting the main processing
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const SAMPLE_INTERVAL_KM = currentSampleStep / 1000; // Convert meters to kilometers
        const elevationData = [];
        let cumulativeDist = 0;

        // Calculate total distance of the route for more accurate progress tracking
        let totalRouteDistance = 0;
        for (let i = 0; i < routePoints.length - 1; i++) {
            totalRouteDistance += routePoints[i].distanceTo(routePoints[i+1]) / 1000; // Convert to km
        }

        // Add the very first point
        elevationData.push({ 
            distance: 0, 
            lat: routePoints[0].lat, 
            lng: routePoints[0].lng, 
            isWaypoint: true 
        });

        // 1. Generate consistently spaced points along the entire route polyline
        let totalExpectedPoints = 0;
        // Calculate approximate total expected points
        for (let i = 0; i < routePoints.length - 1; i++) {
            const segmentDist = routePoints[i].distanceTo(routePoints[i+1]) / 1000;
            const pointsInSegment = Math.ceil(segmentDist / SAMPLE_INTERVAL_KM);
            totalExpectedPoints += pointsInSegment;
        }
        
        let currentPointIndex = 0;

        for (let i = 0; i < routePoints.length - 1; i++) {
            const startPoint = routePoints[i];
            const endPoint = routePoints[i+1];
            const segmentDist = startPoint.distanceTo(endPoint) / 1000;
            const segmentEndDist = cumulativeDist + segmentDist;

            // Determine the distance of the next sample point
            let nextSampleDist = (Math.floor(cumulativeDist / SAMPLE_INTERVAL_KM) + 1) * SAMPLE_INTERVAL_KM;

            // Add intermediate sample points within the current segment
            while (nextSampleDist < segmentEndDist) {
                // Use proper geodesic interpolation to get point exactly on the route line
                // Calculate the distance from start in meters
                const distanceFromStart = (nextSampleDist - cumulativeDist) * 1000; // km to meters
                const bearing = calculateBearing(startPoint.lat, startPoint.lng, endPoint.lat, endPoint.lng);
                const intermediatePoint = calculateDestinationPoint(startPoint.lat, startPoint.lng, bearing, distanceFromStart);
                
                elevationData.push({ 
                    distance: nextSampleDist, 
                    lat: intermediatePoint.lat, 
                    lng: intermediatePoint.lng, 
                    isWaypoint: false 
                });

                nextSampleDist += SAMPLE_INTERVAL_KM;
                
                // Update progress based on number of points generated (0% to 30%)
                currentPointIndex++;
                const progress = Math.min(30, Math.floor((currentPointIndex / totalExpectedPoints) * 30));
                progressBar.style.width = `${progress}%`;
                
                // Allow the UI to update by yielding control back to the browser
                if (currentPointIndex % 50 === 0) { // Update UI every 50 points
                    await new Promise(resolve => setTimeout(resolve, 1));
                }
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
        // This step will take 30% to 80% of the progress (50% total)
        try {
            progressBar.style.width = '30%';
            await new Promise(resolve => setTimeout(resolve, 10));

            // Make the request to the server
            const response = await fetch(`${API_URL}/api/get_elevation`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ points: pointsToQuery })
            });

            if (response.status === 401) {
                // Токен невалидный - удаляем и перенаправляем на вход
                localStorage.removeItem('auth_token');
                window.location.href = 'login.html';
                return;
            }

            if (!response.ok) {
                throw new Error(`Server error: ${response.statusText}`);
            }

            const data = await response.json();
            const realElevations = data.elevations;

            // Update progress to 80% after receiving data
            progressBar.style.width = '80%';
            await new Promise(resolve => setTimeout(resolve, 10));
            
            // 4. Populate elevationData with real elevations and handle negative values
            if (realElevations.length === uniqueElevationData.length) {
                // First pass: assign elevations, mark negative as null (invalid SRTM data)
                for (let i = 0; i < uniqueElevationData.length; i++) {
                    const elev = realElevations[i];
                    uniqueElevationData[i].elevation = (elev < 0) ? null : elev;
                    
                    // Update progress during the first pass of processing (80% to 90%)
                    const progress = 80 + Math.floor((i / uniqueElevationData.length) * 10);
                    progressBar.style.width = `${Math.min(90, progress)}%`;
                    
                    // Allow the UI to update periodically
                    if (i % 50 === 0) { // Update UI every 50 points
                        await new Promise(resolve => setTimeout(resolve, 1));
                    }
                }
                
                // Second pass: interpolate null values with smart strategy
                for (let i = 0; i < uniqueElevationData.length; i++) {
                    if (uniqueElevationData[i].elevation === null) {
                        // Find previous valid value
                        let prevVal = null;
                        let prevIdx = null;
                        for (let j = i - 1; j >= 0; j--) {
                            if (uniqueElevationData[j].elevation !== null) {
                                prevVal = uniqueElevationData[j].elevation;
                                prevIdx = j;
                                break;
                            }
                        }
                        
                        // Find next valid value
                        let nextVal = null;
                        let nextIdx = null;
                        for (let j = i + 1; j < uniqueElevationData.length; j++) {
                            if (uniqueElevationData[j].elevation !== null) {
                                nextVal = uniqueElevationData[j].elevation;
                                nextIdx = j;
                                break;
                            }
                        }
                        
                        // Smart interpolation strategy
                        if (prevVal !== null && nextVal !== null) {
                            // Check if we're in a low-elevation area (likely water)
                            // If both neighbors are very low (< 5m), use 0 (sea level)
                            if (prevVal < 5 && nextVal < 5) {
                                uniqueElevationData[i].elevation = 0;
                            } else {
                                // Linear interpolation for normal terrain
                                const weight = (i - prevIdx) / (nextIdx - prevIdx);
                                uniqueElevationData[i].elevation = prevVal + (nextVal - prevVal) * weight;
                            }
                        } else if (prevVal !== null) {
                            // Use previous value, but if it's very low, use 0
                            uniqueElevationData[i].elevation = (prevVal < 5) ? 0 : prevVal;
                        } else if (nextVal !== null) {
                            // Use next value, but if it's very low, use 0
                            uniqueElevationData[i].elevation = (nextVal < 5) ? 0 : nextVal;
                        } else {
                            // No valid values at all - use 0 (sea level)
                            uniqueElevationData[i].elevation = 0;
                        }
                    }
                    
                    // Update progress during the second pass of processing (90% to 100%)
                    const progress = 90 + Math.floor((i / uniqueElevationData.length) * 10);
                    progressBar.style.width = `${Math.min(100, progress)}%`;
                    
                    // Allow the UI to update periodically
                    if (i % 50 === 0) { // Update UI every 50 points
                        await new Promise(resolve => setTimeout(resolve, 1));
                    }
                }
            } else {
                throw new Error('Mismatch between requested points and received elevations.');
            }

            // Update progress - 100% after processing data
            progressBar.style.width = '100%';
            
            // Store data for export and build the chart
            currentRouteData = uniqueElevationData;
            buildElevationProfile(uniqueElevationData);
            
            // Setup route to chart interaction
            setupRouteToChartInteraction(uniqueElevationData);

        } catch (error) {
            chartContainer.innerHTML = `
                <div class="loading-container">
                    <div class="error-message">Ошибка при загрузке данных о высоте.<br>Обратитесь к разработчику.</div>
                </div>
            `;
        }
    }
    
    async function exportRouteToCSV() {
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

        // Сохраняем зашифрованные данные в localStorage
        try {
            await saveEncryptedToLocalStorage('saved_route', {
                data: dataToExport,
                step: currentSampleStep,
                timestamp: new Date().toISOString()
            });
            console.log('Маршрут сохранен в localStorage (зашифрован)');
        } catch (error) {
            console.error('Не удалось сохранить маршрут в localStorage:', error);
            // Продолжаем экспорт в файл даже если сохранение в localStorage не удалось
        }

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
        
        if (routeHoverPolyline) {
            routeHoverPolyline.off('mousemove touchmove touchstart mouseleave touchend touchcancel');
            map.removeLayer(routeHoverPolyline);
            routeHoverPolyline = null;
        }

        if (routeHoverMarker) {
            map.removeLayer(routeHoverMarker);
            routeHoverMarker = null;
        }

        routePoints.length = 0;
        currentRouteData = []; // Clear exported data
        isCalculatingRoute = false;
        updateBuildRouteButtonState();

        // Remove active state from calculate route button when profile closes
        calculateRouteBtn.classList.remove('active');
        routeSubmenu.style.display = 'none';
        elevationProfile.classList.remove('visible');
        
        // Hide calculate button after profile is closed
        calculateRouteBtn.style.display = 'none';
        
        // Update points control position after closing submenu
        setTimeout(updatePointsControlPosition, 0);

        map.off('click', onMapClickForRoute);
        isBuildingRoute = false;
        
        // Update active state
        updateBuildRouteButtonState();
        
        // Update cursor for all point markers
        updateAllPointMarkersCursor();
    }
    
    // Function to update build route button active state
    function updateBuildRouteButtonState() {
        if (isBuildingRoute || isCalculatingRoute || routePoints.length > 0) {
            buildRouteBtn.classList.add('active');
        } else {
            buildRouteBtn.classList.remove('active');
        }
    }
    
    // Function to update add points button active state
    function updateAddPointsButtonState() {
        if (isPlacingPoints || customPoints.length > 0) {
            addPointBtn.classList.add('active');
        } else {
            addPointBtn.classList.remove('active');
        }
    }
    
    // Event listeners for route buttons
    buildRouteBtn.addEventListener('click', function() {
        // Toggle submenu
        if (routeSubmenu.style.display === 'none') {
            routeSubmenu.style.display = 'block';
            
            // Ensure cancel button is visible when submenu opens
            cancelRouteBtn.style.display = 'block';
            
            // If not already building, start route building mode
            if (!isBuildingRoute && routePoints.length === 0) {
                isBuildingRoute = true;
                map.on('click', onMapClickForRoute);
                updateAllPointMarkersCursor();
            }
        } else {
            routeSubmenu.style.display = 'none';
        }
        
        // Update active state
        updateBuildRouteButtonState();
        
        // Update points control position after toggle
        setTimeout(updatePointsControlPosition, 0);
    });
    
    // Event listener for cancel route button
    cancelRouteBtn.addEventListener('click', function() {
        resetRouteBuilding();
    });
    
    calculateRouteBtn.addEventListener('click', async function() {
        if (routePoints.length < 2) return;
        
        // Set calculate button as active
        calculateRouteBtn.classList.add('active');
        
        // Calculate and show elevation profile
        await calculateRouteElevation();
        
        // Keep active state until profile is closed
        // Don't remove active class here - it will be removed when profile closes
        // Keep button visible while profile is open to show active state
    });
    
    exportRouteBtn.addEventListener('click', exportRouteToCSV);



    profileCloseBtn.addEventListener('click', function() {
        // Reset route building (this will also handle button visibility)
        resetRouteBuilding();
    });

    // --- IMPORT LOGIC ---
    importRouteBtn.addEventListener('click', async () => {
        // Сначала пытаемся загрузить из localStorage
        try {
            const savedRoute = await loadDecryptedFromLocalStorage('saved_route');
            if (savedRoute && savedRoute.data && savedRoute.data.length > 0) {
                const confirmed = confirm('Найден сохраненный маршрут в localStorage. Загрузить его?');
                if (confirmed) {
                    // Восстанавливаем маршрут из сохраненных данных
                    const waypoints = savedRoute.data.filter(p => p.isWaypoint);
                    if (waypoints.length >= 2) {
                        await reconstructRouteFromData(waypoints.map(p => ({ lat: p.lat, lng: p.lng })));
                        // Восстанавливаем данные профиля высоты
                        if (savedRoute.step) {
                            currentSampleStep = savedRoute.step;
                        }
                        currentRouteData = savedRoute.data;
                        buildElevationProfile(savedRoute.data);
                        setupRouteToChartInteraction(savedRoute.data);
                        elevationProfile.classList.add('visible');
                        return;
                    }
                }
            }
        } catch (error) {
            console.error('Ошибка при загрузке маршрута из localStorage:', error);
        }
        
        // Если не удалось загрузить из localStorage, открываем файловый диалог
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

        // Show submenu and hide calculate button
        routeSubmenu.style.display = 'block';
        calculateRouteBtn.style.display = 'none';
        isBuildingRoute = true;
        
        // Update build route button active state
        updateBuildRouteButtonState();
        
        // Update points control position after showing submenu
        setTimeout(updatePointsControlPosition, 0);

        const routeBounds = L.latLngBounds(routePoints);
        map.fitBounds(routeBounds, { padding: [50, 50] });
    }

    // --- Points Management Functionality ---
    let customPoints = []; // Array to store all custom points
    let isPlacingPoints = false; // Flag to track if we're in point placing mode
    let pendingPointLatLng = null; // Store coordinates of point being created
    let pointPopup = null; // Leaflet popup for point info
    
    // Get DOM elements for points
    const addPointBtn = document.getElementById('add-point-btn');
    const pointsSubmenu = document.getElementById('points-submenu');
    const enterCoordsBtn = document.getElementById('enter-coords-btn');
    const placePointBtn = document.getElementById('place-point-btn');
    const coordsInputSubmenu = document.getElementById('coords-input-submenu');
    const latInput = document.getElementById('lat-input');
    const lngInput = document.getElementById('lng-input');
    const cancelCoordsBtn = document.getElementById('cancel-coords-btn');
    const enterCoordsSubmitBtn = document.getElementById('enter-coords-submit-btn');
    const finishPlacingBtn = document.getElementById('finish-placing-btn');
    const resetPointsBtn = document.getElementById('reset-points-btn');
    const exportPointsBtn = document.getElementById('export-points-btn');
    const importPointsBtn = document.getElementById('import-points-btn');
    const pointsCsvImporter = document.getElementById('points-csv-importer');
    const pointInfoPopup = document.getElementById('point-info-popup');
    const pointNameInput = document.getElementById('point-name-input');
    const pointDescriptionInput = document.getElementById('point-description-input');
    const pointLatInput = document.getElementById('point-lat-input');
    const pointLngInput = document.getElementById('point-lng-input');
    const savePointBtn = document.getElementById('save-point-btn');
    const cancelPointBtn = document.getElementById('cancel-point-btn');
    
    let editingPointData = null; // Текущая редактируемая точка
    
    // Function to create a point marker on the map
    function createPointMarker(pointData) {
        const marker = L.marker([pointData.lat, pointData.lng], {
            icon: L.divIcon({
                className: 'custom-point-marker',
                html: '<div style="background-color: #32333d; border: 2px solid darkorange; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;"><div style="background-color: darkorange; border-radius: 50%; width: 10px; height: 10px;"></div></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            })
        }).addTo(map);
        
        // Create popup content using DOM elements for better event handling
        const popupDiv = L.DomUtil.create('div');
        popupDiv.innerHTML = '';
        
        if (pointData.name) {
            const nameDiv = L.DomUtil.create('strong', '', popupDiv);
            nameDiv.textContent = pointData.name;
            L.DomUtil.create('br', '', popupDiv);
        }
        if (pointData.description) {
            const descDiv = L.DomUtil.create('div', '', popupDiv);
            descDiv.textContent = pointData.description;
            L.DomUtil.create('br', '', popupDiv);
        }
        const coordsDiv = L.DomUtil.create('div', '', popupDiv);
        coordsDiv.textContent = `Координаты: ${pointData.lat.toFixed(6)}, ${pointData.lng.toFixed(6)}`;
        
        const editBtn = L.DomUtil.create('button', 'edit-point-btn', popupDiv);
        editBtn.textContent = 'Изменить';
        editBtn.style.cssText = 'margin-top: 10px; padding: 5px 10px; background-color: darkorange; color: #32333d; border: 1px solid #2f2f38; border-radius: 5px; cursor: pointer; font-weight: bold; width: 100%;';
        
        L.DomEvent.on(editBtn, 'click', function(e) {
            L.DomEvent.stopPropagation(e);
            map.closePopup(marker.getPopup());
            openEditPointPopup(pointData);
        });
        
        marker.bindPopup(popupDiv, {
            closeOnClick: false,
            autoClose: false
        });
        
        // Prevent popup from opening when measuring distance or building route
        marker.on('click', function(e) {
            if (isMeasuring || isBuildingRoute) {
                // Prevent popup from opening
                marker.closePopup();
                
                // Simulate map click for measurement or route building
                if (isMeasuring) {
                    onMapClick({ latlng: marker.getLatLng() });
                } else if (isBuildingRoute) {
                    onMapClickForRoute({ latlng: marker.getLatLng() });
                }
            } else {
                // Open popup normally when not in measurement/route mode
                marker.openPopup();
            }
        });
        
        // Change cursor style based on active mode
        function updateMarkerCursor(markerElement) {
            if (isMeasuring || isBuildingRoute) {
                markerElement.style.cursor = 'crosshair';
            } else {
                markerElement.style.cursor = 'pointer';
            }
        }
        
        // Set initial cursor when marker is added to map
        marker.on('add', function() {
            setTimeout(() => {
                const markerElement = marker._icon || marker.getElement();
                if (markerElement) {
                    updateMarkerCursor(markerElement);
                }
            }, 0);
        });
        
        marker.on('mouseover', function() {
            const markerElement = marker._icon || marker.getElement();
            if (markerElement) {
                updateMarkerCursor(markerElement);
            }
        });
        
        marker.on('mouseout', function() {
            const markerElement = marker._icon || marker.getElement();
            if (markerElement) {
                markerElement.style.cursor = '';
            }
        });
        
        return marker;
    }
    
    // Function to update cursor for all point markers
    function updateAllPointMarkersCursor() {
        customPoints.forEach(pointData => {
            if (pointData.marker) {
                const markerElement = pointData.marker._icon || pointData.marker.getElement();
                if (markerElement) {
                    if (isMeasuring || isBuildingRoute) {
                        markerElement.style.cursor = 'crosshair';
                    } else {
                        markerElement.style.cursor = 'pointer';
                    }
                }
            }
        });
    }
    
    // Function to add a point to the map
    function addPoint(lat, lng, name = '', description = '') {
        const pointData = {
            lat: lat,
            lng: lng,
            name: name || '',
            description: description || '',
            marker: null
        };
        
        pointData.marker = createPointMarker(pointData);
        customPoints.push(pointData);
        
        // Update add points button active state
        updateAddPointsButtonState();
        
        return pointData;
    }
    
    // Function to remove a point
    function removePoint(pointData) {
        if (pointData.marker) {
            map.removeLayer(pointData.marker);
        }
        const index = customPoints.indexOf(pointData);
        if (index > -1) {
            customPoints.splice(index, 1);
        }
        updateExportButtonVisibility();
        
        // Update add points button active state
        updateAddPointsButtonState();
    }
    
    // Function to open edit point popup
    function openEditPointPopup(pointData) {
        editingPointData = pointData;
        pointNameInput.value = pointData.name || '';
        pointDescriptionInput.value = pointData.description || '';
        pointLatInput.value = pointData.lat;
        pointLngInput.value = pointData.lng;
        // Show coordinate inputs when editing
        pointLatInput.style.display = 'block';
        pointLngInput.style.display = 'block';
        pointInfoPopup.style.display = 'block';
    }
    
    // Function to update a point
    function updatePoint(pointData, newLat, newLng, newName, newDescription) {
        // Update data
        pointData.lat = newLat;
        pointData.lng = newLng;
        pointData.name = newName || '';
        pointData.description = newDescription || '';
        
        // Remove old marker
        if (pointData.marker) {
            map.removeLayer(pointData.marker);
        }
        
        // Create new marker with updated data
        pointData.marker = createPointMarker(pointData);
    }
    
    // Function to handle map click when placing points
    function onMapClickForPoint(e) {
        if (!isPlacingPoints) return;
        
        pendingPointLatLng = e.latlng;
        
        // Show popup near the clicked point
        if (pointPopup) {
            pointPopup.remove();
        }
        
        pointPopup = L.popup()
            .setLatLng(e.latlng)
            .setContent('<div>Введите информацию о точке</div>')
            .openOn(map);
        
        // Show the info popup
        pointNameInput.value = '';
        pointDescriptionInput.value = '';
        pointLatInput.value = '';
        pointLngInput.value = '';
        // Hide coordinate inputs when adding new point (coordinates come from map click)
        pointLatInput.style.display = 'none';
        pointLngInput.style.display = 'none';
        pointInfoPopup.style.display = 'block';
        
        // Close Leaflet popup
        setTimeout(() => {
            if (pointPopup) {
                map.closePopup(pointPopup);
            }
        }, 100);
    }
    
    // Handle "Add Point" button click
    addPointBtn.addEventListener('click', function() {
        if (pointsSubmenu.style.display === 'none') {
            pointsSubmenu.style.display = 'block';
            coordsInputSubmenu.style.display = 'none';
        } else {
            pointsSubmenu.style.display = 'none';
        }
    });
    
    // Handle "Enter Coordinates" button click
    enterCoordsBtn.addEventListener('click', function() {
        pointsSubmenu.style.display = 'none';
        coordsInputSubmenu.style.display = 'block';
        latInput.value = '';
        lngInput.value = '';
    });
    
    // Handle "Cancel" button in coordinates input submenu
    cancelCoordsBtn.addEventListener('click', function() {
        coordsInputSubmenu.style.display = 'none';
        pointsSubmenu.style.display = 'block';
        latInput.value = '';
        lngInput.value = '';
    });
    
    // Function to update export button visibility
    function updateExportButtonVisibility() {
        if (customPoints.length > 0) {
            exportPointsBtn.style.display = 'block';
            resetPointsBtn.style.display = 'block';
        } else {
            exportPointsBtn.style.display = 'none';
            resetPointsBtn.style.display = 'none';
        }
    }
    
    // Function to reset all points
    function resetAllPoints() {
        // Remove all markers from map
        customPoints.forEach(pointData => {
            if (pointData.marker) {
                map.removeLayer(pointData.marker);
            }
        });
        // Clear the array
        customPoints = [];
        // Update button visibility
        updateExportButtonVisibility();
        
        // Update add points button active state
        updateAddPointsButtonState();
    }
    
    // Function to reset placement mode
    function resetPlacementMode() {
        isPlacingPoints = false;
        map.off('click', onMapClickForPoint);
        map.getContainer().style.cursor = '';
        if (pointPopup) {
            map.closePopup(pointPopup);
            pointPopup = null;
        }
        pendingPointLatLng = null;
        
        // Update add points button active state
        updateAddPointsButtonState();
    }
    
    // Handle "Place Point on Map" button click
    placePointBtn.addEventListener('click', function() {
        pointsSubmenu.style.display = 'none';
        isPlacingPoints = true;
        updateExportButtonVisibility();
        map.on('click', onMapClickForPoint);
        map.getContainer().style.cursor = 'crosshair';
        
        // Update add points button active state
        updateAddPointsButtonState();
    });
    
    // Handle "Finish Placing" button click
    finishPlacingBtn.addEventListener('click', function() {
        resetPlacementMode();
        placePointBtn.style.display = 'block';
        finishPlacingBtn.style.display = 'none';
        pointInfoPopup.style.display = 'none';
    });
    
    // Handle coordinate input submit
    enterCoordsSubmitBtn.addEventListener('click', function() {
        const lat = parseFloat(latInput.value);
        const lng = parseFloat(lngInput.value);
        
        if (isNaN(lat) || isNaN(lng)) {
            alert('Пожалуйста, введите корректные координаты');
            return;
        }
        
        if (lat < -90 || lat > 90) {
            alert('Широта должна быть в диапазоне от -90 до 90');
            return;
        }
        
        if (lng < -180 || lng > 180) {
            alert('Долгота должна быть в диапазоне от -180 до 180');
            return;
        }
        
        // Show info popup
        pendingPointLatLng = L.latLng(lat, lng);
        pointNameInput.value = '';
        pointDescriptionInput.value = '';
        pointLatInput.value = '';
        pointLngInput.value = '';
        // Hide coordinate inputs when adding new point (coordinates already entered)
        pointLatInput.style.display = 'none';
        pointLngInput.style.display = 'none';
        pointInfoPopup.style.display = 'block';
        coordsInputSubmenu.style.display = 'none';
        
        // Center map on the point
        map.setView([lat, lng], map.getZoom());
    });
    
    // Handle save point button
    savePointBtn.addEventListener('click', function() {
        const name = pointNameInput.value.trim();
        const description = pointDescriptionInput.value.trim();
        
        // Check if we're editing an existing point
        if (editingPointData) {
            const lat = parseFloat(pointLatInput.value);
            const lng = parseFloat(pointLngInput.value);
            
            if (isNaN(lat) || isNaN(lng)) {
                alert('Пожалуйста, введите корректные координаты');
                return;
            }
            
            if (lat < -90 || lat > 90) {
                alert('Широта должна быть в диапазоне от -90 до 90');
                return;
            }
            
            if (lng < -180 || lng > 180) {
                alert('Долгота должна быть в диапазоне от -180 до 180');
                return;
            }
            
            updatePoint(editingPointData, lat, lng, name, description);
            editingPointData = null;
        } else {
            // Adding a new point
            if (!pendingPointLatLng) return;
            
            addPoint(pendingPointLatLng.lat, pendingPointLatLng.lng, name, description);
            
            // Reset placement mode if it was active (point was added by clicking on map)
            if (isPlacingPoints) {
                resetPlacementMode();
            }
            pendingPointLatLng = null;
        }
        
        pointInfoPopup.style.display = 'none';
        
        // Show export button if we have points
        updateExportButtonVisibility();
    });
    
    // Handle cancel point button
    cancelPointBtn.addEventListener('click', function() {
        pointInfoPopup.style.display = 'none';
        
        // Reset placement mode if it was active (point was being added by clicking on map)
        if (isPlacingPoints) {
            resetPlacementMode();
        }
        
        // Clear editing state
        editingPointData = null;
        pendingPointLatLng = null;
    });
    
    // Handle export points button
    exportPointsBtn.addEventListener('click', async function() {
        if (customPoints.length === 0) {
            alert('Нет точек для экспорта');
            return;
        }
        
        const headers = ['координаты_точки', 'название_точки', 'описание_точки'];
        const rows = customPoints.map(point => {
            // Escape commas and quotes in text fields
            const escapeCSV = (text) => {
                if (!text) return '';
                // If text contains comma, quote or newline, wrap in quotes and escape quotes
                if (text.includes(',') || text.includes('"') || text.includes('\n')) {
                    return '"' + text.replace(/"/g, '""') + '"';
                }
                return text;
            };
            
            return [
                `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`,
                escapeCSV(point.name || ''),
                escapeCSV(point.description || '')
            ].join(',');
        });
        
        let csvContent = headers.join(',') + '\n' + rows.join('\n');
        
        // Сохраняем зашифрованные данные в localStorage
        try {
            await saveEncryptedToLocalStorage('saved_points', {
                points: customPoints,
                timestamp: new Date().toISOString()
            });
            console.log('Точки сохранены в localStorage (зашифрованы)');
        } catch (error) {
            console.error('Не удалось сохранить точки в localStorage:', error);
            // Продолжаем экспорт в файл даже если сохранение в localStorage не удалось
        }
        
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'points.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
    
    // Handle reset points button
    resetPointsBtn.addEventListener('click', function() {
        if (customPoints.length === 0) {
            return;
        }
        
        resetAllPoints();
    });
    
    // Handle import points button
    importPointsBtn.addEventListener('click', async function() {
        // Сначала пытаемся загрузить из localStorage
        try {
            const savedPoints = await loadDecryptedFromLocalStorage('saved_points');
            if (savedPoints && savedPoints.points && savedPoints.points.length > 0) {
                const confirmed = confirm('Найдены сохраненные точки в localStorage. Загрузить их?');
                if (confirmed) {
                    // Очищаем существующие точки
                    resetAllPoints();
                    
                    // Загружаем сохраненные точки
                    savedPoints.points.forEach(point => {
                        addPoint(point.lat, point.lng, point.name, point.description);
                    });
                    
                    updateExportButtonVisibility();
                    return;
                }
            }
        } catch (error) {
            console.error('Ошибка при загрузке точек из localStorage:', error);
        }
        
        // Если не удалось загрузить из localStorage, открываем файловый диалог
        pointsCsvImporter.click();
    });
    
    // Handle CSV file import
    pointsCsvImporter.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const text = e.target.result;
            try {
                const parsedPoints = parsePointsCsv(text);
                
                // Remove existing points if needed (or merge)
                // For now, we'll add to existing points
                parsedPoints.forEach(point => {
                    addPoint(point.lat, point.lng, point.name, point.description);
                });
                
                updateExportButtonVisibility();
            } catch (error) {
                alert(`Не удалось прочитать файл. Убедитесь, что это корректный CSV-файл.\nДетали: ${error.message}`);
            }
        };
        reader.readAsText(file);
        
        event.target.value = '';
    });
    
    // Function to parse CSV line with proper handling of quoted fields
    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // Escaped quote
                    current += '"';
                    i++; // Skip next quote
                } else {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                // Field separator
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        // Add last field
        result.push(current.trim());
        return result;
    }
    
    // Function to check if a string looks like a coordinate (number in valid range)
    function isCoordinate(str) {
        const num = parseFloat(str.trim());
        return !isNaN(num) && num >= -180 && num <= 180;
    }
    
    // Function to parse points CSV
    function parsePointsCsv(text) {
        const lines = text.trim().split(/\r\n|\n/);
        if (lines.length < 2) {
            throw new Error('CSV файл должен содержать заголовок и хотя бы одну строку данных.');
        }
        
        const headers = parseCSVLine(lines[0]).map(h => h.trim());
        const coordsIndex = headers.indexOf('координаты_точки');
        const nameIndex = headers.indexOf('название_точки');
        const descIndex = headers.indexOf('описание_точки');
        
        if (coordsIndex === -1) {
            throw new Error('CSV файл должен содержать столбец: координаты_точки');
        }
        
        const points = [];
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue; // Skip empty lines
            
            let values = parseCSVLine(lines[i]);
            
            // Handle case where coordinates field contains comma but is not quoted
            // If coordsIndex points to a single number and next value is also a number,
            // they are likely the two parts of coordinates
            let coordValue = values[coordsIndex] || '';
            let lat, lng;
            
            // Try to parse coordinates
            let coordsWereSplit = false;
            if (coordValue.includes(',')) {
                // Coordinates are in a single field (quoted or already combined)
                const coords = coordValue.split(',').map(c => parseFloat(c.trim()));
                if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
                    lat = coords[0];
                    lng = coords[1];
                }
            } else {
                // Coordinates might be split across two fields
                // Check if current field and next field are both valid coordinates
                if (isCoordinate(values[coordsIndex]) && 
                    coordsIndex + 1 < values.length && 
                    isCoordinate(values[coordsIndex + 1])) {
                    lat = parseFloat(values[coordsIndex].trim());
                    lng = parseFloat(values[coordsIndex + 1].trim());
                    coordsWereSplit = true;
                    // Remove both coordinate fields and replace with empty string
                    // This keeps array length consistent with headers
                    values.splice(coordsIndex, 2, '');
                } else {
                    // Try to parse as single coordinate field
                    const coordNum = parseFloat(coordValue);
                    if (!isNaN(coordNum)) {
                        // This shouldn't happen with proper CSV, but handle it
                        continue;
                    }
                }
            }
            
            if (lat !== undefined && lng !== undefined) {
                const point = {
                    lat: lat,
                    lng: lng,
                    name: '',
                    description: ''
                };
                
                // Get name
                if (nameIndex !== -1 && nameIndex < values.length) {
                    point.name = (values[nameIndex] || '').replace(/^"|"$/g, '').trim();
                }
                
                // Get description
                if (descIndex !== -1 && descIndex < values.length) {
                    point.description = (values[descIndex] || '').replace(/^"|"$/g, '').trim();
                }
                
                points.push(point);
            }
        }
        
        if (points.length === 0) {
            throw new Error('В файле не найдено ни одной корректной точки.');
        }
        
        return points;
    }
}
