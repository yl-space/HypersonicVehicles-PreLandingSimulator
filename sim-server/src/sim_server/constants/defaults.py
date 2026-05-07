import numpy as np


DEFAULT_PLANET = {
    "planet_name": "mars"
}

DEFAULT_INIT = {
    "h0": 125964.3, # [m] Critical altitude (i.e. altitude to start entry) [m] ref MSL SPICE data
    "vel0": 5844.5850, # [m/s] MSL SPICE data
    "theta0": np.deg2rad(126.7413), # [rad] Longitude — IAU_MARS body-fixed (from SPICE IAU_MARS data)
    "phi0": np.deg2rad(-3.9222), # [rad] Latitude — IAU_MARS body-fixed (from SPICE IAU_MARS data)
    "gamma0": np.deg2rad(-16.1304), # [rad] Flight path angle (negative = descending) — IAU_MARS from SPICE
    "psi0": np.deg2rad(-3.3454), # [rad] Heading angle — IAU_MARS body-fixed (from SPICE IAU_MARS data)
}

DEFAULT_VEHICLE = {
    "vehicle_name": "default"
}

DEFAULT_CONTROL = {
    "bank_angle": np.deg2rad(0), # [rad] Bank Angle (matches remote sim-server default)
}
def override_defaults(defaults: dict, overrides: dict) -> dict:
    """Override default parameters with user-specified values, ignoring None values in overrides."""
    result = defaults.copy()
    for k, v in overrides.items():
        if v is not None:
            result[k] = v
    return result