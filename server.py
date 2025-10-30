
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
import os
from srtm import Srtm3HeightMapCollection
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Set the environment variable for the SRTM data directory
# This must be done before creating the collection object.
os.environ['SRTM3_DIR'] = 'strm'

app = FastAPI()

# Allow CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],   # Allows all headers
)

# Define the request body structure
class RouteData(BaseModel):
    points: List[List[float]]  # A list of [lat, lng] pairs

# Create an instance of the Srtm3HeightMapCollection
# It will use the SRTM3_DIR environment variable to find the .hgt files.
try:
    srtm_data = Srtm3HeightMapCollection()
except Exception as e:
    print("Error initializing SRTM data collection.")
    print("Please ensure the 'strm' directory exists and contains valid .hgt files.")
    print(f"Error details: {e}")
    srtm_data = None

@app.post("/api/get_elevation")
def get_elevation_profile(route_data: RouteData):
    elevations = []
    if not srtm_data:
        return {"error": "SRTM data not initialized. Check server logs."}

    # First pass: collect raw elevations, mark invalid ones as None
    raw_elevations = []
    for point in route_data.points:
        lat, lng = point
        try:
            elevation = srtm_data.get_altitude(latitude=lat, longitude=lng)
            
            # Log problematic elevations for debugging
            if elevation is None:
                print(f"Warning: SRTM returned None for coordinates ({lat}, {lng})")
                raw_elevations.append(None)
            elif elevation < 0:
                print(f"Warning: Negative elevation {elevation} at ({lat}, {lng}) - likely SRTM void data (missing/corrupted)")
                raw_elevations.append(None)
            else:
                raw_elevations.append(elevation)
        except Exception as e:
            print(f"Error: Could not get altitude for ({lat}, {lng}): {e}")
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
                    print(f"  → Using sea level (0m) for void between low points ({prev_val}m, {next_val}m)")
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

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
