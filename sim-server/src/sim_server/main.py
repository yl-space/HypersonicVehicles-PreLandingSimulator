
from fastapi import FastAPI
import uvicorn
from dotenv import load_dotenv
import os

from constants.defaults import DEFAULT_PLANET, DEFAULT_INIT, DEFAULT_VEHICLE, DEFAULT_CONTROL
from constants.defaults import override_defaults
from constants.vehicles import get_vehicle_params
from constants.planets import get_planet_params
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
    # Override defaults with provided parameters
    planet_params = override_defaults(DEFAULT_PLANET, planet.model_dump())
    init_params = override_defaults(DEFAULT_INIT, init.model_dump())
    vehicle_params = override_defaults(DEFAULT_VEHICLE, vehicle.model_dump())
    control_params = override_defaults(DEFAULT_CONTROL, control.model_dump())

    # Retrieve specific parameters for planet and vehicle (e.g., from 'mars' to actual values)
    planet_specific_params = get_planet_params(planet_params["planet_name"])
    vehicle_specific_params = get_vehicle_params(vehicle_params["vehicle_name"])

    # Run the high-fidelity simulation
    results = high_fidelity_simulation(
        planet=planet_specific_params,
        init=init_params,
        vehicle=vehicle_specific_params,
        control=control_params,
        verbose=False,
        return_states=False
    )

    # Convert results from numpy arrays to lists for JSON serialization
    for key in results:
        if isinstance(results[key], (list, tuple)):
            continue
        try:
            results[key] = results[key].tolist()[:10]
        except AttributeError:
            pass  # Not a numpy array, no need to convert

    return {"results": results}

if __name__ == "__main__":
    host = os.getenv("SIM_SERVER_HOST", DEFAULT_HOST)
    port = int(os.getenv("SIM_SERVER_PORT", DEFAULT_PORT))
    uvicorn.run("main:app", host=host, port=port, reload=True)