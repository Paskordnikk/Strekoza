from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional, Dict
import os
import hmac
import hashlib
import json
from urllib.parse import unquote
from datetime import datetime, timedelta
from jose import JWTError, jwt
from srtm import Srtm3HeightMapCollection
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import telegram

# --- CONFIGURATION ---

# WARNING: Do not hardcode tokens in production. Use environment variables.
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "8007666541:AAEoLdA0VxHOREXh1nq6KXaDdIkl8JytTEQ")

# Set the environment variable for the SRTM data directory
os.environ['SRTM3_DIR'] = 'strm'

# JWT Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "a-very-secret-key-that-you-should-change")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# --- TELEGRAM BOT AND SECURITY ---

bot = telegram.Bot(token=BOT_TOKEN)
security = HTTPBearer()

def verify_telegram_init_data(init_data: str) -> Optional[Dict]:
    """
    Validates the initData string from a Telegram Mini App.
    
    Returns:
        A dictionary with user data if validation is successful, otherwise None.
    """
    try:
        # Parse the query string
        parsed_data = dict(param.split('=', 1) for param in init_data.split('&'))
        hash_from_telegram = parsed_data.pop('hash')
        
        # The data needs to be sorted by key
        sorted_keys = sorted(parsed_data.keys())
        data_check_string = "\n".join(f"{key}={unquote(parsed_data[key])}" for key in sorted_keys)
        
        # Calculate the secret key
        secret_key = hmac.new("WebAppData".encode(), BOT_TOKEN.encode(), hashlib.sha256).digest()
        
        # Calculate our hash
        calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

        # Compare hashes
        if calculated_hash == hash_from_telegram:
            user_data = json.loads(unquote(parsed_data.get('user', '{}')))
            return user_data
        
        return None
    except Exception as e:
        print(f"Error validating initData: {e}")
        return None

# --- JWT HELPERS ---

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Creates a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict:
    """Validates JWT token from the Authorization header and returns its payload."""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("sub") is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

# --- PYDANTIC MODELS ---

class TelegramAuthRequest(BaseModel):
    initData: str

class RouteData(BaseModel):
    points: List[List[float]]

class CsvExportRequest(BaseModel):
    csv: str

# --- FASTAPI APP INITIALIZATION ---

app = FastAPI(
    title="Karta API",
    description="API for map and elevation data, integrated with Telegram.",
    version="1.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_noindex_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Robots-Tag"] = "noindex, nofollow"
    return response

# --- SRTM DATA INITIALIZATION ---

try:
    srtm_data = Srtm3HeightMapCollection()
except Exception as e:
    print(f"Error initializing SRTM data: {e}")
    srtm_data = None

# --- API ENDPOINTS ---

@app.get("/", tags=["Status"])
def root():
    return {"message": "Server is running", "docs": "/docs"}

@app.post("/api/auth_telegram", tags=["Authentication"])
def telegram_login(auth_request: TelegramAuthRequest):
    """
    Authenticates a user based on their Telegram Mini App initData.
    Returns a JWT token if the user is valid.
    """
    user_data = verify_telegram_init_data(auth_request.initData)
    
    if not user_data or 'id' not in user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing Telegram initData."
        )
    
    user_id = user_data['id']
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user_id)}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/get_elevation", tags=["Elevation"])
def get_elevation_profile(route_data: RouteData, token: dict = Depends(verify_token)):
    """Calculates the elevation profile for a given route."""
    if not srtm_data:
        raise HTTPException(status_code=503, detail="SRTM data service is unavailable.")

    elevations = []
    raw_elevations = []
    for point in route_data.points:
        lat, lng = point
        try:
            elevation = srtm_data.get_altitude(latitude=lat, longitude=lng)
            raw_elevations.append(elevation if elevation is not None and elevation >= 0 else None)
        except Exception:
            raw_elevations.append(None)
    
    # Interpolate missing values
    for i, elev in enumerate(raw_elevations):
        if elev is None:
            prev_val = next((e for e in reversed(raw_elevations[:i]) if e is not None), None)
            next_val = next((e for e in raw_elevations[i+1:] if e is not None), None)
            
            if prev_val is not None and next_val is not None:
                elevations.append((prev_val + next_val) / 2)
            elif prev_val is not None:
                elevations.append(prev_val)
            elif next_val is not None:
                elevations.append(next_val)
            else:
                elevations.append(0)
        else:
            elevations.append(elev)
            
    return {"elevations": elevations}

@app.post("/api/export_route", tags=["Export"])
async def export_route_to_csv(export_data: CsvExportRequest, token: dict = Depends(verify_token)):
    """
    Receives CSV data and sends it as a file to the user via Telegram bot.
    """
    user_id = token.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User ID not found in token.")

    try:
        # Prepare the file
        csv_bytes = export_data.csv.encode('utf-8')
        file_name = f"route_profile_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        # Send the file via the bot
        await bot.send_document(
            chat_id=user_id,
            document=csv_bytes,
            filename=file_name,
            caption="Ваш профиль маршрута. Откройте этот файл в редакторе таблиц."
        )
        
        return {"status": "sent", "filename": file_name}
    except telegram.error.TelegramError as e:
        print(f"Telegram API Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send file via Telegram: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred while exporting the file.")

# --- MAIN EXECUTION ---

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = "0.0.0.0" if os.getenv("PORT") else "127.0.0.1"
    
    print(f"[INFO] Starting server on {host}:{port}")
    print(f"[INFO] JWT Secret Key is {'SET' if SECRET_KEY != 'a-very-secret-key-that-you-should-change' else 'USING DEFAULT (UNSAFE)'}")
    print(f"[INFO] Telegram Bot Token is {'SET' if BOT_TOKEN != 'YOUR_BOT_TOKEN_HERE' else 'NOT SET'}")
    
    uvicorn.run(app, host=host, port=port)