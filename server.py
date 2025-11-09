
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
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

# Set the environment variable for the SRTM data directory
# This must be done before creating the collection object.
os.environ['SRTM3_DIR'] = 'strm'

# JWT Configuration
# Секретный ключ будет установлен позже, если передан через аргумент
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-this-in-production")  # Измените на безопасный ключ в продакшене!
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60  # Срок действия токена в минутах (последняя цифра - количество дней).

# Encryption Key Configuration
# Отдельная переменная для ключа шифрования данных
# Если не задана, используется JWT_SECRET_KEY как fallback
ENCRYPTION_SECRET_KEY = os.getenv("ENCRYPTION_SECRET_KEY", SECRET_KEY)

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
        "endpoints": ["/api/login", "/api/get_elevation", "/api/get_encryption_key", "/api/test_encryption_endpoint"],
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

@app.get("/api/test_encryption_endpoint", tags=["test"])
def test_encryption_endpoint():
    """Тестовый эндпоинт для проверки доступности API шифрования (без аутентификации)"""
    return {
        "message": "Эндпоинт шифрования доступен",
        "encryption_key_set": bool(ENCRYPTION_SECRET_KEY),
        "encryption_key_length": len(ENCRYPTION_SECRET_KEY) if ENCRYPTION_SECRET_KEY else 0
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

@app.get("/api/get_encryption_key", tags=["encryption"])
def get_encryption_key(token: dict = Depends(verify_token)):
    """Эндпоинт для получения ключа шифрования. Ключ производный от ENCRYPTION_SECRET_KEY (или JWT_SECRET_KEY)."""
    import hashlib
    import base64
    
    # Используем отдельную переменную для шифрования, если задана
    # Иначе используем JWT_SECRET_KEY как fallback
    encryption_key = ENCRYPTION_SECRET_KEY
    
    # Создаем ключ шифрования из секретного ключа
    # Используем SHA-256 для получения 32-байтового ключа
    key_hash = hashlib.sha256(encryption_key.encode()).digest()
    
    # Преобразуем в base64 для передачи клиенту
    key_base64 = base64.b64encode(key_hash).decode('utf-8')
    
    return {"key": key_base64}

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
