/**
 * Утилита для работы с Telegram Web App и Cloud Storage
 * Заменяет localStorage на Telegram Cloud Storage при использовании через telegram-web-app
 */

/**
 * Инициализирует Telegram WebApp
 */
function initTelegramWebApp() {
    if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
        const webApp = window.Telegram.WebApp;
        // Инициализируем WebApp, если еще не инициализирован
        if (webApp.ready && typeof webApp.ready === 'function') {
            webApp.ready();
        }
        // Расширяем WebApp на весь экран, если нужно
        if (webApp.expand && typeof webApp.expand === 'function') {
            webApp.expand();
        }
    }
}

// Инициализируем при загрузке скрипта
if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
    // Ждем загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTelegramWebApp);
    } else {
        initTelegramWebApp();
    }
}

/**
 * Проверяет, используется ли приложение через Telegram Web App
 * @returns {boolean}
 */
function isTelegramWebApp() {
    return typeof window !== 'undefined' && 
           window.Telegram && 
           window.Telegram.WebApp;
}

/**
 * Получает экземпляр Telegram WebApp
 * @returns {object|null}
 */
function getTelegramWebApp() {
    if (isTelegramWebApp()) {
        return window.Telegram.WebApp;
    }
    return null;
}

/**
 * Обертка для хранения данных
 * Использует Telegram Cloud Storage если доступен, иначе localStorage
 */
const TelegramStorage = {
    /**
     * Сохраняет значение в хранилище
     * @param {string} key - Ключ
     * @param {string} value - Значение
     * @returns {Promise<void>}
     */
    async setItem(key, value) {
        if (isTelegramWebApp()) {
            const webApp = getTelegramWebApp();
            if (webApp && webApp.CloudStorage) {
                return new Promise((resolve, reject) => {
                    webApp.CloudStorage.setItem(key, value, (error) => {
                        if (error) {
                            console.error('Ошибка сохранения в Telegram Cloud Storage:', error);
                            reject(error);
                        } else {
                            resolve();
                        }
                    });
                });
            }
        }
        // Fallback на localStorage
        localStorage.setItem(key, value);
        return Promise.resolve();
    },

    /**
     * Получает значение из хранилища
     * @param {string} key - Ключ
     * @returns {Promise<string|null>}
     */
    async getItem(key) {
        if (isTelegramWebApp()) {
            const webApp = getTelegramWebApp();
            if (webApp && webApp.CloudStorage) {
                return new Promise((resolve) => {
                    webApp.CloudStorage.getItem(key, (error, value) => {
                        if (error) {
                            console.error('Ошибка чтения из Telegram Cloud Storage:', error);
                            resolve(null);
                        } else {
                            resolve(value || null);
                        }
                    });
                });
            }
        }
        // Fallback на localStorage
        return Promise.resolve(localStorage.getItem(key));
    },

    /**
     * Удаляет значение из хранилища
     * @param {string} key - Ключ
     * @returns {Promise<void>}
     */
    async removeItem(key) {
        if (isTelegramWebApp()) {
            const webApp = getTelegramWebApp();
            if (webApp && webApp.CloudStorage) {
                return new Promise((resolve, reject) => {
                    webApp.CloudStorage.removeItem(key, (error) => {
                        if (error) {
                            console.error('Ошибка удаления из Telegram Cloud Storage:', error);
                            reject(error);
                        } else {
                            resolve();
                        }
                    });
                });
            }
        }
        // Fallback на localStorage
        localStorage.removeItem(key);
        return Promise.resolve();
    }
};

/**
 * Получает user_id из Telegram WebApp
 * @returns {number|null}
 */
function getTelegramUserId() {
    if (!isTelegramWebApp()) {
        return null;
    }

    const webApp = getTelegramWebApp();
    if (!webApp) {
        return null;
    }

    // Пробуем получить user_id из initDataUnsafe
    if (webApp.initDataUnsafe && webApp.initDataUnsafe.user && webApp.initDataUnsafe.user.id) {
        return webApp.initDataUnsafe.user.id;
    }

    // Пробуем получить user_id из initData (строка)
    if (webApp.initData) {
        try {
            // initData может быть в формате query string
            // Пример: "user=%7B%22id%22%3A123456%2C%22first_name%22%3A%22John%22%7D&auth_date=1234567890&hash=..."
            const params = new URLSearchParams(webApp.initData);
            const userParam = params.get('user');
            if (userParam) {
                const user = JSON.parse(decodeURIComponent(userParam));
                if (user && user.id) {
                    return user.id;
                }
            }
        } catch (e) {
            console.warn('Ошибка парсинга initData:', e);
        }
    }

    // Пробуем получить user_id из startParam, если он передан
    if (webApp.startParam) {
        try {
            const startParam = JSON.parse(webApp.startParam);
            if (startParam && startParam.user_id) {
                return startParam.user_id;
            }
        } catch (e) {
            // startParam может быть не JSON
        }
    }

    // Логируем доступные данные для отладки
    console.log('Telegram WebApp данные:', {
        initData: webApp.initData,
        initDataUnsafe: webApp.initDataUnsafe,
        version: webApp.version,
        platform: webApp.platform
    });

    return null;
}

/**
 * Загружает файл на сервер через Telegram Bot API
 * @param {Blob|File} file - Файл для загрузки
 * @param {string} fileName - Имя файла
 * @returns {Promise<string>} - Возвращает file_id файла в Telegram
 */
async function uploadTelegramFile(file, fileName) {
    if (!isTelegramWebApp()) {
        throw new Error('Telegram Web App не доступен');
    }

    const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://127.0.0.1:8000' 
        : 'https://strekoza-ylfm.onrender.com';

    // Получаем токен авторизации
    const authToken = localStorage.getItem('auth_token');
    if (!authToken) {
        throw new Error('Токен авторизации не найден');
    }

    // Получаем user_id из Telegram WebApp
    const userId = getTelegramUserId();
    if (!userId) {
        // Логируем для отладки
        const webApp = getTelegramWebApp();
        const debugInfo = {
            initData: webApp?.initData ? 'присутствует' : 'отсутствует',
            initDataUnsafe: webApp?.initDataUnsafe ? 'присутствует' : 'отсутствует',
            initDataUnsafeUser: webApp?.initDataUnsafe?.user ? 'присутствует' : 'отсутствует',
            version: webApp?.version || 'неизвестна',
            platform: webApp?.platform || 'неизвестна'
        };
        console.error('Не удалось получить user_id. Отладочная информация:', debugInfo);
        console.error('Полные данные WebApp:', webApp);
        
        // Более понятное сообщение об ошибке
        throw new Error('Не удалось получить user_id из Telegram WebApp. ' +
            'Убедитесь, что:\n' +
            '1. Приложение запущено через Telegram (не в обычном браузере)\n' +
            '2. Telegram WebApp правильно инициализирован\n' +
            '3. Проверьте консоль браузера для подробностей');
    }

    // Создаем FormData для загрузки файла
    const formData = new FormData();
    formData.append('file', file, fileName);
    formData.append('user_id', userId.toString());

    // Загружаем файл на сервер
    const response = await fetch(`${API_URL}/api/telegram/upload`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authToken}`
        },
        body: formData
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Ошибка загрузки файла' }));
        throw new Error(error.detail || 'Ошибка загрузки файла');
    }

    const result = await response.json();
    return result.file_id;
}

/**
 * Скачивает файл через Telegram.WebApp.downloadFile()
 * @param {string} fileId - ID файла в Telegram
 * @returns {Promise<Blob>}
 */
async function downloadTelegramFileViaWebApp(fileId) {
    if (!isTelegramWebApp()) {
        throw new Error('Telegram Web App не доступен');
    }

    const webApp = getTelegramWebApp();
    if (!webApp || !webApp.downloadFile) {
        throw new Error('Telegram.WebApp.downloadFile не доступен');
    }

    return new Promise((resolve, reject) => {
        webApp.downloadFile(fileId, (error, blob) => {
            if (error) {
                console.error('Ошибка загрузки файла из Telegram:', error);
                reject(error);
            } else {
                resolve(blob);
            }
        });
    });
}

