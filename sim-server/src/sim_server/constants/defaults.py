import numpy as np


DEFAULT_PLANET = {
    "planet_name": "mars"
}

DEFAULT_INIT = {
    "h0": 124999, # [m] Critical altitude (i.e. altitude to start entry) [m] ref - 125e3 - Li ,Jiang 2014  MSL; Note- Girija 2022 is 120e3. I made I lower for the dataset
    "vel0": 6.0836e3, # [m/s] MSL SPICE data
    "theta0": np.deg2rad(-78.8618), #Initial longitude of probe [rad] ref: SPICE J2000 MSL initial position
    "phi0": np.deg2rad(27.1050), #Initial latitude of probe [rad] ref: SPICE J2000 MSL initial position
    "gamma0": np.deg2rad(-15.5), #flight path angle [rad] (should be negative)  ref - Li ,Jiang 2014  MSL
    "psi0": np.deg2rad(0), #Initial heading angle [rad]
}

DEFAULT_VEHICLE = {
    "vehicle_name": "default"
}

DEFAULT_CONTROL = {
    "bank_angle": np.deg2rad(30.0), # [rad] Bank Angle 
}
def override_defaults(defaults: dict, overrides: dict) -> dict:
    """Override default parameters with user-specified values, ignoring None values in overrides."""
    result = defaults.copy()
    for k, v in overrides.items():
        if v is not None:
            result[k] = v
    return result