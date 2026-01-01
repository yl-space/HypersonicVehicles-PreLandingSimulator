
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dotenv import load_dotenv
import os
from pathlib import Path
import httpx

from src.sim_server.server_helpers import log_timing, parse_simulation_params, serialize_simulation_results
from src.sim_server.constants.schemas import PlanetParams, InitParams, SphericalInitParams, CartesianInitParams, VehicleParams, ControlParams
from src.sim_server.constants.defaults import DEFAULT_INIT
from src.sim_server.OP.main import high_fidelity_simulation
from src.sim_server.OP.coordinates import Cartesian_to_Spherical

DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 8000

LOG_CONFIG = Path(__file__).parent / "log.ini"

load_dotenv()
app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
)

import logging

logger = logging.getLogger("uvicorn")

# WMTS base for Viking MDIM21 (232m); includes TileMatrixSet "default028mm"
WMTS_MARS_BASE = "https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm"
# Local cache for tiles (prefetched during Docker build; also filled on-demand)
TILE_CACHE_DIR = Path(os.getenv("TILE_CACHE_DIR", "/app/tile_cache/mars"))
TILE_CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Reuse a single async HTTP client to avoid connection setup overhead on every tile
HTTP_CLIENT = httpx.AsyncClient(
    timeout=10.0,
    limits=httpx.Limits(max_keepalive_connections=20, max_connections=50)
)

@app.get("/health")
async def health_check():
    """Health check endpoint for client to verify backend is available."""
    return {"status": "healthy", "service": "sim-server", "port": DEFAULT_PORT}

@app.get("/tiles/mars/{z}/{x}/{y}.{ext}")
async def proxy_mars_tile(z: int, x: int, y: int, ext: str = "jpg"):
    """
    Proxy Mars WMTS tiles from NASA Trek to avoid CORS issues in the client.
    URL pattern matches XYZ-style requests from the frontend and forwards to Trek.
    """
    cache_path = TILE_CACHE_DIR / str(z) / str(x) / f"{y}.{ext}"
    if cache_path.exists():
        try:
            data = cache_path.read_bytes()
            return Response(
                content=data,
                media_type="image/jpeg",
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "public, max-age=31536000"
                }
            )
        except Exception:
            # If cache read fails, continue to fetch from upstream
            pass

    # Try requested extension first, then fall back to the other common one.
    candidates = [ext]
    if ext.lower() == "png":
        candidates.append("jpg")
    else:
        candidates.append("png")

    try:
        for candidate_ext in candidates:
            url = f"{WMTS_MARS_BASE}/{z}/{x}/{y}.{candidate_ext}"
            r = await HTTP_CLIENT.get(url)
            if r.status_code == 200:
                # Persist to cache for future hits
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                try:
                    cache_path.write_bytes(r.content)
                except Exception:
                    # Ignore cache write errors; still return tile
                    pass

                headers = {
                    "Content-Type": r.headers.get("Content-Type", f"image/{candidate_ext}"),
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "public, max-age=31536000"
                }
                return Response(content=r.content, media_type=headers["Content-Type"], headers=headers)
        raise HTTPException(status_code=404, detail=f"Upstream returned {r.status_code}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Tile fetch failed: {e}") from e

@app.post("/high-fidelity/")
@log_timing
async def simulate_high_fidelity(
    planet: PlanetParams = PlanetParams(),
    init: InitParams = SphericalInitParams(**DEFAULT_INIT),
    vehicle: VehicleParams = VehicleParams(),
    control: ControlParams = ControlParams(),
    serialize_arrow: bool = False
):
    """Run a high-fidelity simulation with the provided parameters."""

    # Parse and override parameters
    planet_specific_params, init_params, vehicle_specific_params, control_params = parse_simulation_params(
        planet, init, vehicle, control
    )

    # Run the high-fidelity simulation
    results = high_fidelity_simulation(
        planet=planet_specific_params,
        init=init_params,
        vehicle=vehicle_specific_params,
        control=control_params,
        verbose=False, 
        return_states=False
    )

    # print final values for debug
    final_time = results['time_s'][-1]
    final_velocity = (results['vx_m_s'][-1]**2 + results['vy_m_s'][-1]**2 + results['vz_m_s'][-1]**2)**0.5
    logger.info(f"\n=== FINAL SIMULATION RESULTS ===")
    logger.info(f"Final time: {final_time:.2f} seconds")
    logger.info(f"Final velocity: {final_velocity/1000:.2f} km/s" "= Mach " + str(final_velocity/236.38))

    # Serialize results for JSON response
    results = serialize_simulation_results(results, use_arrow=serialize_arrow)

    return results

if __name__ == "__main__":
    @app.on_event("shutdown")
    async def _shutdown_event():
        try:
            await HTTP_CLIENT.aclose()
        except Exception:
            pass

    host = os.getenv("SIM_SERVER_HOST", DEFAULT_HOST)
    port = int(os.getenv("SIM_SERVER_PORT", DEFAULT_PORT))
    
    # Determine if running in production mode
    if os.getenv("IS_PRODUCTION", "False").lower() in ("true", "1", "yes"):
        uvicorn.run("src.sim_server.main:app", host=host, port=port, log_config=LOG_CONFIG)
    else:
        uvicorn.run("src.sim_server.main:app", host=host, port=port, reload=True)
