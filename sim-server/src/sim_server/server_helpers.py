from constants.defaults import DEFAULT_PLANET, DEFAULT_INIT, DEFAULT_VEHICLE, DEFAULT_CONTROL
from constants.defaults import override_defaults
from constants.vehicles import get_vehicle_params
from constants.planets import get_planet_params
from constants.schemas import PlanetParams, InitParams, VehicleParams, ControlParams

from typing import Optional

def parse_simulation_params(
    planet: PlanetParams = PlanetParams(),
    init: InitParams = InitParams(),
    vehicle: VehicleParams = VehicleParams(),
    control: ControlParams = ControlParams()
):
    """Parse and override simulation parameters with defaults."""

    # Override defaults with provided parameters
    planet_params = override_defaults(DEFAULT_PLANET, planet.model_dump())
    init_params = override_defaults(DEFAULT_INIT, init.model_dump())
    vehicle_params = override_defaults(DEFAULT_VEHICLE, vehicle.model_dump())
    control_params = override_defaults(DEFAULT_CONTROL, control.model_dump())

    # Retrieve specific parameters for planet and vehicle (e.g., from 'mars' to actual values)
    planet_specific_params = get_planet_params(planet_params["planet_name"])
    vehicle_specific_params = get_vehicle_params(vehicle_params["vehicle_name"])

    return planet_specific_params, init_params, vehicle_specific_params, control_params


def serialize_simulation_results(results: dict, max_items: Optional[int] = None) -> dict:
    """Convert numpy arrays in results to lists for JSON serialization, limiting to max_items."""
    serialized_results = {}
    for key, value in results.items():
        if isinstance(value, (list, tuple)):
            if max_items is not None:
                serialized_results[key] = value[:max_items]
            else:
                serialized_results[key] = value
        else:
            try:
                arr = value.tolist()
                if max_items is not None:
                    serialized_results[key] = arr[:max_items]
                else:
                    serialized_results[key] = arr
            except AttributeError:
                serialized_results[key] = value  # Not a numpy array, no need to convert
    return serialized_results