# Исправление ошибки 404 на /api/login на Render.com

## Проблема

Вы видите 404 ошибку при обращении к `/api/login`, хотя эндпоинт определен в коде.

## Причина

Скорее всего, проблема в **Start Command** на Render.com. Render.com может использовать неправильную команду запуска или не может найти модуль.

## Решение

### Шаг 1: Проверьте Start Command на Render.com

1. Зайдите на [dashboard.render.com](https://dashboard.render.com)
2. Выберите ваш сервис
3. Перейдите в раздел **"Settings"**
4. Найдите секцию **"Start Command"**

### Шаг 2: Установите правильный Start Command

**Правильная команда:**
```bash
gunicorn -w 4 -k uvicorn.workers.UvicornWorker server:app
```

**Важно:**
- `server:app` означает файл `server.py` и объект `app` в нем
- Если файл называется по-другому или находится в подпапке, измените путь

### Шаг 3: Альтернативные варианты Start Command

Если первая команда не работает, попробуйте:

**Вариант 1 (если файл в корне):**
```bash
gunicorn -w 4 -k uvicorn.workers.UvicornWorker server:app --bind 0.0.0.0:$PORT
```

**Вариант 2 (через uvicorn напрямую):**
```bash
uvicorn server:app --host 0.0.0.0 --port $PORT
```

**Вариант 3 (если файл в подпапке):**
```bash
gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.server:app
```

### Шаг 4: Проверьте структуру проекта

Убедитесь, что файл `server.py` находится в корне репозитория (или правильно указан путь в Start Command).

Структура должна быть:
```
your-repo/
├── server.py          ← здесь должен быть файл
├── requirements.txt
├── strm/
└── ...
```

### Шаг 5: Добавьте тестовый эндпоинт для проверки

Добавьте в `server.py` простой эндпоинт для проверки:

```python
@app.get("/")
def root():
    return {"message": "Server is running", "endpoints": ["/api/login", "/api/get_elevation"]}

@app.get("/health")
def health():
    return {"status": "ok"}
```

### Шаг 6: Проверьте логи при старте

После установки правильного Start Command и перезапуска, в логах должно быть:

```
[INFO] Пароль установлен: переменная окружения (SITE_PASSWORD), длина пароля: X символов
[INFO] Started server process [XX]
[INFO] Application startup complete.
```

Если этого нет - модуль не загружается правильно.

## Диагностика

### Проверка 1: Откройте корневой эндпоинт

После перезапуска откройте в браузере:
```
https://your-service.onrender.com/
```

Если видите JSON с сообщением - сервер работает, но эндпоинты не найдены.

### Проверка 2: Откройте /docs

Откройте:
```
https://your-service.onrender.com/docs
```

Если открывается Swagger UI - FastAPI работает правильно, эндпоинты должны быть видны.

### Проверка 3: Проверьте логи при попытке входа

Когда вы пытаетесь войти, в логах должно быть:
- Либо успешный запрос (200)
- Либо ошибка 401 (неверный пароль)
- Но НЕ 404!

## Частые ошибки

### Ошибка 1: Неправильное имя файла
- ❌ Start Command: `gunicorn app:server` (если файл называется `server.py`)
- ✅ Start Command: `gunicorn server:app`

### Ошибка 2: Неправильный путь к объекту
- ❌ Start Command: `gunicorn server:server` (если объект называется `app`)
- ✅ Start Command: `gunicorn server:app`

### Ошибка 3: Файл в подпапке
Если `server.py` находится в подпапке `app/`:
- ✅ Start Command: `gunicorn app.server:app`

## Быстрое решение

1. **Откройте Settings → Start Command**
2. **Установите:**
   ```bash
   gunicorn -w 4 -k uvicorn.workers.UvicornWorker server:app
   ```
3. **Сохраните изменения**
4. **Перезапустите сервис** (кнопка "Restart")
5. **Проверьте логи** - должно быть видно `[INFO] Пароль установлен: ...`
6. **Откройте** `https://your-service.onrender.com/docs` - должны быть видны эндпоинты

## Если ничего не помогает

1. Проверьте, что файл `server.py` закоммичен в Git и запушен
2. Проверьте, что в `requirements.txt` есть все зависимости:
   - `fastapi`
   - `uvicorn[standard]`
   - `gunicorn`
   - `python-jose[cryptography]`
   - `passlib[bcrypt]`
   - `python-multipart`
3. Проверьте логи ошибок при старте - может быть ошибка импорта модулей

