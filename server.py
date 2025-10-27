
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

    for point in route_data.points:
        lat, lng = point
        try:
            elevation = srtm_data.get_altitude(latitude=lat, longitude=lng)
            if elevation is None:
                elevation = 0
            elevations.append(elevation)
        except Exception as e:
            print(f"Could not get altitude for {lat}, {lng}: {e}")
            elevations.append(0)
            
    return {"elevations": elevations}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
