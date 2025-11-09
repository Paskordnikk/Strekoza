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
    const token = localStorage.getItem('auth_token');
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
            const requestBody = { password: password };
            
            const response = await fetch(`${API_URL}/api/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            // Читаем ответ как текст сначала (можно прочитать только один раз)
            const responseText = await response.text();
            
            // Проверяем, есть ли контент для парсинга
            const contentType = response.headers.get('content-type') || '';
            let data = null;
            
            // Пытаемся распарсить как JSON, если есть текст ответа
            if (responseText && responseText.trim()) {
                // Проверяем, похож ли ответ на JSON (начинается с { или [)
                const looksLikeJson = responseText.trim().startsWith('{') || responseText.trim().startsWith('[');
                
                if (contentType.includes('application/json') || looksLikeJson) {
                    try {
                        data = JSON.parse(responseText);
                    } catch (jsonError) {
                        // Если это ошибка сервера (не 200), все равно пытаемся показать текст
                        if (!response.ok) {
                            // Продолжаем обработку с текстом ответа
                            data = null;
                        } else {
                            showError('Ошибка при обработке ответа сервера. Попробуйте еще раз.');
                            passwordInput.value = '';
                            passwordInput.focus();
                            return;
                        }
                    }
                } else {
                    // Не JSON ответ
                    if (response.ok) {
                        // Если ответ успешный, но не JSON, возможно это редирект или другой формат
                        showError('Неожиданный формат ответа от сервера.');
                        return;
                    } else {
                        const errorPreview = responseText.length > 100 ? responseText.substring(0, 100) + '...' : responseText;
                        showError(`Ошибка сервера: ${response.status} ${response.statusText}. Ответ: ${errorPreview}`);
                        return;
                    }
                }
            } else {
                // Пустой ответ
                data = null;
            }

            if (response.ok) {
                // Проверяем наличие токена в ответе
                if (data && data.access_token) {
                    // Сохраняем токен
                    localStorage.setItem('auth_token', data.access_token);
                    // Перенаправляем на главную страницу
                    window.location.href = 'index.html';
                } else {
                    showError('Токен не получен от сервера. Попробуйте еще раз.');
                    passwordInput.value = '';
                    passwordInput.focus();
                }
            } else {
                // Обрабатываем ошибку от сервера
                let errorMessage = 'Неверный пароль';
                
                if (data) {
                    // Если есть данные, пытаемся извлечь сообщение об ошибке
                    errorMessage = data.detail || data.message || data.error || data.msg || 'Неверный пароль';
                } else if (responseText && responseText.trim()) {
                    // Если данных нет, но есть текст ответа, используем его
                    try {
                        const parsedText = JSON.parse(responseText);
                        errorMessage = parsedText.detail || parsedText.message || parsedText.error || 'Неверный пароль';
                    } catch (e) {
                        // Если не JSON, используем текст как есть (ограничиваем длину)
                        errorMessage = responseText.length > 100 ? responseText.substring(0, 100) + '...' : responseText;
                    }
                } else {
                    // Если ответ пустой, используем стандартное сообщение в зависимости от статуса
                    if (response.status === 401) {
                        errorMessage = 'Неверный пароль';
                    } else if (response.status === 403) {
                        errorMessage = 'Доступ запрещен';
                    } else if (response.status === 404) {
                        errorMessage = 'Эндпоинт не найден. Проверьте, что сервер запущен.';
                    } else if (response.status >= 500) {
                        errorMessage = 'Ошибка сервера. Попробуйте позже.';
                    } else {
                        errorMessage = `Ошибка: ${response.status} ${response.statusText}`;
                    }
                }
                
                showError(errorMessage);
                passwordInput.value = '';
                passwordInput.focus();
            }
        } catch (error) {
            // Более детальное сообщение об ошибке
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                showError('Ошибка подключения к серверу. Проверьте, что сервер запущен и доступен.');
            } else if (error.name === 'NetworkError' || error.message.includes('network')) {
                showError('Ошибка сети. Проверьте подключение к интернету.');
            } else {
                showError(`Ошибка: ${error.message}`);
            }
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
                localStorage.removeItem('auth_token');
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

