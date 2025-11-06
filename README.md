# KARTA - Interactive Map Application

Интерактивное картографическое приложение с поддержкой построения маршрутов и измерения расстояний.

## Структура проекта

- `src/` - исходные файлы фронтенда (HTML, CSS, JS)
- `public/` - статические файлы (favicon и т.д.)
- `dist/` - собранные файлы для деплоя на GitHub Pages (генерируется автоматически)
- `server.py` - серверная часть (FastAPI) для работы с высотами (деплоится на Render.com)

## Разработка

### Установка зависимостей

```bash
npm install
```

### Локальная разработка

```bash
npm run dev
```

Приложение будет доступно по адресу `http://localhost:3000`

### Сборка для продакшена

```bash
npm run build
```

Собранные файлы будут находиться в папке `dist/`

### Просмотр собранной версии

```bash
npm run preview
```

## Деплой

### GitHub Pages

Проект автоматически собирается и деплоится на GitHub Pages при каждом push в ветку `master` или `main` через GitHub Actions.

Workflow файл: `.github/workflows/deploy.yml`

**Важно:** Убедитесь, что в настройках репозитория GitHub включен GitHub Pages и выбран источник "GitHub Actions".

### Render.com (Backend)

Серверная часть (`server.py`) должна быть развернута отдельно на Render.com или другом хостинге.

## Настройка GitHub Pages

1. Перейдите в Settings → Pages вашего репозитория
2. В разделе "Source" выберите "GitHub Actions"
3. При каждом push в `master`/`main` будет автоматически запускаться сборка и деплой

### Настройка base path

Если ваш сайт размещен не в корне домена (например, `username.github.io/repo-name`), необходимо обновить `base` в `vite.config.js`:

```javascript
base: '/repo-name/', // Замените repo-name на имя вашего репозитория
```

Если сайт размещен в корне (`username.github.io`), оставьте `base: '/'`.

## Структура файлов в репозитории

В репозитории хранятся:
- Исходные файлы (`src/`, `public/`)
- Конфигурационные файлы (`vite.config.js`, `package.json`, `.gitignore`)
- GitHub Actions workflow (`.github/workflows/deploy.yml`)
- Документация (`.md` файлы)
- Серверные файлы (`server.py`, `requirements.txt`, `strm/`)

В папке `dist/` (которая генерируется при сборке) хранится только готовый для деплоя код, который автоматически публикуется на GitHub Pages.

## Переменные окружения

Для серверной части (Render.com) необходимо установить:
- `SITE_PASSWORD` - пароль для доступа к сайту
- `JWT_SECRET_KEY` - секретный ключ для JWT токенов

## Технологии

- **Frontend:** HTML, CSS, JavaScript (Vanilla)
- **Build Tool:** Vite
- **Maps:** Leaflet.js
- **Backend:** FastAPI (Python)
- **Deployment:** GitHub Pages (Frontend), Render.com (Backend)

