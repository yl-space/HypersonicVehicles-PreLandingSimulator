import numpy as np


DEFAULT_PLANET = {
    "planet_name": "mars"
}

DEFAULT_INIT = {
    "h0": 125000, # [m] Entry altitude ref - 125e3 - Li, Jiang 2014 MSL
    "vel0": 6.0836e3, # [m/s] MSL entry velocity
    "theta0": np.deg2rad(126.7413), # [rad] Longitude — IAU_MARS body-fixed (from SPICE IAU_MARS data)
    "phi0": np.deg2rad(-3.9222), # [rad] Latitude — IAU_MARS body-fixed (from SPICE IAU_MARS data)
    "gamma0": np.deg2rad(-15.5), # [rad] Flight path angle (negative = descending) ref - Li, Jiang 2014 MSL
    "psi0": np.deg2rad(93.3454), # [rad] Heading angle — IAU_MARS body-fixed (from SPICE IAU_MARS data)
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