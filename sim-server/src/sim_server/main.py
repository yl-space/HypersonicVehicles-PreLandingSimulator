
from fastapi import FastAPI
import uvicorn
from dotenv import load_dotenv
import os

from server_helpers import parse_simulation_params, serialize_simulation_results
from constants.schemas import PlanetParams, InitParams, VehicleParams, ControlParams
from OP.main import high_fidelity_simulation

DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 8000

load_dotenv()
app = FastAPI()

@app.post("/simulate/high-fidelity/")
async def simulate_high_fidelity(
    planet: PlanetParams = PlanetParams(),
    init: InitParams = InitParams(),
    vehicle: VehicleParams = VehicleParams(),
    control: ControlParams = ControlParams()
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
    results = serialize_simulation_results(results)

    return {"results": results}

if __name__ == "__main__":
    host = os.getenv("SIM_SERVER_HOST", DEFAULT_HOST)
    port = int(os.getenv("SIM_SERVER_PORT", DEFAULT_PORT))
    uvicorn.run("main:app", host=host, port=port, reload=True)