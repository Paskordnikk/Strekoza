
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import Response
from pydantic import BaseModel
from typing import List, Optional
import os
import sys
import argparse
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from srtm import Srtm3HeightMapCollection
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import httpx
import io

# Set the environment variable for the SRTM data directory
# This must be done before creating the collection object.
os.environ['SRTM3_DIR'] = 'strm'

# JWT Configuration
# Секретный ключ будет установлен позже, если передан через аргумент
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-this-in-production")  # Измените на безопасный ключ в продакшене!
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 1  # Срок действия токена в минутах (последняя цифра - количество дней).

# Password configuration
# Пароль можно установить несколькими способами (в порядке приоритета):
# 1. Через аргумент командной строки: python server.py --password "ваш_пароль"
# 2. Через переменную окружения SITE_PASSWORD
# 3. Через файл .env (если установлен python-dotenv)
# 4. По умолчанию (не рекомендуется для продакшена)

def get_password_from_env():
    """Получает пароль из переменных окружения или .env файла"""
    # Приоритет 1: переменная окружения
    env_password = os.getenv("SITE_PASSWORD")
    if env_password:
        return env_password
    
    # Приоритет 2: файл .env (если есть)
    try:
        from dotenv import load_dotenv
        load_dotenv()
        env_password = os.getenv("SITE_PASSWORD")
        if env_password:
            return env_password
    except ImportError:
        pass  # python-dotenv не установлен
    
    # Приоритет 3: значение по умолчанию
    return "admin123"

def get_password_from_args():
    """Получает пароль из аргументов командной строки (если есть)"""
    try:
        parser = argparse.ArgumentParser(description='Запуск сервера карты', add_help=False)
        parser.add_argument('--password', type=str, help='Пароль для доступа к сайту')
        args, unknown = parser.parse_known_args()
        if args.password:
            return args.password
    except:
        pass
    return None

# Проверяем аргументы командной строки сначала
password_from_args = get_password_from_args()
if password_from_args:
    SITE_PASSWORD = password_from_args
else:
    # Иначе используем переменные окружения или значение по умолчанию
    SITE_PASSWORD = get_password_from_env()

# Логирование при загрузке модуля (работает и при запуске через gunicorn)
if password_from_args:
    password_source = "аргумент командной строки (--password)"
elif os.getenv("SITE_PASSWORD"):
    password_source = "переменная окружения (SITE_PASSWORD)"
else:
    password_source = "по умолчанию (⚠️ НЕ БЕЗОПАСНО для продакшена!)"

print(f"[INFO] Пароль установлен: {password_source}, длина пароля: {len(SITE_PASSWORD)} символов")

def get_site_password():
    """Получает текущий пароль"""
    return SITE_PASSWORD

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

app = FastAPI(
    title="Karta API",
    description="API для работы с картой и высотами",
    version="1.0.0"
)

# Добавляем тестовые эндпоинты для проверки
@app.get("/", tags=["test"])
def root():
    return {
        "message": "Server is running",
        "endpoints": ["/api/login", "/api/get_elevation"],
        "docs": "/docs",
        "openapi": "/openapi.json"
    }

@app.get("/health", tags=["test"])
def health():
    return {
        "status": "ok",
        "password_set": bool(os.getenv("SITE_PASSWORD")),
        "password_length": len(SITE_PASSWORD) if SITE_PASSWORD else 0
    }

# Allow CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],   # Allows all headers
)

# Middleware для предотвращения индексации поисковыми системами
@app.middleware("http")
async def add_noindex_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Robots-Tag"] = "noindex, nofollow, noarchive, nosnippet, noimageindex"
    return response

# Define the request body structure
class RouteData(BaseModel):
    points: List[List[float]]  # A list of [lat, lng] pairs

class LoginRequest(BaseModel):
    password: str

class TelegramFileRequest(BaseModel):
    file_id: str

# Create an instance of the Srtm3HeightMapCollection
# It will use the SRTM3_DIR environment variable to find the .hgt files.
try:
    srtm_data = Srtm3HeightMapCollection()
except Exception as e:
    print("Error initializing SRTM data collection.")
    print("Please ensure the 'strm' directory exists and contains valid .hgt files.")
    print(f"Error details: {e}")
    srtm_data = None

# JWT Helper Functions
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверяет пароль"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Хеширует пароль"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Создает JWT токен"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Проверяет JWT токен из заголовка Authorization"""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный или истекший токен",
            headers={"WWW-Authenticate": "Bearer"},
        )

# Login endpoint
@app.post("/api/login", tags=["authentication"])
def login(login_request: LoginRequest):
    """Эндпоинт для входа. Проверяет пароль и возвращает JWT токен."""
    # Получаем текущий пароль (может быть изменен через аргумент командной строки)
    current_password = get_site_password()
    
    if login_request.password != current_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный пароль"
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": "user"}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/get_elevation", tags=["elevation"])
def get_elevation_profile(route_data: RouteData, token: dict = Depends(verify_token)):
    elevations = []
    if not srtm_data:
        return {"error": "SRTM data not initialized. Check server logs."}

    # First pass: collect raw elevations, mark invalid ones as None
    raw_elevations = []
    for point in route_data.points:
        lat, lng = point
        try:
            elevation = srtm_data.get_altitude(latitude=lat, longitude=lng)
            
            if elevation is None:
                raw_elevations.append(None)
            elif elevation < 0:
                raw_elevations.append(None)
            else:
                raw_elevations.append(elevation)
        except Exception as e:
            raw_elevations.append(None)
    
    # Second pass: interpolate missing values with smart strategy
    for i in range(len(raw_elevations)):
        if raw_elevations[i] is None:
            # Find previous valid value
            prev_val = None
            prev_idx = None
            for j in range(i - 1, -1, -1):
                if raw_elevations[j] is not None:
                    prev_val = raw_elevations[j]
                    prev_idx = j
                    break
            
            # Find next valid value
            next_val = None
            next_idx = None
            for j in range(i + 1, len(raw_elevations)):
                if raw_elevations[j] is not None:
                    next_val = raw_elevations[j]
                    next_idx = j
                    break
            
            # Smart interpolation strategy
            if prev_val is not None and next_val is not None:
                # Check if we're in a low-elevation area (likely water)
                # If both neighbors are very low (< 5m), use 0 (sea level)
                if prev_val < 5 and next_val < 5:
                    elevations.append(0)
                else:
                    # Linear interpolation for normal terrain
                    weight = (i - prev_idx) / (next_idx - prev_idx)
                    interpolated = prev_val + (next_val - prev_val) * weight
                    elevations.append(interpolated)
            elif prev_val is not None:
                # Use previous value, but if it's very low, use 0
                elevations.append(0 if prev_val < 5 else prev_val)
            elif next_val is not None:
                # Use next value, but if it's very low, use 0
                elevations.append(0 if next_val < 5 else next_val)
            else:
                # No valid values at all - use 0 (sea level)
                elevations.append(0)
        else:
            elevations.append(raw_elevations[i])
            
    return {"elevations": elevations}

# Telegram Bot API Configuration
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_API_URL = "https://api.telegram.org/bot"

def get_telegram_bot_token():
    """Получает токен Telegram бота"""
    if not TELEGRAM_BOT_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="TELEGRAM_BOT_TOKEN не настроен на сервере"
        )
    return TELEGRAM_BOT_TOKEN

@app.post("/api/telegram/upload", tags=["telegram"])
async def upload_telegram_file(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    token: dict = Depends(verify_token)
):
    """
    Загружает файл в Telegram Bot API и возвращает file_id
    Отправляет файл пользователю в личные сообщения
    """
    try:
        bot_token = get_telegram_bot_token()
        
        # Читаем содержимое файла
        file_content = await file.read()
        
        # Создаем временный файл в памяти
        file_obj = io.BytesIO(file_content)
        file_obj.name = file.filename
        
        # Загружаем файл в Telegram через Bot API
        # Отправляем файл пользователю в личные сообщения
        async with httpx.AsyncClient() as client:
            files = {
                'document': (file.filename, file_obj, file.content_type or 'application/octet-stream')
            }
            
            response = await client.post(
                f"{TELEGRAM_API_URL}{bot_token}/sendDocument",
                data={
                    'chat_id': user_id  # Отправляем пользователю в личные сообщения
                },
                files=files,
                timeout=30.0
            )
            
            if response.status_code != 200:
                error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
                error_description = error_data.get('description', 'Неизвестная ошибка')
                
                # Если пользователь не начал диалог с ботом, возвращаем понятное сообщение
                if 'bot was blocked' in error_description.lower() or 'chat not found' in error_description.lower():
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Для работы с файлами через Telegram необходимо начать диалог с ботом. Пожалуйста, напишите боту любое сообщение и попробуйте снова."
                    )
                
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Ошибка загрузки файла в Telegram: {error_description}"
                )
            
            result = response.json()
            if not result.get('ok'):
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Ошибка Telegram API: {result.get('description', 'Неизвестная ошибка')}"
                )
            
            # Получаем file_id из ответа
            document = result.get('result', {}).get('document', {})
            file_id = document.get('file_id')
            
            if not file_id:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Не удалось получить file_id из ответа Telegram"
                )
            
            return {"file_id": file_id}
            
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка соединения с Telegram API: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка загрузки файла: {str(e)}"
        )

@app.post("/api/telegram/download", tags=["telegram"])
async def download_telegram_file(
    file_request: TelegramFileRequest,
    token: dict = Depends(verify_token)
):
    """
    Получает файл из Telegram Bot API по file_id
    """
    try:
        bot_token = get_telegram_bot_token()
        
        # Получаем информацию о файле
        async with httpx.AsyncClient() as client:
            # Сначала получаем информацию о файле
            file_info_response = await client.get(
                f"{TELEGRAM_API_URL}{bot_token}/getFile",
                params={"file_id": file_request.file_id},
                timeout=30.0
            )
            
            if file_info_response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Ошибка получения информации о файле из Telegram"
                )
            
            file_info = file_info_response.json()
            if not file_info.get('ok'):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Файл не найден в Telegram"
                )
            
            file_path = file_info.get('result', {}).get('file_path')
            if not file_path:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Не удалось получить путь к файлу"
                )
            
            # Скачиваем файл
            file_url = f"https://api.telegram.org/file/bot{bot_token}/{file_path}"
            file_response = await client.get(file_url, timeout=30.0)
            
            if file_response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Ошибка скачивания файла из Telegram"
                )
            
            # Определяем content-type
            content_type = file_response.headers.get('content-type', 'application/octet-stream')
            
            # Определяем имя файла из пути
            filename = os.path.basename(file_path)
            
            return Response(
                content=file_response.content,
                media_type=content_type,
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"'
                }
            )
            
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка соединения с Telegram API: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка получения файла: {str(e)}"
        )

# Логирование зарегистрированных эндпоинтов при загрузке модуля
print(f"[INFO] FastAPI app created. Registered routes:")
for route in app.routes:
    if hasattr(route, 'methods') and hasattr(route, 'path'):
        print(f"[INFO]   {list(route.methods)} {route.path}")

if __name__ == "__main__":
    # Парсим аргументы командной строки для логирования и секретного ключа
    parser = argparse.ArgumentParser(description='Запуск сервера карты')
    parser.add_argument('--password', type=str, help='Пароль для доступа к сайту')
    parser.add_argument('--secret-key', type=str, help='Секретный ключ для JWT')
    args = parser.parse_args()
    
    # Определяем источник пароля для логирования
    if args.password:
        # Пароль уже установлен в get_password_from_args() при инициализации
        password_source = "аргумент командной строки (--password)"
    elif os.getenv("SITE_PASSWORD"):
        password_source = "переменная окружения (SITE_PASSWORD)"
    else:
        password_source = "по умолчанию (⚠️ НЕ БЕЗОПАСНО для продакшена!)"
    
    # Выводим информацию о пароле при старте (безопасно, только длину)
    print(f"[INFO] Пароль установлен: {password_source}, длина пароля: {len(SITE_PASSWORD)} символов")
    
    # Обрабатываем секретный ключ JWT
    if args.secret_key:
        SECRET_KEY = args.secret_key
        print(f"[INFO] JWT секретный ключ установлен через аргумент командной строки")
    
    # Настройка для продакшена (Render.com, Heroku и т.д.)
    # Render.com использует переменную окружения PORT
    port = int(os.getenv("PORT", 8000))
    host = "0.0.0.0" if os.getenv("PORT") else "127.0.0.1"  # 0.0.0.0 для продакшена, 127.0.0.1 для локальной разработки
    
    uvicorn.run(app, host=host, port=port)
