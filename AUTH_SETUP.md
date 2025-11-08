# Настройка аутентификации

## Описание

Система защищена JWT-аутентификацией. Пользователи должны ввести пароль для доступа к сайту.

## Настройка пароля

### Вариант 1: Через аргумент командной строки (рекомендуется) ⭐

Самый надежный способ - передать пароль через аргумент командной строки:

**Windows (PowerShell):**
```powershell
python server.py --password "ваш_безопасный_пароль"
```

**Windows (CMD):**
```cmd
python server.py --password "ваш_безопасный_пароль"
```

**Linux/Mac:**
```bash
python server.py --password "ваш_безопасный_пароль"
```

### Вариант 2: Через переменную окружения

Установите переменную окружения `SITE_PASSWORD` перед запуском сервера:

**Windows (PowerShell):**
```powershell
$env:SITE_PASSWORD="ваш_безопасный_пароль"
python server.py
```

**Windows (CMD):**
```cmd
set SITE_PASSWORD=ваш_безопасный_пароль
python server.py
```

**Linux/Mac:**
```bash
export SITE_PASSWORD="ваш_безопасный_пароль"
python server.py
```

⚠️ **Примечание:** В PowerShell переменные окружения могут не передаваться правильно. Используйте вариант 1 (аргумент командной строки).

### Вариант 3: Через файл .env

1. Установите `python-dotenv`:
   ```bash
   pip install python-dotenv
   ```

2. Создайте файл `.env` в корне проекта:
   ```
   SITE_PASSWORD=ваш_безопасный_пароль
   ```

3. Запустите сервер:
   ```bash
   python server.py
   ```

### Вариант 4: Изменить в коде (не рекомендуется)

Откройте файл `server.py` и измените значение по умолчанию в функции `get_password_from_env()`:

```python
return "ваш_безопасный_пароль"  # вместо "admin123"
```

⚠️ **Важно:** Измените пароль по умолчанию `admin123` на безопасный пароль!

## Настройка JWT секретного ключа

Для продакшена установите переменную окружения `JWT_SECRET_KEY`:

**Windows (PowerShell):**
```powershell
$env:JWT_SECRET_KEY="ваш_длинный_случайный_секретный_ключ"
```

**Linux/Mac:**
```bash
export JWT_SECRET_KEY="ваш_длинный_случайный_секретный_ключ"
```

⚠️ **Важно:** Используйте длинный случайный ключ в продакшене! Можно сгенерировать через:
```python
import secrets
print(secrets.token_urlsafe(32))
```

## Установка зависимостей

Установите необходимые Python библиотеки:

```bash
pip install -r requirements.txt
```

## Использование

1. Запустите сервер с паролем:
   ```bash
   python server.py --password "ваш_пароль"
   ```
   
   Или используйте переменную окружения:
   ```bash
   $env:SITE_PASSWORD="ваш_пароль"
   python server.py
   ```

