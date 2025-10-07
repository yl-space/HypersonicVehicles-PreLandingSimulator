VEHICLES = {
    "default": {
        "beta": 115, # ballistic coefficient [kg/m^2] ref - Li ,Jiang 2014  MSL
        "LD": 0.24, # lift-to-drag ratio ref - ref - Li ,Jiang 2014  MSL 
    }
}

def get_vehicle_params(vehicle_name: str) -> dict:
    """Retrieve vehicle parameters by name."""
    vehicle = VEHICLES.get(vehicle_name.lower())
    if not vehicle:
        raise ValueError(f"Vehicle '{vehicle_name}' not found. Available vehicles: {list(VEHICLES.keys())}")
    return vehicle