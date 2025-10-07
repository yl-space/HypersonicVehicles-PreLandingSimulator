from src.sim_server.constants.defaults import DEFAULT_PLANET, DEFAULT_INIT, DEFAULT_VEHICLE, DEFAULT_CONTROL
from src.sim_server.constants.defaults import override_defaults
from src.sim_server.constants.vehicles import get_vehicle_params
from src.sim_server.constants.planets import get_planet_params
from src.sim_server.constants.schemas import PlanetParams, InitParams, VehicleParams, ControlParams

from fastapi.responses import Response

import pyarrow as pa

import time
import functools
import logging

logger = logging.getLogger("uvicorn")

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


def serialize_simulation_results_to_lists(results: dict) -> dict:
    """Convert numpy arrays in results to lists for JSON serialization."""
    serialized_results = {}
    for key, value in results.items():
        if not isinstance(value, (list, tuple)):
            try:
                arr = value.tolist()
                serialized_results[key] = arr
            except AttributeError:
                serialized_results[key] = value  # Not a numpy array, no need to convert
    return serialized_results


def serialize_simulation_results_to_arrow(results: dict) -> bytes:
    """Convert results dict to Apache Arrow IPC stream bytes."""
    # Convert all values to Arrow arrays (if not already)
    arrow_ready = {}
    for key, value in results.items():
        try:
            arrow_ready[key] = pa.array(value)
        except Exception:
            # If not convertible, skip or handle as needed
            pass
    table = pa.table(arrow_ready)
    sink = pa.BufferOutputStream()
    with pa.ipc.new_stream(sink, table.schema) as writer:
        writer.write_table(table)
    byte_output = sink.getvalue().to_pybytes()
    return Response(content=byte_output, media_type="application/vnd.apache.arrow.stream")


def serialize_simulation_results(results: dict, use_arrow: bool = False) -> dict:
    """Serialize simulation results for JSON response, either to lists or Apache Arrow format."""
    if use_arrow:
        return serialize_simulation_results_to_arrow(results)
    else:
        return serialize_simulation_results_to_lists(results)
    

def log_timing(func):
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = await func(*args, **kwargs)
        duration = time.perf_counter() - start
        logger.info(f"{func.__name__} executed in {duration:.4f} seconds")
        return result
    return wrapper