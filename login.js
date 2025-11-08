// API Configuration
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://127.0.0.1:8000' 
    : 'https://strekoza-ylfm.onrender.com';

function showError(message) {
    const errorMessage = document.getElementById('error-message');
    const statusMessage = document.getElementById('status-message');
    if (errorMessage) {
        errorMessage.textContent = `Ошибка: ${message}`;
        errorMessage.style.display = 'block';
    }
    if (statusMessage) {
        statusMessage.style.display = 'none';
    }
}

function setStatus(message) {
    const statusMessage = document.getElementById('status-message');
    if (statusMessage) {
        statusMessage.textContent = message;
    }
}

async function authenticate() {
    try {
        const tg = window.Telegram.WebApp;
        tg.ready();
        
        setStatus('Проверка данных Telegram...');
        
        // Данные для аутентификации
        const initData = tg.initData;

        if (!initData) {
            showError('Не удалось получить данные Telegram. Убедитесь, что приложение запущено через Telegram.');
            tg.close();
            return;
        }

        setStatus('Отправка данных на сервер...');
        const response = await fetch(`${API_URL}/api/auth_telegram`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ initData: initData })
        });

        const data = await response.json();

        if (response.ok) {
            setStatus('Сохранение сессии...');
            // Сохраняем токен в CloudStorage
            tg.CloudStorage.setItem('auth_token', data.access_token, (error, success) => {
                if (success) {
                    setStatus('Вход выполнен. Перенаправление...');
                    window.location.href = 'index.html';
                } else {
                    showError('Не удалось сохранить сессию в облако Telegram. Попробуйте перезапустить приложение.');
                }
            });
        } else {
            showError(data.detail || 'Не удалось войти. Сервер отклонил запрос.');
            tg.close();
        }
    } catch (error) {
        console.error('Authentication error:', error);
        showError('Критическая ошибка подключения к серверу. Попробуйте позже.');
        if (window.Telegram.WebApp) {
            window.Telegram.WebApp.close();
        }
    }
}

// Проверяем, есть ли уже токен в облаке
try {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.CloudStorage.getItem('auth_token', (error, value) => {
        if (value) {
            // Если токен есть, можно сразу перенаправить,
            // а основное приложение проверит его валидность.
            setStatus('Сессия найдена. Перенаправление...');
            window.location.href = 'index.html';
        } else {
            // Если токена нет, начинаем процесс аутентификации
            authenticate();
        }
    });
} catch (e) {
    // Если Telegram Web App не доступен, показываем ошибку
    showError('Не удалось инициализировать Telegram Web App. Откройте приложение через Telegram.');
}