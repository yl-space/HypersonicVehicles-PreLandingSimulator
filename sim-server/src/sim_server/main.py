
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dotenv import load_dotenv
import os
from pathlib import Path

from src.sim_server.server_helpers import log_timing, parse_simulation_params, serialize_simulation_results
from src.sim_server.constants.schemas import PlanetParams, InitParams, VehicleParams, ControlParams
from src.sim_server.OP.main import high_fidelity_simulation

DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 3010

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

@app.get("/health")
async def health_check():
    """Health check endpoint for client to verify backend is available."""
    return {"status": "healthy", "service": "sim-server", "port": DEFAULT_PORT}

@app.post("/high-fidelity/")
@log_timing
async def simulate_high_fidelity(
    planet: PlanetParams = PlanetParams(),
    init: InitParams = InitParams(),
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
    host = os.getenv("SIM_SERVER_HOST", DEFAULT_HOST)
    port = int(os.getenv("SIM_SERVER_PORT", DEFAULT_PORT))
    
    # Determine if running in production mode
    if os.getenv("IS_PRODUCTION", "False").lower() in ("true", "1", "yes"):
        uvicorn.run("src.sim_server.main:app", host=host, port=port, log_config=LOG_CONFIG)
    else:
        uvicorn.run("src.sim_server.main:app", host=host, port=port, reload=True)