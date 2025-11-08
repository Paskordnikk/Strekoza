// storage.js - Обертка для хранения данных с поддержкой Telegram Cloud Storage

class DataStorage {
  constructor() {
    this.isTelegramWebApp = this.checkTelegramWebApp();
    
    if (this.isTelegramWebApp) {
      this.initAndSync();
    }
  }

  checkTelegramWebApp() {
    return typeof window !== 'undefined' && 
           window.Telegram && 
           window.Telegram.WebApp;
  }

  // Инициализация и синхронизация с Cloud Storage
  initAndSync() {
    const tg = window.Telegram.WebApp;
    tg.ready();
    
    // Синхронизируем данные из Cloud Storage в localStorage при запуске
    tg.CloudStorage.getKeys((error, keys) => {
      if (error) {
        console.warn('Error getting keys from Telegram Cloud Storage during init:', error);
        return;
      }
      
      // Загружаем все ключи из Cloud Storage в localStorage
      keys.forEach(key => {
        tg.CloudStorage.getItem(key, (err, value) => {
          if (!err && value !== null && value !== undefined) {
            localStorage.setItem(key, value);
          }
        });
      });
    });
  }

  // Синхронное получение значения (из localStorage)
  getItem(key) {
    return localStorage.getItem(key);
  }

  // Синхронное сохранение значения (в localStorage) с асинхронной синхронизацией с Cloud Storage
  setItem(key, value) {
    // Сохраняем в localStorage сразу
    localStorage.setItem(key, value);
    
    // Если в Telegram Mini App, дополнительно сохраняем в Cloud Storage асинхронно
    if (this.isTelegramWebApp) {
      const tg = window.Telegram.WebApp;
      tg.CloudStorage.setItem(key, value, (error) => {
        if (error) {
          console.warn(`Error saving to Telegram Cloud Storage: ${error}`);
        }
      });
    }
  }

  // Синхронное удаление значения (из localStorage) с асинхронной синхронизацией с Cloud Storage
  removeItem(key) {
    // Удаляем из localStorage сразу
    localStorage.removeItem(key);
    
    // Если в Telegram Mini App, дополнительно удаляем из Cloud Storage асинхронно
    if (this.isTelegramWebApp) {
      const tg = window.Telegram.WebApp;
      tg.CloudStorage.removeItem(key, (error) => {
        if (error) {
          console.warn(`Error removing from Telegram Cloud Storage: ${error}`);
        }
      });
    }
  }
}

// Создаем глобальный экземпляр для использования в приложении
const storage = new DataStorage();

// Функции для удобства использования
const storageAPI = {
  getItem: (key) => storage.getItem(key),
  setItem: (key, value) => storage.setItem(key, value),
  removeItem: (key) => storage.removeItem(key),
  isTelegramWebApp: () => storage.isTelegramWebApp
};

// Экспортируем для использования в модулях, если поддерживается
if (typeof module !== 'undefined' && module.exports) {
  module.exports = storageAPI;
}

// А также делаем доступным глобально
window.storageAPI = storageAPI;