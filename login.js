// API Configuration
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://127.0.0.1:8000' 
    : 'https://strekoza-ylfm.onrender.com';

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('error-message');
    const loading = document.getElementById('loading');
    const loginButton = document.getElementById('login-button');

    // Проверяем, есть ли уже токен
    const token = storageAPI.getItem('auth_token');
    if (token) {
        // Если токен есть, проверяем его валидность
        verifyToken(token);
    }

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const password = passwordInput.value.trim();
        
        if (!password) {
            showError('Введите пароль');
            return;
        }

        // Показываем загрузку
        showLoading(true);
        hideError();
        loginButton.disabled = true;

        try {
            const response = await fetch(`${API_URL}/api/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password: password })
            });

            const data = await response.json();

            if (response.ok) {
                // Сохраняем токен
                storageAPI.setItem('auth_token', data.access_token);
                
                // Перенаправляем на главную страницу
                window.location.href = 'index.html';
            } else {
                showError(data.detail || 'Неверный пароль');
                passwordInput.value = '';
                passwordInput.focus();
            }
        } catch (error) {
            showError('Ошибка подключения к серверу. Проверьте, что сервер запущен.');
        } finally {
            showLoading(false);
            loginButton.disabled = false;
        }
    });

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.add('show');
    }

    function hideError() {
        errorMessage.classList.remove('show');
    }

    function showLoading(show) {
        if (show) {
            loading.classList.add('show');
        } else {
            loading.classList.remove('show');
        }
    }

    async function verifyToken(token) {
        try {
            // Пытаемся использовать токен для запроса к защищенному эндпоинту
            // Если токен валидный, перенаправляем на главную страницу
            const response = await fetch(`${API_URL}/api/get_elevation`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ points: [] })
            });

            if (response.status === 401) {
                // Токен невалидный, удаляем его
                storageAPI.removeItem('auth_token');
                return;
            }

            // Если запрос прошел (даже если пустой), токен валидный
            if (response.ok || response.status === 422) {
                window.location.href = 'index.html';
            }
        } catch (error) {
            // При ошибке соединения оставляем пользователя на странице входа
        }
    }
});

