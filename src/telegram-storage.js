/**
 * Утилита для работы с Telegram Web App и Cloud Storage
 * Заменяет localStorage на Telegram Cloud Storage при использовании через telegram-web-app
 */

/**
 * Проверяет, используется ли приложение через Telegram Web App
 * @returns {boolean}
 */
export function isTelegramWebApp() {
    return typeof window !== 'undefined' && 
           window.Telegram && 
           window.Telegram.WebApp && 
           window.Telegram.WebApp.initDataUnsafe;
}

/**
 * Получает экземпляр Telegram WebApp
 * @returns {object|null}
 */
export function getTelegramWebApp() {
    if (isTelegramWebApp()) {
        return window.Telegram.WebApp;
    }
    return null;
}

/**
 * Обертка для хранения данных
 * Использует Telegram Cloud Storage если доступен, иначе localStorage
 */
export const storage = {
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
 * Загружает файл на сервер через Telegram Bot API
 * @param {Blob|File} file - Файл для загрузки
 * @param {string} fileName - Имя файла
 * @returns {Promise<string>} - Возвращает file_id файла в Telegram
 */
export async function uploadTelegramFile(file, fileName) {
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
    const webApp = getTelegramWebApp();
    const userId = webApp?.initDataUnsafe?.user?.id;
    if (!userId) {
        throw new Error('Не удалось получить user_id из Telegram WebApp');
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
export async function downloadTelegramFileViaWebApp(fileId) {
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

