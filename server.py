from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional, Dict
import os
import hmac
import hashlib
import json
import struct
from urllib.parse import unquote
from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import telegram
from osgeo import gdal

# --- CONFIGURATION ---

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "YOUR_BOT_TOKEN_HERE")
SRTM_DIR = os.getenv('SRTM3_DIR', 'strm')
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "a-very-secret-key-that-you-should-change")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# --- GDAL ELEVATION DATA MANAGER ---
class HgtDataManager:
    def __init__(self, directory):
        self.directory = directory
        self.datasets = {}
        gdal.UseExceptions()

    def get_elevation(self, lat, lon):
        file_path = self._get_file_path(lat, lon)
        if not file_path:
            return None

        try:
            ds = self._get_dataset(file_path)
            if ds is None:
                return None

            # HGT files are 1201x1201 or 3601x3601
            # For SRTM3 (3 arc-second), it's 1201x1201
            transform = ds.GetGeoTransform()
            x_origin = transform[0]
            y_origin = transform[3]
            x_pixel_size = transform[1]
            y_pixel_size = transform[5]

            # Compute pixel offset
            x_offset = int((lon - x_origin) / x_pixel_size)
            y_offset = int((lat - y_origin) / y_pixel_size)

            band = ds.GetRasterBand(1)
            # Read 1x1 pixel at the specified offset
            data = band.ReadRaster(x_offset, y_offset, 1, 1, buf_type=gdal.GDT_Int16)
            
            if data:
                # Unpack the binary data (short integer)
                elevation = struct.unpack('>h', data)[0]
                # SRTM data has voids represented by -32768
                return elevation if elevation != -32768 else None
            return None

        except Exception as e:
            # This can happen if coordinates are outside the file's bounds
            # print(f"Error reading elevation for ({lat}, {lon}): {e}")
            return None

    def _get_dataset(self, file_path):
        if file_path in self.datasets:
            return self.datasets[file_path]
        
        if os.path.exists(file_path):
            ds = gdal.Open(file_path)
            self.datasets[file_path] = ds
            return ds
        return None

    def _get_file_path(self, lat, lon):
        # Determine hemisphere and format the filename
        lat_hemi = 'N' if lat >= 0 else 'S'
        lon_hemi = 'E' if lon >= 0 else 'W'
        
        # Floor the coordinates to get the bottom-left corner of the tile
        lat_int = int(abs(lat))
        lon_int = int(abs(lon))

        file_name = f"{lat_hemi}{lat_int:02d}{lon_hemi}{lon_int:03d}.hgt"
        return os.path.join(self.directory, file_name)

    def __del__(self):
        # Clean up open datasets
        for ds in self.datasets.values():
            ds = None

# --- TELEGRAM BOT AND SECURITY ---
bot = telegram.Bot(token=BOT_TOKEN)
security = HTTPBearer()

def verify_telegram_init_data(init_data: str) -> Optional[Dict]:
    try:
        parsed_data = dict(param.split('=', 1) for param in init_data.split('&'))
        hash_from_telegram = parsed_data.pop('hash')
        data_check_string = "\n".join(f"{key}={unquote(parsed_data[key])}" for key in sorted(parsed_data.keys()))
        secret_key = hmac.new("WebAppData".encode(), BOT_TOKEN.encode(), hashlib.sha256).digest()
        calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
        if calculated_hash == hash_from_telegram:
            return json.loads(unquote(parsed_data.get('user', '{}')))
        return None
    except Exception:
        return None

# --- JWT HELPERS ---
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("sub") is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
        return payload
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

# --- PYDANTIC MODELS ---
class TelegramAuthRequest(BaseModel): initData: str
class RouteData(BaseModel): points: List[List[float]]
class CsvExportRequest(BaseModel): csv: str

# --- FASTAPI APP INITIALIZATION ---
app = FastAPI(title="Karta API", version="1.2.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# --- ELEVATION DATA MANAGER INSTANCE ---
srtm_data_manager = HgtDataManager(SRTM_DIR)

# --- API ENDPOINTS ---
@app.get("/", tags=["Status"])
def root(): return {"message": "Server is running", "docs": "/docs"}

@app.post("/api/auth_telegram", tags=["Authentication"])
def telegram_login(auth_request: TelegramAuthRequest):
    user_data = verify_telegram_init_data(auth_request.initData)
    if not user_data or 'id' not in user_data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Telegram initData.")
    access_token = create_access_token(data={"sub": str(user_data['id'])})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/get_elevation", tags=["Elevation"])
def get_elevation_profile(route_data: RouteData, token: dict = Depends(verify_token)):
    elevations = []
    for point in route_data.points:
        lat, lng = point
        elevation = srtm_data_manager.get_elevation(lat, lng)
        elevations.append(elevation if elevation is not None and elevation > 0 else 0)
    return {"elevations": elevations}

@app.post("/api/export_route", tags=["Export"])
async def export_route_to_csv(export_data: CsvExportRequest, token: dict = Depends(verify_token)):
    user_id = token.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User ID not found in token.")
    try:
        csv_bytes = export_data.csv.encode('utf-8')
        file_name = f"route_profile_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        await bot.send_document(chat_id=user_id, document=csv_bytes, filename=file_name, caption="Ваш профиль маршрута.")
        return {"status": "sent", "filename": file_name}
    except telegram.error.TelegramError as e:
        raise HTTPException(status_code=500, detail=f"Failed to send file via Telegram: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail="An internal error occurred.")

# --- MAIN EXECUTION ---
if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = "0.0.0.0" if os.getenv("PORT") else "127.0.0.1"
    uvicorn.run(app, host=host, port=port)
