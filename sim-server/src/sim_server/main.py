
from fastapi import FastAPI
import uvicorn
from dotenv import load_dotenv
import os
from pathlib import Path

from server_helpers import log_timing, parse_simulation_params, serialize_simulation_results
from constants.schemas import PlanetParams, InitParams, VehicleParams, ControlParams
from OP.main import high_fidelity_simulation

DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 8000

LOG_CONFIG = Path(__file__).parent / "log.ini"

load_dotenv()
app = FastAPI()

@app.post("/simulate/high-fidelity/")
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

    # Serialize results for JSON response
    results = serialize_simulation_results(results, use_arrow=serialize_arrow)

    return results

if __name__ == "__main__":
    host = os.getenv("SIM_SERVER_HOST", DEFAULT_HOST)
    port = int(os.getenv("SIM_SERVER_PORT", DEFAULT_PORT))
    
    # Determine if running in production mode
    if os.getenv("IS_PRODUCTION", "False").lower() in ("true", "1", "yes"):
        uvicorn.run("main:app", host=host, port=port, log_config=LOG_CONFIG)
    else:
        uvicorn.run("main:app", host=host, port=port, reload=True)